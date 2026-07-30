import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { beginHostProgress, reportHostStep } from "./desktop-host-progress.ts";
import {
  appendOperationLog,
  detectHostMode,
  ensureHostDirectories,
  pathsFor,
  pidFile,
  resolveDesktopHostRoot,
} from "./desktop-host-paths.ts";
import {
  adoptOrphanService,
  classifyPortHolder,
  releaseOwnPort,
  type PortHolder,
} from "./desktop-host-ports.ts";
import {
  appendToLog,
  deriveOwnedServiceState,
  diskSnapshot,
  gpuSnapshot,
  openExternalUrl,
  pnpmCommand,
  probeHealth,
  processRunning,
  readLogTail,
  readPid,
  rotateLogIfLarge,
  runCapture,
  stopProcess,
  waitForHealth,
} from "./desktop-host-system.ts";

export { deriveOwnedServiceState } from "./desktop-host-system.ts";
export {
  bundleInstallRoot,
  commandCenterDataRoot,
  detectHostMode,
  resolveDesktopHostRoot,
  type HostMode,
} from "./desktop-host-paths.ts";

import {
  HOST_SERVICE_IDS,
  HOST_SERVICE_LABELS,
  isHostServiceId,
  isOwnServiceApp,
  parseServicePort,
  SERVICE_PORT_ENV,
  type DesktopHostActionResult,
  type DesktopHostService,
  type DesktopHostStatus,
  type HostBackupEntry,
  type HostPaths,
  type HostServiceId,
  type ServiceDefinition,
} from "./desktop-host-types.ts";
import {
  readInstallSelectionState,
  writeInstallSelection,
  type InstallSelection,
  type InstallSelectionState,
} from "./install-selection.ts";
import { buildSetupPlan } from "./setup-plan.ts";
import {
  applySelectedPorts,
  buildLocalHostEnv,
  ensureRequiredLocalEnv,
  readEnvFile,
  resolveDatabasePath,
} from "./host-env-file.ts";

export { buildLocalHostEnv, resolveDatabasePath } from "./host-env-file.ts";

export type {
  DesktopHostActionResult,
  DesktopHostService,
  DesktopHostStatus,
  HostBackupEntry,
  HostPaths,
  HostServiceId,
  ServiceDefinition,
  ServiceState,
} from "./desktop-host-types.ts";
export {
  HOST_SERVICE_HEALTH_APPS,
  HOST_SERVICE_IDS,
  HOST_SERVICE_LABELS,
  isHostServiceId,
  isOwnServiceApp,
  parseServicePort,
} from "./desktop-host-types.ts";
export {
  defaultInstallSelection,
  readInstallSelection,
  readInstallSelectionState,
  type InstallSelection,
  type InstallSelectionState,
} from "./install-selection.ts";
export { buildSetupPlan, setupStepCount } from "./setup-plan.ts";

/**
 * Die Dienste **dieser** Installation mit ihren konfigurierten Ports. Ports
 * kommen aus der `.env` des Projektordners, die Auswahl aus der Assistenten-
 * Wahl neben den Host-Daten. Nicht gewählte Apps tauchen dadurch weder im
 * Status noch beim Start auf — sonst meldete eine Brain-lose Installation
 * dauerhaft „Brain gestoppt" und käme nie auf `buildReady`.
 */
function serviceDefinitions(paths: HostPaths, apps?: readonly HostServiceId[]): ServiceDefinition[] {
  const env = readEnvFile(paths.envFile);
  const selected = apps ?? readInstallSelectionState(paths.dataRoot).selection.apps;
  return HOST_SERVICE_IDS.filter((id) => selected.includes(id)).map((id) => ({
    id,
    label: HOST_SERVICE_LABELS[id],
    port: parseServicePort(env[SERVICE_PORT_ENV[id].key], SERVICE_PORT_ENV[id].fallback),
  }));
}

/** Die Auswahl dieser Installation (Vorgabe „alles", solange keine Datei existiert). */
export function getInstallSelection(rootInput?: string): InstallSelectionState {
  return readInstallSelectionState(pathsFor(resolveDesktopHostRoot(rootInput)).dataRoot);
}

/** Schreibt die Auswahl des Ersteinrichtungs-Assistenten. */
export function setInstallSelection(rootInput: string | undefined, input: unknown): InstallSelection {
  const paths = pathsFor(resolveDesktopHostRoot(rootInput));
  ensureHostDirectories(paths);
  const selection = writeInstallSelection(paths.dataRoot, input);
  appendOperationLog(paths, `App-Auswahl gespeichert: ${selection.apps.join(", ")}.`);
  return selection;
}

export function argumentValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function validateRepo(root: string): boolean {
  return (
    fs.existsSync(path.join(root, "package.json")) &&
    fs.existsSync(path.join(root, "pnpm-lock.yaml")) &&
    fs.existsSync(path.join(root, "apps", "studio", "package.json")) &&
    fs.existsSync(path.join(root, "apps", "portal", "package.json"))
  );
}

function gitFact(root: string, args: string[]): string | null {
  return validateRepo(root) ? runCapture("git", args, root) : null;
}

async function serviceStatus(paths: HostPaths, id: HostServiceId, label: string, port: number): Promise<DesktopHostService> {
  const url = `http://127.0.0.1:${port}`;
  const file = pidFile(paths, id);
  const storedPid = readPid(file);
  const probe = await probeHealth(url);
  let running = processRunning(storedPid);
  let pid = running ? storedPid : null;
  if (storedPid && !running) fs.rmSync(file, { force: true });

  // Antwortet der Port als genau diese App, ohne dass wir eine PID-Datei
  // haben, ist es ein Rest von uns: wieder übernehmen statt als „fremd" zu
  // melden — sonst bliebe der Dienst für Stopp und Neustart unerreichbar.
  const orphan = !running && probe.responding && isOwnServiceApp(id, probe.app);
  if (orphan) {
    const adopted = adoptOrphanService(paths, id, port);
    if (adopted) {
      running = true;
      pid = adopted;
    }
  }

  const derived = deriveOwnedServiceState(running, probe.responding, probe.healthy);
  return {
    id,
    label,
    ...derived,
    message:
      orphan && !running
        ? "Rest einer früheren Sitzung belegt den Port. „Alles starten“ beendet ihn und startet neu."
        : derived.message,
    pid,
    url,
  };
}

export async function collectDesktopHostStatus(rootInput?: string): Promise<DesktopHostStatus> {
  const root = resolveDesktopHostRoot(rootInput);
  const paths = pathsFor(root);
  const mode = detectHostMode(root);
  const envReady = fs.existsSync(paths.envFile);
  const database = resolveDatabasePath(root, paths.envFile, paths.database);
  const { selection, persisted } = readInstallSelectionState(paths.dataRoot);

  // Bereitschaft je nach Installationsart: Ein Monorepo-Checkout ist fertig,
  // wenn Workspace, node_modules und die Builds der gewählten Apps stehen.
  // Eine Bundle-Installation bringt pro App ein fertiges Laufzeitverzeichnis
  // mit — dort zählt, dass die entpackten Bundles vollständig sind; ein
  // Workspace oder ein pnpm-Install existiert nie.
  let repoReady: boolean;
  let dependenciesReady: boolean;
  let buildReady: boolean;
  if (mode === "bundle") {
    const bundledApps = selection.apps.filter((app) =>
      fs.existsSync(path.join(root, "apps", app, "package.json")),
    );
    repoReady = bundledApps.length > 0;
    dependenciesReady =
      repoReady &&
      bundledApps.every((app) => fs.existsSync(path.join(root, "apps", app, "node_modules", "next")));
    buildReady =
      repoReady &&
      bundledApps.every((app) => fs.existsSync(path.join(root, "apps", app, ".next", "BUILD_ID")));
  } else {
    repoReady = validateRepo(root);
    dependenciesReady = fs.existsSync(path.join(root, "node_modules", ".modules.yaml"));
    // Nur die gewählten Apps zählen: eine Installation ohne Family darf nicht an
    // einem fehlenden Family-Build hängen bleiben.
    buildReady = selection.apps.every((app) =>
      fs.existsSync(path.join(root, "apps", app, ".next", "BUILD_ID")),
    );
  }
  const databaseReady = fs.existsSync(database);
  const services = await Promise.all(
    serviceDefinitions(paths, selection.apps).map((service) =>
      serviceStatus(paths, service.id, service.label, service.port),
    ),
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
      apps: selection.apps,
      selectionPersisted: persisted,
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
  options: { ownProgress?: boolean; selection?: unknown } = {},
): Promise<DesktopHostActionResult> {
  const root = resolveDesktopHostRoot(rootInput);
  const paths = pathsFor(root);
  if (!validateRepo(root)) {
    return { ok: false, message: `Kein vollständiges UWE-Repository unter ${root}.`, status: await collectDesktopHostStatus(root) };
  }
  ensureHostDirectories(paths);
  // Eine mitgegebene Auswahl (Ersteinrichtungs-Assistent) wird zuerst
  // festgeschrieben, damit Status, Start und ein späteres „Reparieren" ohne
  // erneutes Nachfragen denselben Umfang sehen.
  const selection = options.selection
    ? writeInstallSelection(paths.dataRoot, options.selection)
    : readInstallSelectionState(paths.dataRoot).selection;
  if (!fs.existsSync(paths.envFile)) {
    // Die Ports der Auswahl gehören schon in die frisch geschriebene Datei —
    // sonst stünden die Loopback-URLs daneben auf den Standardports.
    fs.writeFileSync(paths.envFile, buildLocalHostEnv(paths, selection.ports), {
      encoding: "utf8",
      flag: "wx",
    });
    appendOperationLog(paths, "Sichere lokale .env angelegt.");
  }
  ensureRequiredLocalEnv(paths, (line) => appendOperationLog(paths, line));
  // Bestehende Installation: gewählte Ports nachziehen (zweiter Lauf des
  // Assistenten, „Reparieren"). Bei einer eben angelegten .env ein No-op.
  applySelectedPorts(paths, selection.ports, (line) => appendOperationLog(paths, line));
  const database = resolveDatabasePath(root, paths.envFile, paths.database);
  const seedPendingFile = path.join(paths.runtime, "seed-pending");
  const freshDatabase = !fs.existsSync(database);
  const seedRequired = freshDatabase || fs.existsSync(seedPendingFile);
  if (freshDatabase) {
    fs.mkdirSync(path.dirname(database), { recursive: true });
    fs.closeSync(fs.openSync(database, "wx"));
    appendOperationLog(paths, "Leere SQLite-Datei für Prisma unter Windows angelegt.");
  }
  // Die Vormerkung existiert für den Fall, dass die Einrichtung nach dem Anlegen
  // der leeren Datei abbricht — der nächste Lauf holt den Seed dann nach. Ohne
  // gewählte Demo-Inhalte gibt es nichts vorzumerken, sonst bliebe die Datei für
  // immer liegen und ein späteres Ja würde in eine längst gefüllte DB seeden.
  if (freshDatabase && selection.seedDemoContent) {
    fs.writeFileSync(seedPendingFile, new Date().toISOString(), "utf8");
  } else if (!selection.seedDemoContent) {
    fs.rmSync(seedPendingFile, { force: true });
  }

  // Der Plan kennt Reihenfolge und Länge (= Total des Fortschrittsbalkens); hier
  // wird er nur noch ausgeführt. Der Seed-Schritt steht fest in der Liste, läuft
  // aber nur bei frischer oder vorgemerkter Datenbank — der Balken rückt trotzdem
  // vor, damit „wie weit sind wir" bei Erst- und Reparatureinrichtung gleich
  // ehrlich bleibt.
  const steps = buildSetupPlan(selection, { root, dataRoot: paths.dataRoot });

  if (options.ownProgress ?? true) beginHostProgress(steps.length);
  for (const step of steps) {
    reportHostStep(step.phase, step.label);
    if (step.kind === "seed" && !seedRequired) continue;
    runWorkspaceCommand(paths, step.logLabel, step.args, step.env ?? {});
    if (step.kind === "seed") fs.rmSync(seedPendingFile, { force: true });
  }

  const installed = selection.apps.map((app) => HOST_SERVICE_LABELS[app]).join(", ");
  return {
    ok: true,
    message: `UWE wurde eingerichtet und ist startklar: ${installed}.`,
    status: await collectDesktopHostStatus(root),
  };
}

function spawnService(paths: HostPaths, service: ServiceDefinition): number {
  const appRoot = path.join(paths.root, "apps", service.id);
  const logFile = path.join(paths.logs, `${service.id}.log`);
  rotateLogIfLarge(logFile);
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${service.label} wird gestartet.\n`, "utf8");
  const output = fs.openSync(logFile, "a");
  const env = readEnvFile(paths.envFile);
  const databaseModules = path.join(paths.root, "packages", "database", "node_modules");
  env.NODE_PATH = [databaseModules, env.NODE_PATH].filter(Boolean).join(path.delimiter);

  // Brain is owner-private and Family is checkbox-gated household data: bind both
  // to loopback so they are reachable only locally or through the Cloudflare
  // tunnel — never directly on the LAN. Studio, Portal and the landing page keep
  // the default bind.
  const loopbackOnly = service.id === "brain" || service.id === "family";

  // Zwei Startwege, in dieser Reihenfolge:
  //
  // 1. Standalone-Server (Monorepo-Checkout nach `pnpm build:release`): dasselbe
  //    Muster wie deploy/scripts/start-uwe.sh. Seit Next 16 ist das im Checkout
  //    der EINZIGE funktionierende Weg — `next start` externalisiert dort
  //    @prisma/* und findet es im isolated-Layout von pnpm nicht mehr
  //    (Cannot find module '@prisma/adapter-libsql').
  // 2. `next start` im App-Root: der Weg der Bundle-Installation. Deren
  //    node_modules ist flach (hoisted, ohne Symlinks), dort löst Next 16 die
  //    externalisierten Pakete auf.
  const standaloneDir = path.join(appRoot, ".next", "standalone");
  const standaloneServer = path.join(standaloneDir, "apps", service.id, "server.js");
  let spawnArgs: string[];
  let spawnCwd: string;
  if (fs.existsSync(standaloneServer)) {
    env.PORT = String(service.port);
    env.HOSTNAME = loopbackOnly ? "127.0.0.1" : "0.0.0.0";
    spawnArgs = [path.join("apps", service.id, "server.js")];
    spawnCwd = standaloneDir;
  } else {
    const nextCli = path.join(appRoot, "node_modules", "next", "dist", "bin", "next");
    if (!fs.existsSync(nextCli)) {
      throw new Error(
        `Startdateien für ${service.label} fehlen: weder ${standaloneServer} noch ${nextCli}.`,
      );
    }
    spawnArgs = [nextCli, "start", "--port", String(service.port)];
    if (loopbackOnly) spawnArgs.push("--hostname", "127.0.0.1");
    spawnCwd = appRoot;
  }

  const child = spawn(process.execPath, spawnArgs, {
    cwd: spawnCwd,
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
  const definitions = serviceDefinitions(paths);

  // Belegte Ports sortieren, statt jeden Konflikt für fremd zu halten: Reste
  // eigener Dienste räumen wir gleich selbst weg (sie waren über kein Bedienelement
  // mehr erreichbar), wirklich fremde Dienste blockieren den Start wie bisher.
  const holders = (await Promise.all(definitions.map((service) => classifyPortHolder(paths, service))))
    .filter((entry): entry is PortHolder => entry !== null);
  const foreign = holders.filter((entry) => entry.kind === "foreign");
  if (foreign.length > 0) {
    return {
      ok: false,
      message: `Start blockiert: Ports für ${foreign.map((entry) => entry.service.label).join(", ")} sind bereits durch fremde Prozesse belegt.`,
      status: before,
    };
  }
  if (!before.installation.buildReady || !before.installation.databaseReady || !before.installation.envReady) {
    return { ok: false, message: "UWE ist noch nicht vollständig eingerichtet. Bitte zuerst Einrichten / Reparieren ausführen.", status: before };
  }
  ensureHostDirectories(paths);

  const stuck: string[] = [];
  for (const entry of holders) {
    if (!(await releaseOwnPort(paths, entry.service))) stuck.push(entry.service.label);
  }
  if (stuck.length > 0) {
    return {
      ok: false,
      message: `Start blockiert: Reste einer früheren Sitzung auf den Ports für ${stuck.join(", ")} ließen sich nicht beenden. Bitte das Command Center neu starten.`,
      status: await collectDesktopHostStatus(root),
    };
  }

  for (const service of definitions) {
    const current = before.services.find((entry) => entry.id === service.id);
    if (!current?.healthy && !processRunning(readPid(pidFile(paths, service.id)))) spawnService(paths, service);
  }
  const readiness = await Promise.all(definitions.map((service) => waitForHealth(`http://127.0.0.1:${service.port}`)));
  const status = await collectDesktopHostStatus(root);
  const ok = readiness.every(Boolean);
  return {
    ok,
    message: ok
      ? `${definitions.map((service) => service.label).join(", ")} ${definitions.length === 1 ? "läuft" : "laufen"}.`
      : "Mindestens ein Dienst wurde gestartet, ist aber noch nicht erreichbar. Bitte Logs prüfen.",
    status,
  };
}

export async function stopHost(rootInput?: string): Promise<DesktopHostActionResult> {
  const root = resolveDesktopHostRoot(rootInput);
  const paths = pathsFor(root);
  // Bewusst über ALLE bekannten Dienste, nicht nur die gewählten: wer eine App
  // nachträglich abwählt, soll ihren noch laufenden Prozess trotzdem loswerden.
  for (const id of HOST_SERVICE_IDS) {
    const file = pidFile(paths, id);
    const pid = readPid(file);
    if (pid) stopProcess(pid);
    fs.rmSync(file, { force: true });
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  // Und dann noch die Reste ohne PID-Datei: sonst bleibt eine Leiche aus einer
  // früheren Sitzung auf ihrem Port liegen, und „Alles stoppen" — der einzige
  // Knopf, der sie loswerden könnte — läuft an ihr vorbei.
  for (const service of serviceDefinitions(paths, HOST_SERVICE_IDS)) {
    await releaseOwnPort(paths, service);
  }
  return { ok: true, message: "Alle UWE-Dienste wurden gestoppt.", status: await collectDesktopHostStatus(root) };
}

/** Start a single host service (studio | portal | brain | family | landing) without touching the others. */
export async function startHostService(rootInput: string | undefined, serviceId: string): Promise<DesktopHostActionResult> {
  const root = resolveDesktopHostRoot(rootInput);
  const paths = pathsFor(root);
  const def = serviceDefinitions(paths).find((service) => service.id === serviceId);
  if (!def) return { ok: false, message: `Unbekannter Dienst: ${serviceId}`, status: await collectDesktopHostStatus(root) };
  const before = await collectDesktopHostStatus(root);
  if (!before.installation.buildReady) {
    return { ok: false, message: "UWE ist noch nicht vollständig eingerichtet.", status: before };
  }
  ensureHostDirectories(paths);
  const holder = await classifyPortHolder(paths, def);
  if (holder?.kind === "foreign") {
    return { ok: false, message: `Start blockiert: Port ${def.port} ist durch einen fremden Dienst belegt.`, status: before };
  }
  if (holder && !(await releaseOwnPort(paths, def))) {
    return {
      ok: false,
      message: `Start blockiert: Ein Rest einer früheren Sitzung hält Port ${def.port} und ließ sich nicht beenden.`,
      status: await collectDesktopHostStatus(root),
    };
  }
  if (!processRunning(readPid(pidFile(paths, def.id)))) spawnService(paths, def);
  const healthy = await waitForHealth(`http://127.0.0.1:${def.port}`);
  return {
    ok: healthy,
    message: healthy ? `${def.label} läuft.` : `${def.label} wurde gestartet, ist aber noch nicht erreichbar. Bitte Logs prüfen.`,
    status: await collectDesktopHostStatus(root),
  };
}

/** Stop a single host service without touching the others. */
export async function stopHostService(rootInput: string | undefined, serviceId: string): Promise<DesktopHostActionResult> {
  const root = resolveDesktopHostRoot(rootInput);
  const paths = pathsFor(root);
  // Über alle bekannten Dienste — auch eine nachträglich abgewählte App muss
  // sich noch stoppen lassen.
  const def = serviceDefinitions(paths, HOST_SERVICE_IDS).find((service) => service.id === serviceId);
  if (!def) return { ok: false, message: `Unbekannter Dienst: ${serviceId}`, status: await collectDesktopHostStatus(root) };
  const file = pidFile(paths, def.id);
  const pid = readPid(file);
  if (pid) stopProcess(pid);
  fs.rmSync(file, { force: true });
  await new Promise((resolve) => setTimeout(resolve, 300));
  await releaseOwnPort(paths, def); // Rest ohne PID-Datei gleich mit einsammeln
  return { ok: true, message: `${def.label} wurde gestoppt.`, status: await collectDesktopHostStatus(root) };
}

export async function backupHost(rootInput?: string): Promise<DesktopHostActionResult> {
  const root = resolveDesktopHostRoot(rootInput);
  const paths = pathsFor(root);
  if (!validateRepo(root)) return { ok: false, message: "UWE-Repository nicht gefunden.", status: await collectDesktopHostStatus(root) };
  ensureHostDirectories(paths);
  runWorkspaceCommand(paths, "Backup", ["backup:create"]);
  return { ok: true, message: `Backup wurde unter ${paths.backups} erstellt.`, status: await collectDesktopHostStatus(root) };
}

/** List the `.zip` backups in the host backup directory, newest first. */
export function listBackups(rootInput?: string): { backups: HostBackupEntry[] } {
  const paths = pathsFor(resolveDesktopHostRoot(rootInput));
  if (!fs.existsSync(paths.backups)) return { backups: [] };
  const backups = fs
    .readdirSync(paths.backups)
    .filter((name) => name.toLowerCase().endsWith(".zip"))
    .map((name) => {
      const stat = fs.statSync(path.join(paths.backups, name));
      return { name, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { backups };
}

/** Restore a backup zip from the host backup directory (name only — no path traversal). */
export async function restoreBackup(rootInput: string | undefined, name: string): Promise<DesktopHostActionResult> {
  const root = resolveDesktopHostRoot(rootInput);
  const paths = pathsFor(root);
  const safe = path.basename(name ?? "");
  const file = path.join(paths.backups, safe);
  if (!safe.toLowerCase().endsWith(".zip") || !fs.existsSync(file)) {
    return { ok: false, message: `Backup nicht gefunden: ${safe}`, status: await collectDesktopHostStatus(root) };
  }
  try {
    runWorkspaceCommand(paths, "Backup-Restore", ["exec", "tsx", "packages/backup/src/cli-restore.ts", file]);
    return { ok: true, message: `Backup „${safe}" wurde wiederhergestellt.`, status: await collectDesktopHostStatus(root) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Restore fehlgeschlagen: ${message}`, status: await collectDesktopHostStatus(root) };
  }
}

export function readLogs(rootInput: string | undefined, target: string | undefined): { target: string; lines: string[] } {
  const paths = pathsFor(resolveDesktopHostRoot(rootInput));
  const safeTarget =
    isHostServiceId(target) ? target : "command-center";
  const file = path.join(paths.logs, `${safeTarget}.log`);
  if (!fs.existsSync(file)) return { target: safeTarget, lines: [] };
  return { target: safeTarget, lines: readLogTail(file, 200) };
}

/**
 * Port- und Origin-Variable je Dienst. Die Startseite hat keine eigene
 * NEXT_PUBLIC_*-Variable: sie *ist* der Apex-Origin, den PUBLIC_BASE_URL nennt.
 */
const TARGET_ENV_KEYS: Record<HostServiceId, { portKey: string; portFallback: number; urlKey: string }> = {
  studio: { portKey: "STUDIO_PORT", portFallback: 3000, urlKey: "NEXT_PUBLIC_STUDIO_URL" },
  portal: { portKey: "PORTAL_PORT", portFallback: 3001, urlKey: "NEXT_PUBLIC_PORTAL_URL" },
  brain: { portKey: "BRAIN_PORT", portFallback: 3102, urlKey: "NEXT_PUBLIC_BRAIN_URL" },
  family: { portKey: "FAMILY_PORT", portFallback: 3004, urlKey: "NEXT_PUBLIC_FAMILY_URL" },
  landing: { portKey: "LANDING_PORT", portFallback: 3103, urlKey: "PUBLIC_BASE_URL" },
};

export function desktopHostTargetUrl(rootInput: string | undefined, target: string | undefined): string {
  const paths = pathsFor(resolveDesktopHostRoot(rootInput));
  const env = readEnvFile(paths.envFile);
  const keys = TARGET_ENV_KEYS[isHostServiceId(target) ? target : "studio"];
  const port = parseServicePort(env[keys.portKey], keys.portFallback);
  // Prefer the configured public origin (Cloudflare tunnel) when it is a real
  // non-loopback URL. With a domain-scoped session cookie (SESSION_COOKIE_DOMAIN),
  // a raw 127.0.0.1 origin can't hold the login session, so opening the public
  // hostname keeps the owner logged in. Falls back to loopback for local-only
  // deployments where no public URL is set.
  const publicUrl = env[keys.urlKey]?.trim();
  if (publicUrl) {
    try {
      const parsed = new URL(publicUrl);
      const host = parsed.hostname.toLowerCase();
      if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") {
        return publicUrl.replace(/\/$/, "");
      }
    } catch {
      // Malformed configured URL — fall back to loopback below.
    }
  }
  return `http://127.0.0.1:${port}`;
}

export function openTarget(rootInput: string | undefined, target: string | undefined): void {
  openExternalUrl(desktopHostTargetUrl(rootInput, target));
}
