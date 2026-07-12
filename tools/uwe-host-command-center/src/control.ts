import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";

export interface ControlActionSpec {
  id: string;
  label: string;
  description: string;
  dangerous: boolean;
  /** When false, the action button stays disabled even if other controls work. */
  available?: boolean;
  unavailableReason?: string;
}

export interface ControlMeta {
  enabled: boolean;
  sudoReady: boolean;
  message: string;
  actions: ControlActionSpec[];
}

export interface ControlActionResult {
  ok: boolean;
  message: string;
}

const TOKEN_FILE = process.env.HOST_COMMAND_CENTER_TOKEN_FILE
  ?? "/var/log/uwe/host-command-center.token";

const UWE_HOME = process.env.UWE_HOME?.trim() || "/opt/uwe";
const UWE_DATA_DIR = process.env.UWE_DATA_DIR?.trim() || "/var/lib/uwe";
const HOST_UPDATE_TRIGGER = path.join(UWE_HOME, "deploy/scripts/uwe-host-update-trigger.sh");
const HOST_UPDATE_REQUEST = path.join(UWE_DATA_DIR, "host-update-request.json");
const HOST_UPDATE_STATE = path.join(UWE_DATA_DIR, "host-update-state.json");

const ACTION_SPECS = [
  {
    id: "update-uwe",
    label: "Update UWE",
    description: "CD-Pipeline: git sync, Build und Neustart (10–30 Min., UWE offline)",
    dangerous: true,
  },
  {
    id: "restart-uwe",
    label: "UWE neu starten",
    description: "Startet uwe.service neu (Studio + Portal)",
    dangerous: true,
  },
  {
    id: "backup-now",
    label: "Backup jetzt",
    description: "Löst uwe-backup.service einmalig aus",
    dangerous: false,
  },
  {
    id: "healthcheck-now",
    label: "Healthcheck",
    description: "Prüft Studio/Portal und startet ggf. einen Neustart",
    dangerous: false,
  },
] as const satisfies readonly Omit<ControlActionSpec, "available" | "unavailableReason">[];

const SUDO_COMMANDS: Record<string, readonly string[]> = {
  "restart-uwe": ["sudo", "-n", "systemctl", "restart", "uwe.service"],
  "backup-now": ["sudo", "-n", "systemctl", "start", "uwe-backup.service"],
  "healthcheck-now": ["sudo", "-n", "systemctl", "start", "uwe-healthcheck.service"],
};

let cachedToken: string | null = null;

async function readTokenFile(): Promise<string | null> {
  try {
    const raw = await fs.readFile(TOKEN_FILE, "utf8");
    const token = raw.trim();
    return token || null;
  } catch {
    return null;
  }
}

async function writeTokenFile(token: string): Promise<void> {
  const dir = path.dirname(TOKEN_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(TOKEN_FILE, `${token}\n`, { mode: 0o600 });
}

export async function resolveControlToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const fromEnv = process.env.HOST_COMMAND_CENTER_TOKEN?.trim();
  if (fromEnv) {
    cachedToken = fromEnv;
    return fromEnv;
  }
  const fromFile = await readTokenFile();
  if (fromFile) {
    cachedToken = fromFile;
    return fromFile;
  }
  const generated = randomBytes(24).toString("base64url");
  await writeTokenFile(generated);
  cachedToken = generated;
  return generated;
}

function runCommand(
  cmd: string,
  args: string[] = [],
  timeoutMs = 30_000,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 256 * 1024 }, (error, stdout, stderr) => {
      const err = error as NodeJS.ErrnoException | null;
      const code = err && typeof err.code === "number" ? err.code : err ? 1 : 0;
      resolve({
        code,
        stdout: stdout?.toString() ?? "",
        stderr: stderr?.toString() ?? "",
      });
    });
  });
}

async function probeSudo(): Promise<boolean> {
  const result = await runCommand("sudo", ["-n", "systemctl", "show", "uwe.service", "--property=ActiveState"]);
  return result.code === 0;
}

function isHostUpdateEnvEnabled(): boolean {
  const raw = process.env.UWE_HOST_UPDATE_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

async function pathExecutable(target: string): Promise<boolean> {
  try {
    await fs.access(target, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function readHostUpdateStatus(): Promise<string | null> {
  try {
    const raw = await fs.readFile(HOST_UPDATE_STATE, "utf8");
    const parsed = JSON.parse(raw) as { status?: string };
    return typeof parsed.status === "string" ? parsed.status : null;
  } catch {
    return null;
  }
}

async function resolveHostUpdateAvailability(): Promise<{ available: boolean; reason: string | null }> {
  if (!isHostUpdateEnvEnabled()) {
    return {
      available: false,
      reason: "Host-Update deaktiviert (UWE_HOST_UPDATE_ENABLED in /etc/uwe/uwe.env)",
    };
  }
  if (!(await pathExecutable(HOST_UPDATE_TRIGGER))) {
    return {
      available: false,
      reason: `Host-Update-Trigger fehlt: ${HOST_UPDATE_TRIGGER}`,
    };
  }
  const status = await readHostUpdateStatus();
  if (status === "running" || status === "pending") {
    return { available: false, reason: "Host-Update läuft bereits" };
  }
  return { available: true, reason: null };
}

async function resolveCommitBefore(): Promise<string | null> {
  const result = await runCommand("git", ["-C", UWE_HOME, "rev-parse", "HEAD"]);
  if (result.code !== 0) return null;
  const commit = result.stdout.trim();
  return commit || null;
}

async function writeHostUpdateRequest(commitBefore: string | null): Promise<string> {
  const jobId = `hcc-${randomBytes(8).toString("hex")}`;
  const payload = {
    jobId,
    requestedAt: new Date().toISOString(),
    actorUserId: "host-command-center",
    commitBefore,
  };
  await fs.writeFile(HOST_UPDATE_REQUEST, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o640,
  });
  return jobId;
}

async function triggerHostUpdate(): Promise<ControlActionResult> {
  const availability = await resolveHostUpdateAvailability();
  if (!availability.available) {
    return { ok: false, message: availability.reason ?? "Host-Update nicht verfügbar" };
  }

  const commitBefore = await resolveCommitBefore();
  const jobId = await writeHostUpdateRequest(commitBefore);

  const result = await runCommand(HOST_UPDATE_TRIGGER, [], 60_000);
  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout).trim().split("\n").pop()
      ?? `Exit ${result.code}`;
    return { ok: false, message: detail };
  }

  return {
    ok: true,
    message: `Host-Update gestartet (${jobId}) — Fortschritt wird unten live angezeigt.`,
  };
}

function buildActions(
  sudoReady: boolean,
  hostUpdate: { available: boolean; reason: string | null },
): ControlActionSpec[] {
  return ACTION_SPECS.map((spec) => {
    if (spec.id === "update-uwe") {
      return {
        ...spec,
        available: hostUpdate.available,
        unavailableReason: hostUpdate.reason ?? undefined,
      };
    }
    return {
      ...spec,
      available: sudoReady,
      unavailableReason: sudoReady ? undefined : "sudoers-Regel fehlt",
    };
  });
}

export async function getControlMeta(): Promise<ControlMeta> {
  const [sudoReady, hostUpdate] = await Promise.all([probeSudo(), resolveHostUpdateAvailability()]);
  const actions = buildActions(sudoReady, hostUpdate);
  const anyAvailable = actions.some((action) => action.available !== false);

  if (!anyAvailable) {
    const reasons = [
      !sudoReady ? "sudoers uwe-host-command-center fehlt" : null,
      !hostUpdate.available ? (hostUpdate.reason ?? "Host-Update nicht verfügbar") : null,
    ].filter(Boolean);
    return {
      enabled: false,
      sudoReady,
      message: `Steuerung deaktiviert — ${reasons.join("; ")}`,
      actions,
    };
  }

  const parts = ["Steuerung aktiv (localhost + Token)"];
  if (!sudoReady) parts.push("systemctl-Aktionen deaktiviert");
  if (!hostUpdate.available && hostUpdate.reason) parts.push(hostUpdate.reason);

  return {
    enabled: true,
    sudoReady,
    message: parts.join(" · "),
    actions,
  };
}

export function isValidAction(actionId: string): boolean {
  return ACTION_SPECS.some((action) => action.id === actionId);
}

export async function executeControlAction(
  actionId: string,
  token: string | null | undefined,
): Promise<ControlActionResult> {
  const expected = await resolveControlToken();
  if (!token || token !== expected) {
    return { ok: false, message: "Ungültiges Steuerungs-Token" };
  }
  if (!isValidAction(actionId)) {
    return { ok: false, message: "Unbekannte Aktion" };
  }

  const meta = await getControlMeta();
  const action = meta.actions.find((entry) => entry.id === actionId);
  if (!meta.enabled || action?.available === false) {
    return {
      ok: false,
      message: action?.unavailableReason ?? meta.message,
    };
  }

  if (actionId === "update-uwe") {
    return triggerHostUpdate();
  }

  const command = SUDO_COMMANDS[actionId as keyof typeof SUDO_COMMANDS];
  const result = await runCommand(command[0], command.slice(1));
  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout).trim().split("\n").pop() ?? `Exit ${result.code}`;
    return { ok: false, message: detail };
  }

  const labels: Record<string, string> = {
    "restart-uwe": "UWE-Neustart ausgelöst",
    "backup-now": "Backup gestartet",
    "healthcheck-now": "Healthcheck ausgeführt",
  };
  return { ok: true, message: labels[actionId] ?? "OK" };
}
