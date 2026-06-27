#!/usr/bin/env -S node --import tsx
/**
 * One-shot CLI helpers for the RTX Connector desktop client (Tauri invokes these).
 *
 *   tsx tools/uwe-rtx-connector/src/client-cli.ts <command> [args]
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

function usage(): never {
  console.error(`Usage:
  client-cli model-store-get
  client-cli model-store-save < store.json
  client-cli scan
  client-cli pull-ollama <modelName>
  client-cli jobs
  client-cli logs [category]
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
    default:
      console.error(`Unbekannter Befehl: ${command}`);
      usage();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
