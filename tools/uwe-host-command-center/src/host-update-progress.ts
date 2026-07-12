import fs from "node:fs/promises";
import path from "node:path";

export type HostUpdateStatus = "idle" | "pending" | "running" | "succeeded" | "failed";

export interface HostUpdateState {
  jobId: string | null;
  status: HostUpdateStatus;
  startedAt: string | null;
  finishedAt: string | null;
  startedByUserId: string | null;
  exitCode: number | null;
  commitBefore: string | null;
  commitAfter: string | null;
  error: string | null;
}

export interface HostUpdateLogLine {
  timestamp: string | null;
  message: string;
}

export interface HostUpdateProgress {
  state: HostUpdateState;
  active: boolean;
  elapsedSeconds: number | null;
  progressPercent: number;
  phaseLabel: string;
  currentActivity: string | null;
  logLines: HostUpdateLogLine[];
  logPath: string;
  statePath: string;
}

const UWE_DATA_DIR = process.env.UWE_DATA_DIR?.trim() || "/var/lib/uwe";
const UWE_LOG_DIR = process.env.UWE_LOG_DIR?.trim() || "/var/log/uwe";
const STATE_FILE = path.join(UWE_DATA_DIR, "host-update-state.json");
const LOG_FILE = path.join(UWE_LOG_DIR, "host-update.log");
const LOG_TAIL_BYTES = 32_000;
const MAX_LOG_LINES = 40;

const PHASES: ReadonlyArray<{ pattern: RegExp; percent: number; label: string }> = [
  { pattern: /Host-Update erfolgreich/i, percent: 100, label: "Abgeschlossen" },
  { pattern: /HTTP-Healthchecks|Healthcheck/i, percent: 96, label: "Healthchecks" },
  { pattern: /systemd neu laden und Service starten|systemctl restart/i, percent: 94, label: "Dienst neu starten" },
  { pattern: /Generating static pages/i, percent: 92, label: "Statische Seiten generieren" },
  { pattern: /Collecting page data/i, percent: 90, label: "Seitendaten sammeln" },
  { pattern: /Linting and checking validity of types/i, percent: 86, label: "Typen prüfen" },
  { pattern: /Compiling/i, percent: 82, label: "Kompilieren" },
  { pattern: /@uwe\/portal:build/i, percent: 78, label: "Portal bauen" },
  { pattern: /@uwe\/studio:build/i, percent: 65, label: "Studio bauen" },
  { pattern: /turbo run build|Tasks:\s+\d+\s+successful/i, percent: 55, label: "Monorepo-Build" },
  { pattern: /db:generate|prisma generate/i, percent: 48, label: "Datenbank-Schema generieren" },
  { pattern: /pnpm install|Installing dependencies/i, percent: 38, label: "Abhängigkeiten installieren" },
  { pattern: /setup-uwe-host\.sh --quick|UWE Host Setup — Modus: quick/i, percent: 28, label: "Host-Setup (quick)" },
  { pattern: /git reset --hard|git merge --ff-only|Lokaler Branch divergiert/i, percent: 20, label: "Git-Branch aktualisieren" },
  { pattern: /git fetch origin main/i, percent: 14, label: "git fetch origin main" },
  { pattern: /Synchronisiere Repository/i, percent: 10, label: "Repository synchronisieren" },
  { pattern: /Host-Update gestartet/i, percent: 5, label: "Update gestartet" },
];

function emptyState(): HostUpdateState {
  return {
    jobId: null,
    status: "idle",
    startedAt: null,
    finishedAt: null,
    startedByUserId: null,
    exitCode: null,
    commitBefore: null,
    commitAfter: null,
    error: null,
  };
}

export async function readHostUpdateState(): Promise<HostUpdateState> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<HostUpdateState>;
    return {
      jobId: parsed.jobId ?? null,
      status: (parsed.status as HostUpdateStatus | undefined) ?? "idle",
      startedAt: parsed.startedAt ?? null,
      finishedAt: parsed.finishedAt ?? null,
      startedByUserId: parsed.startedByUserId ?? null,
      exitCode: typeof parsed.exitCode === "number" ? parsed.exitCode : null,
      commitBefore: parsed.commitBefore ?? null,
      commitAfter: parsed.commitAfter ?? null,
      error: parsed.error ?? null,
    };
  } catch {
    return emptyState();
  }
}

async function readLogTail(): Promise<string> {
  try {
    const buf = await fs.readFile(LOG_FILE);
    if (buf.length <= LOG_TAIL_BYTES) {
      return buf.toString("utf8");
    }
    return buf.subarray(buf.length - LOG_TAIL_BYTES).toString("utf8");
  } catch {
    return "";
  }
}

const LOG_LINE_RE = /^\[([^\]]+)\]\s*(.*)$/;

export function parseLogLines(logTail: string): HostUpdateLogLine[] {
  const lines: HostUpdateLogLine[] = [];
  for (const raw of logTail.split("\n")) {
    const line = raw.trimEnd();
    if (!line) continue;
    const match = line.match(LOG_LINE_RE);
    if (match) {
      lines.push({ timestamp: match[1], message: match[2] });
      continue;
    }
    lines.push({ timestamp: null, message: line });
  }
  return lines.slice(-MAX_LOG_LINES);
}

function filterLogForJob(logTail: string, state: HostUpdateState): string {
  if (!state.startedAt && !state.jobId) {
    return logTail;
  }

  const lines = logTail.split("\n");
  let startIndex = 0;

  if (state.jobId) {
    const jobMarker = `Host-Update gestartet (Job ${state.jobId}`;
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      if (lines[i].includes(jobMarker)) {
        startIndex = i;
        break;
      }
    }
  }

  if (startIndex === 0 && state.startedAt) {
    const startedMs = Date.parse(state.startedAt);
    if (!Number.isNaN(startedMs)) {
      for (let i = 0; i < lines.length; i += 1) {
        const match = lines[i].match(LOG_LINE_RE);
        if (!match) continue;
        const ts = Date.parse(match[1]);
        if (!Number.isNaN(ts) && ts >= startedMs - 5_000) {
          startIndex = i;
          break;
        }
      }
    }
  }

  return lines.slice(startIndex).join("\n");
}

export function estimateProgress(
  state: HostUpdateState,
  logTail: string,
): { progressPercent: number; phaseLabel: string; currentActivity: string | null } {
  const scopedLog = filterLogForJob(logTail, state);

  if (state.status === "succeeded") {
    return { progressPercent: 100, phaseLabel: "Abgeschlossen", currentActivity: null };
  }
  if (state.status === "failed") {
    const failed = estimateFromLog(scopedLog);
    return {
      progressPercent: failed.progressPercent,
      phaseLabel: "Fehlgeschlagen",
      currentActivity: state.error ?? failed.currentActivity,
    };
  }
  if (state.status === "pending") {
    return {
      progressPercent: 2,
      phaseLabel: "Wartet auf systemd",
      currentActivity: "Update-Anfrage wird verarbeitet …",
    };
  }
  if (state.status !== "running") {
    return { progressPercent: 0, phaseLabel: "Bereit", currentActivity: null };
  }

  return estimateFromLog(scopedLog);
}

function estimateFromLog(logTail: string): {
  progressPercent: number;
  phaseLabel: string;
  currentActivity: string | null;
} {
  let progressPercent = 5;
  let phaseLabel = "Update läuft";
  const lines = logTail.split("\n").map((line) => line.trim()).filter(Boolean);

  for (const phase of PHASES) {
    if (phase.pattern.test(logTail) && phase.percent >= progressPercent) {
      progressPercent = phase.percent;
      phaseLabel = phase.label;
    }
  }

  const currentActivity = lines.length > 0 ? lines[lines.length - 1] : null;
  return { progressPercent, phaseLabel, currentActivity };
}

function elapsedSeconds(state: HostUpdateState): number | null {
  if (!state.startedAt) return null;
  const start = Date.parse(state.startedAt);
  if (Number.isNaN(start)) return null;
  const end = state.finishedAt ? Date.parse(state.finishedAt) : Date.now();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.floor((end - start) / 1000));
}

export async function getHostUpdateProgress(): Promise<HostUpdateProgress> {
  const [state, logTail] = await Promise.all([readHostUpdateState(), readLogTail()]);
  const scopedLog = filterLogForJob(logTail, state);
  const estimate = estimateProgress(state, logTail);
  const active = state.status === "pending" || state.status === "running";

  return {
    state,
    active,
    elapsedSeconds: elapsedSeconds(state),
    progressPercent: estimate.progressPercent,
    phaseLabel: estimate.phaseLabel,
    currentActivity: estimate.currentActivity,
    logLines: parseLogLines(scopedLog),
    logPath: LOG_FILE,
    statePath: STATE_FILE,
  };
}
