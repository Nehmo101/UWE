import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { beginHostProgress, reportHostStep } from "./desktop-host-progress.ts";

/**
 * Number of discrete steps `setupHost` reports progress for. Kept as a constant
 * so `applyDesktopHostUpdate` can size the combined update progress bar (stop →
 * sync → setup steps → start) without importing the step list itself.
 */
export const HOST_SETUP_STEP_COUNT = 8;

type ServiceState = "online" | "starting" | "stopped" | "error";

export interface DesktopHostService {
  id: "studio" | "portal";
  label: string;
  state: ServiceState;
  healthy: boolean;
  pid: number | null;
  url: string;
  message: string;
}

export interface DesktopHostStatus {
  collectedAt: string;
  overall: "ready" | "attention" | "error";
  root: string;
  revision: string | null;
  branch: string | null;
  installation: {
    repoReady: boolean;
    dependenciesReady: boolean;
    envReady: boolean;
    databaseReady: boolean;
    buildReady: boolean;
    message: string;
  };
  host: {
    hostname: string;
    platform: string;
    release: string;
    uptimeSeconds: number;
    cpuModel: string;
    cpuCores: number;
    ramTotalBytes: number;
    ramUsedBytes: number;
    diskTotalBytes: number | null;
    diskUsedBytes: number | null;
  };
  gpu: {
    available: boolean;
    name: string | null;
    vramTotalMb: number | null;
    utilizationPercent: number | null;
    temperatureC: number | null;
  };
  services: DesktopHostService[];
  dataDir: string;
  logsDir: string;
}

export interface DesktopHostActionResult {
  ok: boolean;
  message: string;
  status: DesktopHostStatus;
}

export interface HostPaths {
  root: string;
  dataRoot: string;
  data: string;
  uploads: string;
  backups: string;
  exports: string;
  logs: string;
  runtime: string;
  envFile: string;
  database: string;
}

interface ServiceDefinition {
  id: "studio" | "portal";
  label: string;
  port: number;
}

export function parseServicePort(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : fallback;
}

function serviceDefinitions(paths: HostPaths): ServiceDefinition[] {
  const env = readEnvFile(paths.envFile);
  return [
    { id: "studio", label: "UWE Studio", port: parseServicePort(env.STUDIO_PORT, 3000) },
    { id: "portal", label: "UWE Portal", port: parseServicePort(env.PORTAL_PORT, 3001) },
  ];
}

export function argumentValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function commandCenterDataRoot(): string {
  const configured = process.env.UWE_COMMAND_CENTER_DATA_DIR?.trim();
  if (configured) return path.resolve(configured);
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "UWE", "rtx-connector-client", "host");
  }
  return path.join(os.homedir(), ".local", "share", "UWE", "rtx-connector-client", "host");
}

export function resolveDesktopHostRoot(input?: string): string {
  const configured = input?.trim() || process.env.UWE_MONOREPO_ROOT?.trim();
  if (configured) return path.resolve(configured);

  let current = path.resolve(process.cwd());
  while (true) {
    if (
      fs.existsSync(path.join(current, "pnpm-workspace.yaml")) &&
      fs.existsSync(path.join(current, "apps", "studio")) &&
      fs.existsSync(path.join(current, "apps", "portal"))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(process.cwd());
    current = parent;
  }
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function pathsFor(root: string): HostPaths {
  const dataRoot = commandCenterDataRoot();
  return {
    root,
    dataRoot,
    data: path.join(dataRoot, "data"),
    uploads: path.join(dataRoot, "data", "uploads"),
    backups: path.join(dataRoot, "data", "backups"),
    exports: path.join(dataRoot, "exports"),
    logs: path.join(dataRoot, "logs"),
    runtime: path.join(dataRoot, "runtime"),
    envFile: path.join(root, ".env"),
    database: path.join(dataRoot, "data", "uwe.db"),
  };
}

function ensureHostDirectories(paths: HostPaths): void {
  for (const directory of [
    paths.dataRoot,
    paths.data,
    paths.uploads,
    paths.backups,
    paths.exports,
    paths.logs,
    paths.runtime,
  ]) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

export function buildLocalHostEnv(paths: HostPaths): string {
  const sessionSecret = randomBytes(48).toString("base64url");
  const setupToken = randomBytes(32).toString("base64url");
  const mediaSecret = randomBytes(48).toString("base64url");
  return [
    "# Managed initial local-host configuration for UWE Command Center.",
    "# Existing files are preserved and can be edited in Studio later.",
    "NODE_ENV=production",
    `SESSION_SECRET=${sessionSecret}`,
    `UWE_SETUP_TOKEN=${setupToken}`,
    `UWE_MEDIA_SIGNING_SECRET=${mediaSecret}`,
    "UWE_RUNTIME_ROLE=host",
    "RUN_DB_SEED=false",
    "AUTH_REQUIRED=true",
    "SESSION_COOKIE_SECURE=false",
    "SESSION_COOKIE_SAMESITE=lax",
    "TRUST_PROXY=false",
    "CLOUDFLARE_TUNNEL=false",
    "STUDIO_PORT=3000",
    "PORTAL_PORT=3001",
    "NEXT_PUBLIC_STUDIO_URL=http://127.0.0.1:3000",
    "PUBLIC_BASE_URL=http://127.0.0.1:3000",
    "NEXT_PUBLIC_PORTAL_URL=http://127.0.0.1:3001",
    "# Brain: owner-only, local/LAN, never tunneled (ADR 004/007).",
    "# Empty NEXT_PUBLIC_BRAIN_URL = share the Studio origin; entry is /life-brain.",
    "NEXT_PUBLIC_BRAIN_URL=",
    "BRAIN_PATH=/life-brain",
    "BRAIN_EXPOSURE=loopback",
    `DATABASE_URL=file:${toPosixPath(paths.database)}`,
    // Owner-private Brain DB lives next to uwe.db so both are found deterministically
    // (the Next standalone build can't reliably resolve brain-client's relative default).
    `BRAIN_DATABASE_URL=file:${toPosixPath(path.join(paths.data, "uwe-brain.db"))}`,
    `UWE_DATA_DIR=${toPosixPath(paths.data)}`,
    `UWE_UPLOADS_DIR=${toPosixPath(paths.uploads)}`,
    `UWE_BACKUP_DIR=${toPosixPath(paths.backups)}`,
    `UWE_EXPORT_DIR=${toPosixPath(paths.exports)}`,
    "AI_INFERENCE_ENABLED=true",
    "AI_INFERENCE_PROVIDER=ollama",
    "AI_INFERENCE_BASE_URL=http://127.0.0.1:11434",
    "AI_INFERENCE_ALLOW_PUBLIC_URL=false",
    "UWE_AI_CLOUD_FALLBACK=false",
    "BRAIN_EMBEDDINGS_ENABLED=true",
    "BRAIN_EMBEDDING_PROVIDER=ollama",
    "BRAIN_EMBEDDING_MODEL=nomic-embed-text",
    "",
  ].join("\n");
}

function ensureRequiredLocalEnv(paths: HostPaths): void {
  const content = fs.readFileSync(paths.envFile, "utf8");
  const env = readEnvFile(paths.envFile);
  const studioPort = parseServicePort(env.STUDIO_PORT, 3000);
  const publicBaseUrl = env.PUBLIC_BASE_URL?.trim() || `http://127.0.0.1:${studioPort}`;
  let loopback = false;
  try {
    const hostname = new URL(publicBaseUrl).hostname.toLowerCase();
    loopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    // The central environment validator reports malformed URLs with full context.
  }
  const defaults = [
    ["PUBLIC_BASE_URL", publicBaseUrl],
    ...(loopback ? [["TRUST_PROXY", "false"], ["CLOUDFLARE_TUNNEL", "false"]] : []),
  ];
  const missing = defaults.filter(([key]) => !new RegExp(`^${key}=`, "m").test(content));
  if (missing.length === 0) return;
  fs.appendFileSync(
    paths.envFile,
    `\n# Required runtime defaults for the local all-in-one host.\n${missing.map(([key, value]) => `${key}=${value}`).join("\n")}\n`,
    "utf8",
  );
  appendOperationLog(paths, `Fehlende lokale Laufzeitwerte ergänzt: ${missing.map(([key]) => key).join(", ")}.`);
}

function readEnvFile(envFile: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (!fs.existsSync(envFile)) return env;
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export function resolveDatabasePath(root: string, envFile: string, fallback: string): string {
  const value = readEnvFile(envFile).DATABASE_URL?.trim();
  if (!value?.startsWith("file:")) return fallback;
  const raw = value.slice("file:".length);
  if (/^[A-Za-z]:[\\/]/.test(raw) || path.isAbsolute(raw)) return path.normalize(raw);
  return path.resolve(root, "packages", "database", raw);
}

function validateRepo(root: string): boolean {
  return (
    fs.existsSync(path.join(root, "package.json")) &&
    fs.existsSync(path.join(root, "pnpm-lock.yaml")) &&
    fs.existsSync(path.join(root, "apps", "studio", "package.json")) &&
    fs.existsSync(path.join(root, "apps", "portal", "package.json"))
  );
}

function pidFile(paths: HostPaths, id: "studio" | "portal"): string {
  return path.join(paths.runtime, `${id}.pid`);
}

function readPid(file: string): number | null {
  try {
    const pid = Number.parseInt(fs.readFileSync(file, "utf8").trim(), 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function processRunning(pid: number | null): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

interface HealthProbe {
  responding: boolean;
  healthy: boolean;
}

async function probeHealth(url: string): Promise<HealthProbe> {
  try {
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2_500) });
    return { responding: true, healthy: response.ok };
  } catch {
    return { responding: false, healthy: false };
  }
}

async function health(url: string): Promise<boolean> {
  return (await probeHealth(url)).healthy;
}

async function waitForHealth(url: string, timeoutMs = 90_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await health(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

function runCapture(command: string, args: string[], cwd?: string): string | null {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 8_000,
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function gitFact(root: string, args: string[]): string | null {
  return validateRepo(root) ? runCapture("git", args, root) : null;
}

function gpuSnapshot(): DesktopHostStatus["gpu"] {
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

function diskSnapshot(root: string): { total: number | null; used: number | null } {
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

async function serviceStatus(paths: HostPaths, id: "studio" | "portal", label: string, port: number): Promise<DesktopHostService> {
  const url = `http://127.0.0.1:${port}`;
  const file = pidFile(paths, id);
  const storedPid = readPid(file);
  const running = processRunning(storedPid);
  const probe = await probeHealth(url);
  if (storedPid && !running) fs.rmSync(file, { force: true });
  return {
    id,
    label,
    ...deriveOwnedServiceState(running, probe.responding, probe.healthy),
    pid: running ? storedPid : null,
    url,
  };
}

export async function collectDesktopHostStatus(rootInput?: string): Promise<DesktopHostStatus> {
  const root = resolveDesktopHostRoot(rootInput);
  const paths = pathsFor(root);
  const repoReady = validateRepo(root);
  const envReady = fs.existsSync(paths.envFile);
  const database = resolveDatabasePath(root, paths.envFile, paths.database);
  const dependenciesReady = fs.existsSync(path.join(root, "node_modules", ".modules.yaml"));
  const buildReady =
    fs.existsSync(path.join(root, "apps", "studio", ".next", "BUILD_ID")) &&
    fs.existsSync(path.join(root, "apps", "portal", ".next", "BUILD_ID"));
  const databaseReady = fs.existsSync(database);
  const services = await Promise.all(
    serviceDefinitions(paths).map((service) => serviceStatus(paths, service.id, service.label, service.port)),
  );
  const installed = repoReady && dependenciesReady && envReady && databaseReady && buildReady;
  const allOnline = services.every((service) => service.healthy);
  const hasPortConflict = services.some((service) => service.state === "error");
  const disk = diskSnapshot(repoReady ? root : process.cwd());
  const cpus = os.cpus();
  const ramTotalBytes = os.totalmem();

  return {
    collectedAt: new Date().toISOString(),
    overall: !repoReady || hasPortConflict ? "error" : installed && allOnline ? "ready" : "attention",
    root,
    revision: gitFact(root, ["rev-parse", "--short", "HEAD"]),
    branch: gitFact(root, ["branch", "--show-current"]),
    installation: {
      repoReady,
      dependenciesReady,
      envReady,
      databaseReady,
      buildReady,
      message: !repoReady
        ? "UWE-Projektordner nicht gefunden."
        : installed
          ? "UWE ist vollständig eingerichtet."
          : "Einrichtung oder Reparatur erforderlich.",
    },
    host: {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      uptimeSeconds: Math.floor(os.uptime()),
      cpuModel: cpus[0]?.model ?? "Unbekannt",
      cpuCores: cpus.length,
      ramTotalBytes,
      ramUsedBytes: ramTotalBytes - os.freemem(),
      diskTotalBytes: disk.total,
      diskUsedBytes: disk.used,
    },
    gpu: gpuSnapshot(),
    services,
    dataDir: paths.data,
    logsDir: paths.logs,
  };
}

const MAX_LOG_BYTES = 5 * 1024 * 1024;

/** Rename a log to `.1` (keeping one prior generation) once it exceeds the cap. */
function rotateLogIfLarge(file: string): void {
  try {
    if (fs.statSync(file).size > MAX_LOG_BYTES) {
      fs.renameSync(file, `${file}.1`);
    }
  } catch {
    // Missing/not-yet-created log — nothing to rotate.
  }
}

/** Append to a host log, rotating first so append-only logs cannot grow unbounded. */
function appendToLog(file: string, text: string): void {
  rotateLogIfLarge(file);
  fs.appendFileSync(file, text, "utf8");
}

/** Read only the tail of a log (last ~64 KB) instead of loading the whole file. */
function readLogTail(file: string, maxLines: number): string[] {
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

function appendOperationLog(paths: HostPaths, line: string): void {
  ensureHostDirectories(paths);
  appendToLog(path.join(paths.logs, "command-center.log"), `[${new Date().toISOString()}] ${line}\n`);
}

function pnpmCommand(args: string[]): { command: string; args: string[] } {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", "corepack", "pnpm", ...args],
    };
  }
  return { command: "corepack", args: ["pnpm", ...args] };
}

function workspaceCommandEnv(paths: HostPaths, extraEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...readEnvFile(paths.envFile), ...extraEnv };
  env.CI ??= "true";
  env.TURBO_DAEMON ??= "false";
  env.NEXT_TELEMETRY_DISABLED ??= "1";
  const shimDirectory = path.join(paths.runtime, "bin");
  fs.mkdirSync(shimDirectory, { recursive: true });
  if (process.platform === "win32") {
    fs.writeFileSync(
      path.join(shimDirectory, "pnpm.cmd"),
      "@echo off\r\ncorepack pnpm %*\r\n",
      "utf8",
    );
  } else {
    const shim = path.join(shimDirectory, "pnpm");
    fs.writeFileSync(shim, "#!/bin/sh\nexec corepack pnpm \"$@\"\n", "utf8");
    fs.chmodSync(shim, 0o755);
  }
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
  env[pathKey] = `${shimDirectory}${path.delimiter}${env[pathKey] ?? ""}`;
  return env;
}

function runWorkspaceCommand(paths: HostPaths, label: string, args: string[], extraEnv: NodeJS.ProcessEnv = {}): void {
  const command = pnpmCommand(args);
  appendOperationLog(paths, `${label} gestartet.`);
  const result = spawnSync(command.command, command.args, {
    cwd: paths.root,
    env: workspaceCommandEnv(paths, extraEnv),
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (output) appendToLog(path.join(paths.logs, "command-center.log"), `${output}\n`);
  if (result.status !== 0) {
    const tail = output.split(/\r?\n/).slice(-12).join("\n");
    throw new Error(`${label} fehlgeschlagen.${tail ? `\n${tail}` : ""}`);
  }
  appendOperationLog(paths, `${label} abgeschlossen.`);
}

export async function setupHost(
  rootInput?: string,
  options: { ownProgress?: boolean } = {},
): Promise<DesktopHostActionResult> {
  const root = resolveDesktopHostRoot(rootInput);
  const paths = pathsFor(root);
  if (!validateRepo(root)) {
    return { ok: false, message: `Kein vollständiges UWE-Repository unter ${root}.`, status: await collectDesktopHostStatus(root) };
  }
  ensureHostDirectories(paths);
  if (!fs.existsSync(paths.envFile)) {
    fs.writeFileSync(paths.envFile, buildLocalHostEnv(paths), { encoding: "utf8", flag: "wx" });
    appendOperationLog(paths, "Sichere lokale .env angelegt.");
  }
  ensureRequiredLocalEnv(paths);
  const database = resolveDatabasePath(root, paths.envFile, paths.database);
  const seedPendingFile = path.join(paths.runtime, "seed-pending");
  const freshDatabase = !fs.existsSync(database);
  const seedRequired = freshDatabase || fs.existsSync(seedPendingFile);
  if (freshDatabase) {
    fs.mkdirSync(path.dirname(database), { recursive: true });
    fs.closeSync(fs.openSync(database, "wx"));
    fs.writeFileSync(seedPendingFile, new Date().toISOString(), "utf8");
    appendOperationLog(paths, "Leere SQLite-Datei für Prisma unter Windows angelegt.");
  }

  // Ordered, fixed-length step list so the progress bar has a stable total
  // (HOST_SETUP_STEP_COUNT). The seed step is always present in the sequence but
  // only runs when a fresh/pending database needs it — the bar still advances so
  // "how far are we" stays truthful across both first-run and repair setups.
  const steps: Array<{ phase: string; label: string; run: () => void }> = [
    { phase: "install", label: "Abhängigkeiten installieren", run: () => runWorkspaceCommand(paths, "Abhängigkeiten", ["install", "--frozen-lockfile"]) },
    { phase: "prisma", label: "Prisma-Client generieren", run: () => runWorkspaceCommand(paths, "Prisma Client", ["--filter", "@uwe/database", "db:generate"]) },
    { phase: "migrate", label: "Datenbank migrieren", run: () => runWorkspaceCommand(paths, "Datenbankmigration", ["--filter", "@uwe/database", "db:deploy"]) },
    { phase: "migrate-brain", label: "Brain-Datenbank migrieren", run: () => runWorkspaceCommand(paths, "Brain-Datenbankmigration", ["--filter", "@uwe/database", "db:deploy:brain"]) },
    {
      phase: "seed",
      label: "Demo-Grundbestand einspielen",
      run: () => {
        if (!seedRequired) return;
        runWorkspaceCommand(paths, "Demo-Grundbestand", ["--filter", "@uwe/database", "db:seed"], { UWE_ALLOW_PROD_SEED: "1" });
        fs.rmSync(seedPendingFile, { force: true });
      },
    },
    {
      phase: "connector",
      label: "Lokalen RTX-Connector einrichten",
      run: () => runWorkspaceCommand(
        paths,
        "Lokaler RTX-Connector",
        ["exec", "tsx", "tools/uwe-host-command-center/src/provision-local-connector.ts", "--root", root],
        { UWE_COMMAND_CENTER_DATA_DIR: paths.dataRoot },
      ),
    },
    { phase: "studio-build", label: "Studio-Produktions-Build", run: () => runWorkspaceCommand(paths, "Studio Produktions-Build", ["--filter", "@uwe/studio", "build"]) },
    { phase: "portal-build", label: "Portal-Produktions-Build", run: () => runWorkspaceCommand(paths, "Portal Produktions-Build", ["--filter", "@uwe/portal", "build"]) },
  ];

  if (options.ownProgress ?? true) beginHostProgress(steps.length);
  for (const step of steps) {
    reportHostStep(step.phase, step.label);
    step.run();
  }

  return { ok: true, message: "UWE wurde vollständig eingerichtet und ist startklar.", status: await collectDesktopHostStatus(root) };
}

function spawnService(paths: HostPaths, service: ServiceDefinition): number {
  const appRoot = path.join(paths.root, "apps", service.id);
  const nextCli = path.join(appRoot, "node_modules", "next", "dist", "bin", "next");
  if (!fs.existsSync(nextCli)) throw new Error(`Next.js-Startdatei für ${service.label} fehlt.`);
  const logFile = path.join(paths.logs, `${service.id}.log`);
  rotateLogIfLarge(logFile);
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${service.label} wird gestartet.\n`, "utf8");
  const output = fs.openSync(logFile, "a");
  const env = readEnvFile(paths.envFile);
  const databaseModules = path.join(paths.root, "packages", "database", "node_modules");
  env.NODE_PATH = [databaseModules, env.NODE_PATH].filter(Boolean).join(path.delimiter);
  const child = spawn(process.execPath, [nextCli, "start", "--port", String(service.port)], {
    cwd: appRoot,
    env,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", output, output],
  });
  fs.closeSync(output);
  if (!child.pid) throw new Error(`${service.label} konnte nicht gestartet werden.`);
  fs.writeFileSync(pidFile(paths, service.id), String(child.pid), "utf8");
  child.unref();
  return child.pid;
}

export async function startHost(rootInput?: string): Promise<DesktopHostActionResult> {
  const root = resolveDesktopHostRoot(rootInput);
  const paths = pathsFor(root);
  const before = await collectDesktopHostStatus(root);
  const conflicts = before.services.filter((service) => service.state === "error");
  if (conflicts.length > 0) {
    return {
      ok: false,
      message: `Start blockiert: Ports für ${conflicts.map((service) => service.label).join(", ")} sind bereits durch fremde Prozesse belegt.`,
      status: before,
    };
  }
  if (!before.installation.buildReady || !before.installation.databaseReady || !before.installation.envReady) {
    return { ok: false, message: "UWE ist noch nicht vollständig eingerichtet. Bitte zuerst Einrichten / Reparieren ausführen.", status: before };
  }
  ensureHostDirectories(paths);
  const definitions = serviceDefinitions(paths);
  for (const service of definitions) {
    const current = before.services.find((entry) => entry.id === service.id);
    if (!current?.healthy && !processRunning(readPid(pidFile(paths, service.id)))) spawnService(paths, service);
  }
  const readiness = await Promise.all(definitions.map((service) => waitForHealth(`http://127.0.0.1:${service.port}`)));
  const status = await collectDesktopHostStatus(root);
  const ok = readiness.every(Boolean);
  return { ok, message: ok ? "Studio und Portal laufen." : "Mindestens ein Dienst wurde gestartet, ist aber noch nicht erreichbar. Bitte Logs prüfen.", status };
}

function stopProcess(pid: number): void {
  if (!processRunning(pid)) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
  } else {
    try { process.kill(-pid, "SIGTERM"); } catch { process.kill(pid, "SIGTERM"); }
  }
}

export async function stopHost(rootInput?: string): Promise<DesktopHostActionResult> {
  const root = resolveDesktopHostRoot(rootInput);
  const paths = pathsFor(root);
  for (const service of serviceDefinitions(paths)) {
    const file = pidFile(paths, service.id);
    const pid = readPid(file);
    if (pid) stopProcess(pid);
    fs.rmSync(file, { force: true });
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { ok: true, message: "Studio und Portal wurden gestoppt.", status: await collectDesktopHostStatus(root) };
}

export async function backupHost(rootInput?: string): Promise<DesktopHostActionResult> {
  const root = resolveDesktopHostRoot(rootInput);
  const paths = pathsFor(root);
  if (!validateRepo(root)) return { ok: false, message: "UWE-Repository nicht gefunden.", status: await collectDesktopHostStatus(root) };
  ensureHostDirectories(paths);
  runWorkspaceCommand(paths, "Backup", ["backup:create"]);
  return { ok: true, message: `Backup wurde unter ${paths.backups} erstellt.`, status: await collectDesktopHostStatus(root) };
}

export function readLogs(rootInput: string | undefined, target: string | undefined): { target: string; lines: string[] } {
  const paths = pathsFor(resolveDesktopHostRoot(rootInput));
  const safeTarget = target === "studio" || target === "portal" ? target : "command-center";
  const file = path.join(paths.logs, `${safeTarget}.log`);
  if (!fs.existsSync(file)) return { target: safeTarget, lines: [] };
  return { target: safeTarget, lines: readLogTail(file, 200) };
}

export function desktopHostTargetUrl(rootInput: string | undefined, target: string | undefined): string {
  const paths = pathsFor(resolveDesktopHostRoot(rootInput));
  const env = readEnvFile(paths.envFile);
  const port = target === "portal"
    ? parseServicePort(env.PORTAL_PORT, 3001)
    : parseServicePort(env.STUDIO_PORT, 3000);
  return `http://127.0.0.1:${port}`;
}

export function openTarget(rootInput: string | undefined, target: string | undefined): void {
  const url = desktopHostTargetUrl(rootInput, target);
  if (process.platform === "win32") {
    spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "start", "", url], { detached: true, windowsHide: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  }
}
