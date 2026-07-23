import { spawnSync } from "node:child_process";
import fs from "node:fs";

import type { DesktopHostService } from "./desktop-host.ts";

/**
 * Prozess-, Probe-, Snapshot- und Log-Helfer des Desktop-Hosts — reine
 * System-Utilities ohne Host-Zustandslogik (die bleibt in desktop-host.ts).
 */

export interface HealthProbe {
  responding: boolean;
  healthy: boolean;
}

export async function probeHealth(url: string): Promise<HealthProbe> {
  try {
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2_500) });
    return { responding: true, healthy: response.ok };
  } catch {
    return { responding: false, healthy: false };
  }
}

export async function health(url: string): Promise<boolean> {
  return (await probeHealth(url)).healthy;
}

export async function waitForHealth(url: string, timeoutMs = 90_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await health(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

export function runCapture(command: string, args: string[], cwd?: string): string | null {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 8_000,
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

export interface GpuInfo {
  available: boolean;
  name: string | null;
  vramTotalMb: number | null;
  utilizationPercent: number | null;
  temperatureC: number | null;
}

export function gpuSnapshot(): GpuInfo {
  const raw = runCapture("nvidia-smi", [
    "--query-gpu=name,memory.total,utilization.gpu,temperature.gpu",
    "--format=csv,noheader,nounits",
  ]);
  if (!raw) {
    return { available: false, name: null, vramTotalMb: null, utilizationPercent: null, temperatureC: null };
  }
  const [name, memory, utilization, temperature] = raw.split(/\r?\n/, 1)[0].split(",").map((value) => value.trim());
  return {
    available: true,
    name: name || null,
    vramTotalMb: Number.isFinite(Number(memory)) ? Number(memory) : null,
    utilizationPercent: Number.isFinite(Number(utilization)) ? Number(utilization) : null,
    temperatureC: Number.isFinite(Number(temperature)) ? Number(temperature) : null,
  };
}

export function diskSnapshot(root: string): { total: number | null; used: number | null } {
  try {
    const stats = fs.statfsSync(root);
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    return { total, used: total - free };
  } catch {
    return { total: null, used: null };
  }
}

export function deriveOwnedServiceState(
  running: boolean,
  responding: boolean,
  healthy: boolean,
): Pick<DesktopHostService, "state" | "healthy" | "message"> {
  if (responding && !running) {
    return { state: "error", healthy: false, message: "Port ist durch einen fremd gestarteten Dienst belegt." };
  }
  if (healthy) return { state: "online", healthy: true, message: "Erreichbar" };
  if (running && responding) {
    return { state: "error", healthy: false, message: "Dienst antwortet, aber der Healthcheck meldet einen Fehler." };
  }
  if (running) return { state: "starting", healthy: false, message: "Prozess startet oder Healthcheck ist noch nicht bereit." };
  return { state: "stopped", healthy: false, message: "Gestoppt" };
}

export function readPid(file: string): number | null {
  try {
    const value = Number.parseInt(fs.readFileSync(file, "utf8").trim(), 10);
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function processRunning(pid: number | null): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function stopProcess(pid: number): void {
  if (!processRunning(pid)) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
  } else {
    try { process.kill(-pid, "SIGTERM"); } catch { process.kill(pid, "SIGTERM"); }
  }
}

export function pnpmCommand(args: string[]): { command: string; args: string[] } {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", "corepack", "pnpm", ...args],
    };
  }
  return { command: "corepack", args: ["pnpm", ...args] };
}

const MAX_LOG_BYTES = 5 * 1024 * 1024;

/** Rename a log to `.1` (keeping one prior generation) once it exceeds the cap. */
export function rotateLogIfLarge(file: string): void {
  try {
    if (fs.statSync(file).size > MAX_LOG_BYTES) {
      fs.renameSync(file, `${file}.1`);
    }
  } catch {
    // Missing/not-yet-created log — nothing to rotate.
  }
}

/** Append to a host log, rotating first so append-only logs cannot grow unbounded. */
export function appendToLog(file: string, text: string): void {
  rotateLogIfLarge(file);
  fs.appendFileSync(file, text, "utf8");
}

/** Read only the tail of a log (last ~64 KB) instead of loading the whole file. */
export function readLogTail(file: string, maxLines: number): string[] {
  const CHUNK = 64 * 1024;
  const fd = fs.openSync(file, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const readLength = Math.min(CHUNK, size);
    const buffer = Buffer.alloc(readLength);
    if (readLength > 0) fs.readSync(fd, buffer, 0, readLength, size - readLength);
    const lines = buffer.toString("utf8").split(/\r?\n/);
    if (size > readLength && lines.length > 0) lines.shift(); // drop the partial first line
    return lines.filter(Boolean).slice(-maxLines);
  } finally {
    fs.closeSync(fd);
  }
}
