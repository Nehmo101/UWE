import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { InstallerError } from "./errors.js";
import { readInstallerState } from "./state.js";
import type { CommandResult } from "./types.js";

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

export function startUwe(stateFile: string): CommandResult {
  const state = readInstallerState(stateFile);
  if (!state) {
    throw new InstallerError("BUNDLE_MISSING", "UWE is not installed. Run install first.");
  }

  const studioStatus = getProcessStatus(state.paths.studioPidFile);
  const portalStatus = getProcessStatus(state.paths.portalPidFile);

  if (studioStatus.running && portalStatus.running) {
    return { ok: true, message: "UWE is already running." };
  }

  const studioLog = path.join(state.paths.logs, "studio.log");
  const portalLog = path.join(state.paths.logs, "portal.log");

  if (!studioStatus.running) {
    spawnApp(state.paths.app, "@uwe/studio", studioLog, state.paths.studioPidFile);
  }

  if (!portalStatus.running) {
    spawnApp(state.paths.app, "@uwe/portal", portalLog, state.paths.portalPidFile);
  }

  return {
    ok: true,
    message: "UWE started.",
    details: {
      studioUrl: `http://localhost:${state.ports.studioPort}`,
      portalUrl: `http://localhost:${state.ports.portalPort}`,
    },
  };
}

export function stopUwe(stateFile: string): CommandResult {
  const state = readInstallerState(stateFile);
  if (!state) {
    return { ok: false, message: "UWE is not installed." };
  }

  for (const pidFile of [state.paths.studioPidFile, state.paths.portalPidFile]) {
    const pid = readPid(pidFile);
    if (pid) {
      stopPid(pid);
    }
    clearPid(pidFile);
  }

  return { ok: true, message: "UWE stopped." };
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
    },
  };
}
