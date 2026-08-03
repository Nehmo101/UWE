/**
 * One-shot CLI helpers for the Maschinenraum desktop client (Tauri invokes these).
 *
 *   tsx tools/uwe-engine-connector/src/client-cli.ts <command> [args]
 *
 * Always invoked via `node --import tsx` (Tauri) or the `client-cli` package
 * script — never executed directly — so it carries no shebang. A shebang here
 * makes `tsx` mis-resolve named exports from re-export barrels such as
 * `@uwe/cookbook`, so it must stay absent.
 *
 * Commands never print secrets. Progress for `pull-ollama` is emitted as NDJSON lines.
 */

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
  getCookbookModel,
  listCookbookModels,
  matchInstalledModel,
  modelStrengthTier,
  USE_CASE_LABELS,
} from "@uwe/cookbook";

import { runIntegrationCliCommand } from "./client-cli-integration-cmds";
import { discoverLocalLlms, resolveDiscoveryConfig } from "./llm-discovery";
import { scanFilesystemModels } from "./filesystem-models";
import { listInstalledPrinters } from "./label-printing";
import {
  loadPrinterStore,
  mergeDiscoveredPrinters,
  parsePrinterStore,
  savePrinterStore,
} from "./printer-store";
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
  startOllama,
  type RunnerId,
} from "./runner-admin";

function usage(): never {
  console.error(`Usage:
  client-cli model-store-get
  client-cli model-store-save < store.json
  client-cli scan
  client-cli printer-store-get
  client-cli printer-store-save < store.json
  client-cli scan-printers
  client-cli pull-ollama <modelName>
  client-cli delete-model <modelName>
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
  client-cli test-print [printerId]
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

/**
 * Pre-fill the UWE-release fields (`displayName`, `description`, `bestFor`) for a
 * discovered model from the cookbook catalog, so a freshly downloaded model shows
 * up in the UWE-Freigaben with sensible defaults instead of blank fields. Returns
 * an empty object for models the catalog doesn't know about.
 */
function cookbookReleaseDefaults(modelName: string): {
  displayName?: string;
  description?: string;
  bestFor?: string[];
} {
  const model = getCookbookModel(modelName);
  if (!model) {
    return {};
  }
  return {
    displayName: model.label,
    description: model.summary,
    bestFor: model.useCases.map((useCase) => USE_CASE_LABELS[useCase]?.label ?? useCase),
  };
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
  const nextProfiles: ConnectorModelProfile[] = [];

  for (const profile of store.profiles) {
    // Back-fill catalog defaults for profiles that predate this feature — but
    // only into empty fields, so we never clobber the user's own edits.
    const defaults = cookbookReleaseDefaults(profile.name);
    const needsDescription = profile.description.trim().length === 0 && !!defaults.description;
    const needsBestFor = profile.bestFor.length === 0 && !!defaults.bestFor;
    nextProfiles.push(
      needsDescription || needsBestFor
        ? {
            ...profile,
            description: needsDescription ? defaults.description! : profile.description,
            bestFor: needsBestFor ? defaults.bestFor! : profile.bestFor,
          }
        : profile,
    );
  }

  for (const item of discovered) {
    const id = modelProfileKey(item.provider, item.name, item.path ?? undefined);
    if (byId.has(id)) continue;

    const defaults = cookbookReleaseDefaults(item.name);
    const profile = createModelProfile({
      provider: item.provider,
      source: item.path ? "filesystem" : "discovery",
      name: item.name,
      displayName: defaults.displayName ?? item.name,
      description: defaults.description,
      bestFor: defaults.bestFor,
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

function cmdPrinterStoreGet(): void {
  const store = loadPrinterStore(dataDir());
  process.stdout.write(`${JSON.stringify(store)}\n`);
}

function cmdPrinterStoreSave(raw: string): void {
  const parsed = parsePrinterStore(JSON.parse(raw));
  savePrinterStore(dataDir(), parsed);
  process.stdout.write(`${JSON.stringify(parsed)}\n`);
}

/**
 * Enumerate the printers installed on the Maschinenraum host, merge them into the printer
 * store (new printers stay disabled until the user opts them in), persist, and
 * emit the updated store — mirroring `scan` for models.
 */
async function cmdScanPrinters(): Promise<void> {
  const dir = dataDir();
  const store = loadPrinterStore(dir);
  const discovered = await listInstalledPrinters();
  const merged = mergeDiscoveredPrinters(store, discovered);
  savePrinterStore(dir, merged);
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

/**
 * Delete a model from Ollama and drop its matching profile(s) from the local
 * model store, mirroring `cmdScan`'s output shape so the Rust side's existing
 * store parser handles it unchanged.
 */
async function cmdDeleteModel(modelName: string): Promise<void> {
  const config = resolveDiscoveryConfig();
  const baseUrl = config.ollamaUrl ?? "http://127.0.0.1:11434";
  const admin = new OllamaAdmin(baseUrl);

  await admin.deleteModel(modelName);

  const dir = dataDir();
  const store = loadModelProfileStore(dir);
  const next: ConnectorModelProfileStore = {
    ...store,
    profiles: store.profiles.filter(
      (profile) =>
        !(profile.provider === "ollama" && (profile.name === modelName || profile.displayName === modelName)),
    ),
  };
  saveModelProfileStore(dir, next);
  process.stdout.write(`${JSON.stringify(next)}\n`);
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

  const models = listCookbookModels().map((model) => {
    const strength = modelStrengthTier(model.paramsB);
    return {
      id: model.id,
      label: model.label,
      family: model.family,
      paramsB: model.paramsB,
      contextLength: model.contextLength,
      isMoe: model.isMoe,
      isMultimodal: model.isMultimodal,
      tags: model.tags,
      useCases: model.useCases,
      engines: model.engines,
      recommendedQuant: model.recommendedQuant,
      minVramGbQ4: model.minVramGbQ4,
      summary: model.summary,
      strengthTier: strength.tier,
      strengthLabel: strength.label,
      installed: installedNames.some((name) => matchInstalledModel(name, model)),
      fit: computeModelFit(hardware, model),
    };
  });

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
  const result = await startOllama();
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

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;
  if (!command) usage();

  if (await runIntegrationCliCommand(dataDir(), command, args)) {
    return;
  }

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
    case "printer-store-get":
      cmdPrinterStoreGet();
      return;
    case "printer-store-save":
      cmdPrinterStoreSave(readStdin());
      return;
    case "scan-printers":
      await cmdScanPrinters();
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
    case "delete-model": {
      const name = args[0]?.trim();
      if (!name) {
        console.error("delete-model: Modellname fehlt.");
        process.exit(1);
      }
      await cmdDeleteModel(name);
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
    default:
      console.error(`Unbekannter Befehl: ${command}`);
      usage();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
