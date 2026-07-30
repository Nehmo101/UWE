import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";

import type { DesktopHostService } from "./desktop-host.ts";

/**
 * Prozess-, Probe-, Snapshot- und Log-Helfer des Desktop-Hosts — reine
 * System-Utilities ohne Host-Zustandslogik (die bleibt in desktop-host.ts).
 */

export interface HealthProbe {
  responding: boolean;
  healthy: boolean;
  /**
   * Selbstauskunft des antwortenden Dienstes (`app` bzw. `app.name` aus
   * `/api/health`), `null` bei fremder oder unlesbarer Antwort. Daran erkennt
   * der Host einen eigenen verwaisten Prozess auf einem belegten Port.
   */
  app: string | null;
}

export async function probeHealth(url: string): Promise<HealthProbe> {
  try {
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2_500) });
    return { responding: true, healthy: response.ok, app: await readHealthAppName(response) };
  } catch {
    return { responding: false, healthy: false, app: null };
  }
}

async function readHealthAppName(response: Response): Promise<string | null> {
  try {
    return healthAppName(await response.json());
  } catch {
    return null; // Keine (lesbare) JSON-Antwort — dann ist es nicht unsere App.
  }
}

/**
 * Der App-Name aus einer Healthcheck-Antwort. Studio und Portal liefern ein
 * Objekt (`app.name` neben Version und Laufzeit), Brain, Family und die
 * Startseite nur den Namen — beides zählt.
 */
export function healthAppName(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const app = (payload as { app?: unknown }).app;
  if (typeof app === "string") return app.trim() || null;
  if (app && typeof app === "object") {
    const name = (app as { name?: unknown }).name;
    if (typeof name === "string") return name.trim() || null;
  }
  return null;
}

/**
 * Die PIDs, die auf `port` lauschen. Leer, wenn das Betriebssystem nichts
 * verrät (fehlendes Werkzeug, fehlende Rechte) — Aufrufer müssen damit rechnen
 * und dürfen daraus nicht „Port ist frei" ableiten.
 */
export function listenerPids(port: number): number[] {
  const pids = process.platform === "win32" ? windowsListenerPids(port) : posixListenerPids(port);
  return [...new Set(pids.filter((pid) => Number.isInteger(pid) && pid > 0))];
}

function windowsListenerPids(port: number): number[] {
  // Bewusst ohne `-p tcp`: das listet nur IPv4, ein auf `[::]` gebundener
  // Dienst fiele durchs Raster.
  const raw = runCapture("netstat", ["-ano"]);
  return raw ? parseNetstatListeners(raw, port) : [];
}

/**
 * `netstat -ano` ist lokalisiert („LISTENING" / „ABHÖREN"), der Zustand taugt
 * deshalb nicht als Filter. Verlässlich sind die Spalten: die lokale Adresse
 * endet auf `:port`, die Gegenstelle ist der Nullpunkt (nur so bei einem
 * lauschenden Socket) und die letzte Spalte ist die PID. Damit fallen zugleich
 * UDP-Zeilen (vier Spalten) und die TIME_WAIT-Leichen mit PID 0 heraus.
 */
export function parseNetstatListeners(raw: string, port: number): number[] {
  const idle = new Set(["0.0.0.0:0", "[::]:0", "*:*"]);
  const pids: number[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const columns = line.trim().split(/\s+/);
    if (columns.length < 5 || !/^tcp/i.test(columns[0])) continue;
    if (!columns[1].endsWith(`:${port}`) || !idle.has(columns[2])) continue;
    pids.push(Number.parseInt(columns[columns.length - 1], 10));
  }
  return pids;
}

function posixListenerPids(port: number): number[] {
  const lsof = runCapture("lsof", ["-nP", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"]);
  if (lsof) return lsof.split(/\r?\n/).map((line) => Number.parseInt(line.trim(), 10));
  // Ohne lsof: `ss` nennt die PID im letzten Feld als `pid=NNN`.
  const ss = runCapture("ss", ["-Hltnp", `sport = :${port}`]);
  return ss ? [...ss.matchAll(/pid=(\d+)/g)].map((match) => Number.parseInt(match[1], 10)) : [];
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

/**
 * Die Fassung des laufenden Command Centers. Der Rust-Host reicht sie an die
 * Host-CLI durch, weil eine Bundle-Installation keine `tauri.conf.json` neben
 * sich hat: nur so weiß der Update-Check, ob die Desktop-App hinter dem
 * Release-Tag liegt und der Installer geöffnet werden muss.
 */
export function runningCommandCenterVersion(): string | null {
  const value = process.env.UWE_COMMAND_CENTER_VERSION?.trim();
  return value && /^\d+\.\d+\.\d+$/.test(value) ? value : null;
}

/**
 * Nur `http`/`https` dürfen geöffnet werden. Die Adresse stammt teils aus der
 * `.env` des Hosts (`UWE_*_PUBLIC_URL`), also aus Konfiguration statt aus dem
 * Code — und sie landet in einer Prozess-Kommandozeile. Ein enges Schema-
 * Fenster hält alles fern, was dort nichts zu suchen hat (`file:`, `javascript:`
 * und Verwandte).
 */
export function isOpenableUrl(url: string): boolean {
  try {
    const schema = new URL(url).protocol;
    return schema === "http:" || schema === "https:";
  } catch {
    return false;
  }
}

/**
 * Eine URL im Standardprogramm des Systems öffnen — Dienst-Oberflächen, die
 * Release-Seite, der Installer-Download. Der Prozess wird abgekoppelt, damit das
 * Beenden des Command Centers den geöffneten Browser nicht mitnimmt.
 *
 * Bewusst ohne Shell: `cmd.exe /c start` würde `&`, `|` und `^` aus der Adresse
 * als Befehlstrenner lesen — bei einer Adresse aus der `.env` reicht das für
 * Codeausführung. `explorer.exe` bekommt das Argument über `CreateProcess`
 * direkt, ohne dass ein Parser dazwischen steht (CodeQL js/command-line-injection).
 */
export function openExternalUrl(url: string): void {
  if (!isOpenableUrl(url)) {
    throw new Error(`Adresse wird nicht geöffnet (nur http/https): ${url}`);
  }
  if (process.platform === "win32") {
    spawn("explorer.exe", [url], { detached: true, windowsHide: true, stdio: "ignore" }).unref();
    return;
  }
  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
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
