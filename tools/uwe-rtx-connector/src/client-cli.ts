/**
 * One-shot CLI helpers for the RTX Connector desktop client (Tauri invokes these).
 *
 *   tsx tools/uwe-rtx-connector/src/client-cli.ts <command> [args]
 *
 * Always invoked via `node --import tsx` (Tauri) or the `client-cli` package
 * script — never executed directly — so it carries no shebang. A shebang here
 * makes `tsx` mis-resolve named exports from re-export barrels such as
 * `@uwe/cookbook`, so it must stay absent.
 *
 * Commands never print secrets. Progress for `pull-ollama` is emitted as NDJSON lines.
 */

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  createModelProfile,
  modelProfileKey,
  parseModelProfileStore,
  type ConnectorModelProfile,
  type ConnectorModelProfileStore,
} from "@uwe/connector-model-profile";
import {
  buildCookbookRecommendations,
  computeModelFit,
  detectHardwareProfile,
  listCookbookModels,
  matchInstalledModel,
} from "@uwe/cookbook";

import { loadClientRuntimeConfig, type ClientRuntimeConfig } from "./client-config-store";
import {
  buildAuthorizationUrl,
  clearSpotifySession,
  exchangeCodeAndStore,
  listDevices,
  setDevice,
  testPlayback,
  type SpotifyLocalConfig,
} from "./spotify-local-store";
import { discoverLocalLlms, resolveDiscoveryConfig } from "./llm-discovery";
import { scanFilesystemModels } from "./filesystem-models";
import { jobHistoryPath, JobHistory } from "./job-history";
import { connectorLogPath, readConnectorLogRing } from "./logging";
import { OllamaAdmin } from "./ollama-admin";
import {
  loadModelProfileStore,
  resolveConnectorDataDir,
  saveModelProfileStore,
} from "./model-profile-store";
import {
  measureOllamaTokensPerSecond,
  probeRunner,
  probeRunners,
  resolveRunnerConfig,
  startOllamaOnWindows,
  type RunnerId,
} from "./runner-admin";

function usage(): never {
  console.error(`Usage:
  client-cli model-store-get
  client-cli model-store-save < store.json
  client-cli scan
  client-cli pull-ollama <modelName>
  client-cli jobs
  client-cli logs [category]
  client-cli cookbook-dashboard
  client-cli probe-runners
  client-cli start-ollama
  client-cli test-runner [ollama|lm_studio|llama_cpp]
  client-cli spotify-auth-url
  client-cli spotify-exchange-code <code>
  client-cli spotify-devices
  client-cli spotify-set-device <deviceId>
  client-cli spotify-test [play|pause]
  client-cli spotify-disconnect
  client-cli test-audio [source]
  client-cli test-image [prompt]
`);
  process.exit(1);
}

function readStdin(): string {
  return readFileSync(0, "utf8");
}

function dataDir(): string {
  return resolveConnectorDataDir();
}

async function cmdModelStoreGet(): Promise<void> {
  const store = loadModelProfileStore(dataDir());
  process.stdout.write(`${JSON.stringify(store)}\n`);
}

function cmdModelStoreSave(raw: string): void {
  const parsed = parseModelProfileStore(JSON.parse(raw));
  saveModelProfileStore(dataDir(), parsed);
  process.stdout.write(`${JSON.stringify(parsed)}\n`);
}

function mergeDiscoveredProfiles(
  store: ConnectorModelProfileStore,
  discovered: Array<{
    provider: string;
    name: string;
    path?: string | null;
    sizeBytes?: number | null;
    modelType?: ConnectorModelProfile["modelType"];
  }>,
): ConnectorModelProfileStore {
  const byId = new Map(store.profiles.map((profile) => [profile.id, profile]));
  const nextProfiles: ConnectorModelProfile[] = [...store.profiles];

  for (const item of discovered) {
    const id = modelProfileKey(item.provider, item.name, item.path ?? undefined);
    if (byId.has(id)) continue;

    const profile = createModelProfile({
      provider: item.provider,
      source: item.path ? "filesystem" : "discovery",
      name: item.name,
      displayName: item.name,
      modelType: item.modelType ?? "chat",
      path: item.path ?? null,
      sizeBytes: item.sizeBytes ?? null,
      enabledForUwe: false,
      visibleInModelPicker: true,
    });
    byId.set(id, profile);
    nextProfiles.push(profile);
  }

  return { ...store, profiles: nextProfiles };
}

async function cmdScan(): Promise<void> {
  const dir = dataDir();
  const store = loadModelProfileStore(dir);
  const discoveryConfig = resolveDiscoveryConfig();
  const llms = await discoverLocalLlms(discoveryConfig);
  const filesystem = scanFilesystemModels(store.scanPaths);

  const discovered = [
    ...llms.models.map((model) => ({
      provider: model.provider,
      name: model.name,
      path: null as string | null,
      sizeBytes: null as number | null,
      modelType: model.capabilities?.includes("embeddings")
        ? ("embedding" as const)
        : model.capabilities?.includes("vision")
          ? ("vision" as const)
          : ("chat" as const),
    })),
    ...filesystem.map((model) => ({
      provider: model.provider,
      name: model.name,
      path: model.path,
      sizeBytes: model.sizeBytes ?? null,
      modelType: "chat" as const,
    })),
  ];

  const merged = mergeDiscoveredProfiles(store, discovered);
  saveModelProfileStore(dir, merged);
  process.stdout.write(`${JSON.stringify(merged)}\n`);
}

async function cmdPullOllama(modelName: string): Promise<void> {
  const config = resolveDiscoveryConfig();
  const baseUrl = config.ollamaUrl ?? "http://127.0.0.1:11434";
  const admin = new OllamaAdmin(baseUrl);

  await admin.pullModel(modelName, (progress) => {
    process.stdout.write(`${JSON.stringify({ type: "progress", ...progress })}\n`);
  });

  process.stdout.write(`${JSON.stringify({ type: "done", name: modelName })}\n`);
  await cmdScan();
}

function cmdJobs(): void {
  const history = new JobHistory({ persistPath: jobHistoryPath(dataDir()) });
  process.stdout.write(`${JSON.stringify(history.list())}\n`);
}

function cmdLogs(category?: string): void {
  const path = connectorLogPath(dataDir());
  let lines: string[];
  try {
    lines = readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0);
  } catch {
    lines = readConnectorLogRing();
  }

  const filtered = category
    ? lines.filter((line) => line.includes(`[${category}]`))
    : lines;

  process.stdout.write(`${JSON.stringify(filtered.slice(-200))}\n`);
}

/**
 * Hardware-aware Cookbook dashboard: detected hardware, installed Ollama models,
 * curated recommendations, and per-model fit scores for the whole registry.
 */
async function cmdCookbookDashboard(): Promise<void> {
  const hardware = await detectHardwareProfile();

  const ollamaBase = resolveRunnerConfig().ollamaUrl;
  const installed = await new OllamaAdmin(ollamaBase).listModels();
  const installedNames = installed.map((entry) => entry.name);

  const recommendations = buildCookbookRecommendations(hardware, installedNames);

  const models = listCookbookModels().map((model) => ({
    id: model.id,
    label: model.label,
    family: model.family,
    paramsB: model.paramsB,
    tags: model.tags,
    useCases: model.useCases,
    engines: model.engines,
    recommendedQuant: model.recommendedQuant,
    minVramGbQ4: model.minVramGbQ4,
    installed: installedNames.some((name) => matchInstalledModel(name, model)),
    fit: computeModelFit(hardware, model),
  }));

  const dashboard = {
    hardware,
    installedModels: installedNames,
    recommendations,
    models,
  };

  process.stdout.write(`${JSON.stringify(dashboard)}\n`);
}

async function cmdProbeRunners(): Promise<void> {
  const runners = await probeRunners();
  process.stdout.write(`${JSON.stringify({ runners })}\n`);
}

async function cmdStartOllama(): Promise<void> {
  const result = await startOllamaOnWindows();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const RUNNER_IDS: RunnerId[] = ["ollama", "lm_studio", "llama_cpp"];

async function cmdTestRunner(rawId?: string): Promise<void> {
  const id = (rawId?.trim() as RunnerId) || "ollama";
  if (!RUNNER_IDS.includes(id)) {
    console.error(`test-runner: unbekannter Runner "${rawId}". Erlaubt: ${RUNNER_IDS.join(", ")}.`);
    process.exit(1);
  }

  const result = await probeRunner(id);
  // For an online Ollama runner, attach a best-effort throughput sample.
  if (id === "ollama" && result.status === "online" && result.models.length > 0) {
    const speed = await measureOllamaTokensPerSecond(result.models[0]);
    process.stdout.write(`${JSON.stringify({ ...result, speed })}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function clientConfig(): ClientRuntimeConfig {
  return loadClientRuntimeConfig(dataDir());
}

function spotifyConfig(): SpotifyLocalConfig {
  const config = clientConfig();
  return {
    clientId: config.spotifyClientId,
    clientSecret: config.spotifyClientSecret,
    redirectUri: config.spotifyRedirectUri,
  };
}

function cmdSpotifyAuthUrl(): void {
  const state = randomBytes(16).toString("hex");
  const url = buildAuthorizationUrl(spotifyConfig(), state);
  process.stdout.write(`${JSON.stringify({ url, state })}\n`);
}

async function cmdSpotifyExchangeCode(code?: string): Promise<void> {
  const trimmed = code?.trim();
  if (!trimmed) {
    console.error("spotify-exchange-code: Authorization-Code fehlt.");
    process.exit(1);
  }
  const result = await exchangeCodeAndStore(dataDir(), spotifyConfig(), trimmed);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

async function cmdSpotifyDevices(): Promise<void> {
  const result = await listDevices(dataDir(), spotifyConfig());
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function cmdSpotifySetDevice(deviceId?: string): void {
  const trimmed = deviceId?.trim() ?? "";
  const result = setDevice(dataDir(), trimmed || null);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

async function cmdSpotifyTest(action?: string): Promise<void> {
  const mode = action?.trim() === "play" ? "play" : "pause";
  const result = await testPlayback(dataDir(), spotifyConfig(), mode);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function cmdSpotifyDisconnect(): void {
  clearSpotifySession(dataDir());
  process.stdout.write(`${JSON.stringify({ ok: true, message: "Spotify getrennt." })}\n`);
}

function splitCommand(command: string): [string, ...string[]] {
  const parts = command.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    throw new Error("Kommando ist leer.");
  }
  return parts as [string, ...string[]];
}

/**
 * Launch the configured audio command (optionally with a test source) and
 * report whether the process spawned. Detached so it survives the short-lived
 * CLI invocation.
 */
function cmdTestAudio(source?: string): void {
  const audioCommand = clientConfig().audioCommand;
  if (!audioCommand) {
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        message: "Kein Audio-Kommando konfiguriert (Audio-Panel im RTX-Client).",
      })}\n`,
    );
    return;
  }

  const [cmd, ...baseArgs] = splitCommand(audioCommand);
  const args = source?.trim() ? [...baseArgs, source.trim()] : baseArgs;

  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.unref();
    process.stdout.write(
      `${JSON.stringify({ ok: true, via: cmd, message: "Audio-Kommando gestartet." })}\n`,
    );
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        via: cmd,
        message: error instanceof Error ? error.message : String(error),
      })}\n`,
    );
  }
}

/**
 * Run the configured image command with a small JSON test payload on stdin and
 * capture its output, mirroring how the connector executes `image_generate`.
 */
async function cmdTestImage(prompt?: string): Promise<void> {
  const imageCommand = clientConfig().imageCommand;
  if (!imageCommand) {
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        message: "Kein Image-Kommando konfiguriert (Bild-Panel im RTX-Client).",
      })}\n`,
    );
    return;
  }

  const payload = { prompt: prompt?.trim() || "UWE connector test image", test: true };
  const [cmd, ...args] = splitCommand(imageCommand);

  const result = await new Promise<Record<string, unknown>>((resolve) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      resolve({ ok: false, via: cmd, message: "Image-Kommando hat das Timeout erreicht." });
    }, 120_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, via: cmd, message: error.message });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        resolve({
          ok: false,
          via: cmd,
          message: `Image-Kommando Exit ${code}${stderr ? `: ${stderr.trim()}` : ""}`,
        });
        return;
      }
      resolve({ ok: true, via: cmd, message: "Image-Kommando erfolgreich.", output: stdout.trim() });
    });
    child.stdin.end(JSON.stringify(payload));
  });

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;
  if (!command) usage();

  switch (command) {
    case "model-store-get":
      await cmdModelStoreGet();
      return;
    case "model-store-save": {
      cmdModelStoreSave(readStdin());
      return;
    }
    case "scan":
      await cmdScan();
      return;
    case "pull-ollama": {
      const name = args[0]?.trim();
      if (!name) {
        console.error("pull-ollama: Modellname fehlt.");
        process.exit(1);
      }
      await cmdPullOllama(name);
      return;
    }
    case "jobs":
      cmdJobs();
      return;
    case "logs":
      cmdLogs(args[0]?.trim() || undefined);
      return;
    case "cookbook-dashboard":
      await cmdCookbookDashboard();
      return;
    case "probe-runners":
      await cmdProbeRunners();
      return;
    case "start-ollama":
      await cmdStartOllama();
      return;
    case "test-runner":
      await cmdTestRunner(args[0]);
      return;
    case "spotify-auth-url":
      cmdSpotifyAuthUrl();
      return;
    case "spotify-exchange-code":
      await cmdSpotifyExchangeCode(args[0]);
      return;
    case "spotify-devices":
      await cmdSpotifyDevices();
      return;
    case "spotify-set-device":
      cmdSpotifySetDevice(args[0]);
      return;
    case "spotify-test":
      await cmdSpotifyTest(args[0]);
      return;
    case "spotify-disconnect":
      cmdSpotifyDisconnect();
      return;
    case "test-audio":
      cmdTestAudio(args[0]);
      return;
    case "test-image":
      await cmdTestImage(args[0]);
      return;
    default:
      console.error(`Unbekannter Befehl: ${command}`);
      usage();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
