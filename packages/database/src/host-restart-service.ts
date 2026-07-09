import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_UWE_HOME = "/opt/uwe";

function resolveUweHome(): string {
  return process.env.UWE_HOME?.trim() || DEFAULT_UWE_HOME;
}

export interface HostRestartAvailability {
  enabled: boolean;
  available: boolean;
  reason: string | null;
  triggerScript: string | null;
}

function isHostRestartEnvEnabled(): boolean {
  return process.env.UWE_HOST_RESTART_ENABLED === "true";
}

function triggerScriptPath(): string {
  return `${resolveUweHome()}/deploy/scripts/uwe-host-restart-trigger.sh`;
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveHostRestartAvailability(): Promise<HostRestartAvailability> {
  const enabled = isHostRestartEnvEnabled();
  if (!enabled) {
    return {
      enabled: false,
      available: false,
      reason: "UWE_HOST_RESTART_ENABLED ist nicht true.",
      triggerScript: null,
    };
  }

  const triggerScript = triggerScriptPath();
  if (!(await isExecutable(triggerScript))) {
    return {
      enabled: true,
      available: false,
      reason: `Restart-Trigger nicht ausführbar: ${triggerScript}`,
      triggerScript: null,
    };
  }

  return {
    enabled: true,
    available: true,
    reason: null,
    triggerScript,
  };
}

export async function triggerHostRestart(): Promise<void> {
  const availability = await resolveHostRestartAvailability();
  if (!availability.available || !availability.triggerScript) {
    throw new HostRestartError(availability.reason ?? "Host-Neustart nicht verfügbar.", 503);
  }

  try {
    await execFileAsync(availability.triggerScript, [], {
      timeout: 30_000,
      maxBuffer: 256_000,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Host-Neustart-Trigger fehlgeschlagen.";
    throw new HostRestartError(
      `Host-Neustart konnte nicht ausgeführt werden. Prüfe sudoers (uwe-host-restart) und systemd. (${message})`,
      500,
    );
  }
}

export class HostRestartError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HostRestartError";
    this.status = status;
  }
}
