import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { InstallerError } from "./errors.js";
import { waitForHealth } from "./health.js";
import { appendRuntimeLog } from "./logging.js";
import { readInstallerState } from "./state.js";
import type { CommandResult, StartOptions } from "./types.js";

export interface ProcessStatus {
  running: boolean;
  pid: number | null;
}

function readPid(pidFile: string): number | null {
  if (!fs.existsSync(pidFile)) {
    return null;
  }

  const raw = fs.readFileSync(pidFile, "utf8").trim();
  const pid = Number.parseInt(raw, 10);
  return Number.isFinite(pid) ? pid : null;
}

function writePid(pidFile: string, pid: number): void {
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  fs.writeFileSync(pidFile, String(pid), "utf8");
}

function clearPid(pidFile: string): void {
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopPid(pid: number): void {
  if (!isProcessRunning(pid)) {
    return;
  }

  if (process.platform === "win32") {
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
  } else {
    process.kill(pid, "SIGTERM");
  }
}

function loadEnvFile(envFile: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (!fs.existsSync(envFile)) {
    return env;
  }

  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...rest] = trimmed.split("=");
    env[key] = rest.join("=");
  }

  return env;
}

function openBrowser(url: string): void {
  if (process.platform === "win32") {
    execSync(`start "" "${url}"`, { shell: "cmd.exe", stdio: "ignore" });
  } else if (process.platform === "darwin") {
    execSync(`open "${url}"`, { stdio: "ignore" });
  } else {
    execSync(`xdg-open "${url}"`, { stdio: "ignore" });
  }
}

function spawnApp(
  appRoot: string,
  filter: string,
  logFile: string,
  pidFile: string,
): number {
  const env = loadEnvFile(path.join(path.dirname(appRoot), ".env"));
  const logStream = fs.createWriteStream(logFile, { flags: "a" });

  const child = spawn(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", filter, "start"],
    {
      cwd: appRoot,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    },
  );

  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);
  child.unref();

  if (!child.pid) {
    throw new InstallerError("START_FAILED", `Failed to start ${filter}`);
  }

  writePid(pidFile, child.pid);
  return child.pid;
}

export function getProcessStatus(pidFile: string): ProcessStatus {
  const pid = readPid(pidFile);
  if (!pid) {
    return { running: false, pid: null };
  }

  const running = isProcessRunning(pid);
  if (!running) {
    clearPid(pidFile);
  }

  return { running, pid: running ? pid : null };
}

export async function startUwe(
  stateFile: string,
  options: StartOptions = {},
): Promise<CommandResult> {
  const state = readInstallerState(stateFile);
  if (!state) {
    throw new InstallerError("BUNDLE_MISSING", "UWE is not installed. Run install first.");
  }

  const studioStatus = getProcessStatus(state.paths.studioPidFile);
  const portalStatus = getProcessStatus(state.paths.portalPidFile);

  if (studioStatus.running && portalStatus.running) {
    const studioUrl = `http://localhost:${state.ports.studioPort}`;
    if (options.openBrowser) {
      openBrowser(studioUrl);
    }
    return { ok: true, message: "UWE is already running.", details: { studioUrl } };
  }

  const studioLog = path.join(state.paths.logs, "studio.log");
  const portalLog = path.join(state.paths.logs, "portal.log");

  appendRuntimeLog(state.paths.logs, "Starting UWE...");

  if (!studioStatus.running) {
    spawnApp(state.paths.app, "@uwe/studio", studioLog, state.paths.studioPidFile);
  }

  if (!portalStatus.running) {
    spawnApp(state.paths.app, "@uwe/portal", portalLog, state.paths.portalPidFile);
  }

  const studioUrl = `http://localhost:${state.ports.studioPort}`;
  const portalUrl = `http://localhost:${state.ports.portalPort}`;

  if (options.waitForHealth !== false) {
    const studioHealthy = await waitForHealth({
      url: `${studioUrl}/api/health`,
      timeoutMs: 120_000,
    });
    const portalHealthy = await waitForHealth({
      url: `${portalUrl}/api/health`,
      timeoutMs: 120_000,
    });

    if (!studioHealthy || !portalHealthy) {
      appendRuntimeLog(
        state.paths.logs,
        `Health check warning: studio=${studioHealthy}, portal=${portalHealthy}`,
      );
    }
  }

  if (options.openBrowser !== false) {
    openBrowser(studioUrl);
  }

  appendRuntimeLog(state.paths.logs, "UWE started.");

  return {
    ok: true,
    message: "UWE started.",
    details: {
      studioUrl,
      portalUrl,
    },
  };
}

export function stopUwe(stateFile: string): CommandResult {
  const state = readInstallerState(stateFile);
  if (!state) {
    return { ok: false, message: "UWE is not installed." };
  }

  appendRuntimeLog(state.paths.logs, "Stopping UWE...");

  for (const pidFile of [state.paths.studioPidFile, state.paths.portalPidFile]) {
    const pid = readPid(pidFile);
    if (pid) {
      stopPid(pid);
    }
    clearPid(pidFile);
  }

  appendRuntimeLog(state.paths.logs, "UWE stopped.");

  return { ok: true, message: "UWE stopped." };
}

export async function restartUwe(
  stateFile: string,
  options: StartOptions = {},
): Promise<CommandResult> {
  stopUwe(stateFile);
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  return startUwe(stateFile, options);
}

export function statusUwe(stateFile: string): CommandResult {
  const state = readInstallerState(stateFile);
  if (!state) {
    return { ok: false, message: "UWE is not installed." };
  }

  const studio = getProcessStatus(state.paths.studioPidFile);
  const portal = getProcessStatus(state.paths.portalPidFile);

  return {
    ok: true,
    message: `Studio: ${studio.running ? "running" : "stopped"} | Portal: ${portal.running ? "running" : "stopped"}`,
    details: {
      studio,
      portal,
      installRoot: state.paths.root,
      logs: state.paths.logs,
      uweVersion: state.uweVersion,
    },
  };
}

export function openUweInBrowser(stateFile: string, target: "studio" | "portal" = "studio"): CommandResult {
  const state = readInstallerState(stateFile);
  if (!state) {
    return { ok: false, message: "UWE is not installed." };
  }

  const url =
    target === "portal"
      ? `http://localhost:${state.ports.portalPort}`
      : `http://localhost:${state.ports.studioPort}`;

  openBrowser(url);
  return { ok: true, message: `Opened ${url}` };
}
