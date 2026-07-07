import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

export interface HostGitInfo {
  repoPath: string;
  branch: string | null;
  commit: string | null;
  shortCommit: string | null;
  dirty: boolean;
  behindRemote: number | null;
  remoteDefaultRef: string | null;
}

export interface HostUpdateAvailability {
  enabled: boolean;
  available: boolean;
  reason: string | null;
  repoPath: string;
  triggerScript: string | null;
  logPath: string;
  statePath: string;
}

export interface HostUpdateDashboard {
  availability: HostUpdateAvailability;
  state: HostUpdateState;
  git: HostGitInfo | null;
  logTail: string | null;
}

export interface TriggerHostUpdateInput {
  actorUserId: string;
}

export interface TriggerHostUpdateResult {
  jobId: string;
  status: "pending";
}

const DEFAULT_UWE_HOME = "/opt/uwe";
const DEFAULT_DATA_DIR = "/var/lib/uwe";
const DEFAULT_LOG_DIR = "/var/log/uwe";
const REQUEST_MAX_AGE_MS = 10 * 60_000;
const LOG_TAIL_BYTES = 24_000;

function resolveUweHome(): string {
  return process.env.UWE_HOME?.trim() || DEFAULT_UWE_HOME;
}

function resolveDataDir(): string {
  return process.env.UWE_DATA_DIR?.trim() || DEFAULT_DATA_DIR;
}

function resolveLogDir(): string {
  return process.env.UWE_LOG_DIR?.trim() || DEFAULT_LOG_DIR;
}

function stateFilePath(): string {
  return path.join(resolveDataDir(), "host-update-state.json");
}

function requestFilePath(): string {
  return path.join(resolveDataDir(), "host-update-request.json");
}

function logFilePath(): string {
  return path.join(resolveLogDir(), "host-update.log");
}

function triggerScriptPath(): string {
  return path.join(resolveUweHome(), "deploy/scripts/uwe-host-update-trigger.sh");
}

function isHostUpdateEnvEnabled(): boolean {
  const raw = process.env.UWE_HOST_UPDATE_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function pathExecutable(target: string): Promise<boolean> {
  try {
    await access(target, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveHostUpdateAvailability(): Promise<HostUpdateAvailability> {
  const repoPath = resolveUweHome();
  const triggerScript = triggerScriptPath();
  const logPath = logFilePath();
  const statePath = stateFilePath();
  const enabled = isHostUpdateEnvEnabled();

  if (!enabled) {
    return {
      enabled: false,
      available: false,
      reason:
        "Host-Update ist deaktiviert. Setze UWE_HOST_UPDATE_ENABLED=true in /etc/uwe/uwe.env und führe setup-uwe-host.sh aus.",
      repoPath,
      triggerScript: null,
      logPath,
      statePath,
    };
  }

  const hasRepo = await pathExists(path.join(repoPath, "package.json"));
  const hasTrigger = await pathExecutable(triggerScript);

  if (!hasRepo) {
    return {
      enabled: true,
      available: false,
      reason: `Kein UWE-Repository unter ${repoPath} gefunden.`,
      repoPath,
      triggerScript: hasTrigger ? triggerScript : null,
      logPath,
      statePath,
    };
  }

  if (!hasTrigger) {
    return {
      enabled: true,
      available: false,
      reason: `Host-Update-Trigger fehlt oder ist nicht ausführbar: ${triggerScript}`,
      repoPath,
      triggerScript: null,
      logPath,
      statePath,
    };
  }

  return {
    enabled: true,
    available: true,
    reason: null,
    repoPath,
    triggerScript,
    logPath,
    statePath,
  };
}

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
  const file = stateFilePath();
  if (!(await pathExists(file))) {
    return emptyState();
  }

  try {
    const raw = await readFile(file, "utf8");
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

async function readLogTail(): Promise<string | null> {
  const file = logFilePath();
  if (!(await pathExists(file))) {
    return null;
  }

  try {
    const buf = await readFile(file);
    if (buf.length <= LOG_TAIL_BYTES) {
      return buf.toString("utf8");
    }
    return buf.subarray(buf.length - LOG_TAIL_BYTES).toString("utf8");
  } catch {
    return null;
  }
}

async function runGit(repoPath: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", repoPath, ...args], {
      timeout: 15_000,
      maxBuffer: 512_000,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function getHostGitInfo(options?: { fetchRemote?: boolean }): Promise<HostGitInfo | null> {
  const repoPath = resolveUweHome();
  if (!(await pathExists(path.join(repoPath, ".git")))) {
    return null;
  }

  if (options?.fetchRemote) {
    await runGit(repoPath, ["fetch", "--quiet", "origin"]);
  }

  const branch = await runGit(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const commit = await runGit(repoPath, ["rev-parse", "HEAD"]);
  const porcelain = await runGit(repoPath, ["status", "--porcelain"]);
  const behindRaw = await runGit(repoPath, ["rev-list", "--count", "HEAD..@{u}"]);

  let behindRemote: number | null = null;
  if (behindRaw && /^\d+$/.test(behindRaw)) {
    behindRemote = Number(behindRaw);
  }

  const upstream = await runGit(repoPath, ["rev-parse", "--abbrev-ref", "@{u}"]);

  return {
    repoPath,
    branch,
    commit,
    shortCommit: commit ? commit.slice(0, 12) : null,
    dirty: Boolean(porcelain && porcelain.length > 0),
    behindRemote,
    remoteDefaultRef: upstream,
  };
}

export async function getHostUpdateDashboard(options?: {
  fetchRemote?: boolean;
}): Promise<HostUpdateDashboard> {
  const [availability, state, git, logTail] = await Promise.all([
    resolveHostUpdateAvailability(),
    readHostUpdateState(),
    getHostGitInfo({ fetchRemote: options?.fetchRemote }),
    readLogTail(),
  ]);

  return { availability, state, git, logTail };
}

async function writeRequestFile(payload: Record<string, unknown>): Promise<void> {
  const file = requestFilePath();
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o640 });
}

export async function triggerHostUpdate(
  input: TriggerHostUpdateInput,
): Promise<TriggerHostUpdateResult> {
  const availability = await resolveHostUpdateAvailability();
  if (!availability.available || !availability.triggerScript) {
    throw new HostUpdateError(availability.reason ?? "Host-Update nicht verfügbar.", 503);
  }

  const current = await readHostUpdateState();
  if (current.status === "running" || current.status === "pending") {
    throw new HostUpdateError("Ein Host-Update läuft bereits.", 409);
  }

  const git = await getHostGitInfo();
  const jobId = randomUUID();
  const requestedAt = new Date().toISOString();

  await writeRequestFile({
    jobId,
    actorUserId: input.actorUserId,
    requestedAt,
    commitBefore: git?.commit ?? null,
  });

  const pendingState: HostUpdateState = {
    jobId,
    status: "pending",
    startedAt: requestedAt,
    finishedAt: null,
    startedByUserId: input.actorUserId,
    exitCode: null,
    commitBefore: git?.commit ?? null,
    commitAfter: null,
    error: null,
  };
  await writeFile(stateFilePath(), `${JSON.stringify(pendingState, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o640,
  });

  try {
    // The trigger script now runs unprivileged and escalates only the single
    // `systemctl start uwe-host-update.service` call internally (via a narrow
    // sudoers grant). Invoking it without sudo keeps the writable repo script
    // out of the root-executed path.
    await execFileAsync(availability.triggerScript, [], {
      timeout: 30_000,
      maxBuffer: 256_000,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Host-Update-Trigger fehlgeschlagen.";
    const failedState: HostUpdateState = {
      ...pendingState,
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: message,
      exitCode: 1,
    };
    await writeFile(stateFilePath(), `${JSON.stringify(failedState, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o640,
    });
    throw new HostUpdateError(
      "Host-Update konnte nicht gestartet werden. Prüfe sudoers und systemd (uwe-host-update).",
      500,
    );
  }

  return { jobId, status: "pending" };
}

export function isHostUpdateRequestFresh(requestedAt: string): boolean {
  const ts = Date.parse(requestedAt);
  if (Number.isNaN(ts)) {
    return false;
  }
  return Date.now() - ts <= REQUEST_MAX_AGE_MS;
}

export class HostUpdateError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HostUpdateError";
    this.status = status;
  }
}
