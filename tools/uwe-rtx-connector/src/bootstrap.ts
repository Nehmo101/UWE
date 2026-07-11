/**
 * Reusable connector bootstrap.
 *
 * Extracts the wiring previously inlined in `index.ts` so the same setup can be
 * reused by other entry points (e.g. a future desktop shell) and unit-tested:
 *
 *   • `loadConnectorEnvFile` — parse an adjacent `.env` into `process.env`.
 *   • `createConnectorRunner` — resolve runtime config + build a `ConnectorRunner`.
 *
 * All behavior matches the original CLI: env values never override existing
 * process env, missing config returns a structured error instead of throwing,
 * and discovery stays offline-safe.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveConnectorRuntimeConfig,
  type ConnectorRuntimeConfig,
} from "@uwe/connector";

import { loadClientRuntimeConfig } from "./client-config-store";
import { DirectStreamClient } from "./direct-stream-client";
import { HostClient } from "./host-client";
import { JobHistory, jobHistoryPath } from "./job-history";
import {
  detectCapabilities,
  resolveCapabilityEnv,
} from "./local-capabilities";
import { loadSpotifySession } from "./spotify-local-store";
import {
  discoverLocalLlms,
  resolveDiscoveryConfig,
  type DiscoveredModel,
  type DiscoveryConfig,
  type LocalLlmSummary,
} from "./llm-discovery";
import { configureConnectorLogFile, connectorLogPath } from "./logging";
import {
  loadModelProfileStore,
  resolveConnectorDataDir,
} from "./model-profile-store";
import { discoverLocalPrintersAsync } from "./label-printing";
import {
  enabledPrinters,
  loadPrinterStore,
  toLocalPrinterInfo,
} from "./printer-store";
import { ConnectorRunner } from "./runner";

export const CONNECTOR_VERSION = "1.0.0";

/** Default location of the connector's optional `.env`, adjacent to the package. */
export function defaultConnectorEnvPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", ".env");
}

/**
 * Load a `.env` file into `process.env`. Best-effort and offline-safe: a missing
 * file is fine (the process environment is used as-is). Existing env values are
 * never overridden. Returns the parsed key/value pairs (whether or not they were
 * applied) so callers and tests can inspect the result.
 */
export function loadConnectorEnvFile(
  envPath: string = defaultConnectorEnvPath(),
): Record<string, string> {
  let contents: string;
  try {
    contents = readFileSync(envPath, "utf8");
  } catch {
    return {}; // No .env is fine — rely on the process environment.
  }

  const parsed: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!key) continue;
    parsed[key] = value;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return parsed;
}

export interface CreateConnectorRunnerOptions {
  /** Path to the `.env` to load before resolving config. Defaults to the package `.env`. */
  envPath?: string;
}

/**
 * Merge the Tauri-owned client config (`config.json`) and the persisted Spotify
 * session into `process.env`, so capability detection and executors pick up the
 * local audio/image commands and the Spotify token/device the user configured
 * in the RTX Connector Client. Existing process env values always win, mirroring
 * `loadConnectorEnvFile` (so the desktop shell may still override via env).
 *
 * Spotify tokens stay on disk and in `process.env` only — never logged. The
 * token is read as-is; the client UI/CLI refreshes and persists it, and a
 * connector restart picks up the refreshed value.
 */
export function applyClientRuntimeEnv(dataDir: string): void {
  const setIfUnset = (key: string, value: string | null | undefined) => {
    if (value && process.env[key] === undefined) {
      process.env[key] = value;
    }
  };

  const config = loadClientRuntimeConfig(dataDir);
  setIfUnset("UWE_CONNECTOR_AUDIO_CMD", config.audioCommand);
  setIfUnset("UWE_CONNECTOR_IMAGE_CMD", config.imageCommand);
  setIfUnset("UWE_CONNECTOR_PRINT_CMD", config.printCommand);
  setIfUnset("SPOTIFY_CLIENT_ID", config.spotifyClientId);

  const session = loadSpotifySession(dataDir);
  if (session) {
    setIfUnset("UWE_CONNECTOR_SPOTIFY_ACCESS_TOKEN", session.accessToken);
    setIfUnset("SPOTIFY_DEVICE_ID", session.deviceId);
  }
}

export interface CreateConnectorRunnerOk {
  ok: true;
  runner: ConnectorRunner;
  config: ConnectorRuntimeConfig;
  discoveryConfig: DiscoveryConfig;
  /** Resolved client data directory (model store, job history, log file). */
  dataDir: string;
}

export interface CreateConnectorRunnerError {
  ok: false;
  reason: string;
}

export type CreateConnectorRunnerResult =
  | CreateConnectorRunnerOk
  | CreateConnectorRunnerError;

/**
 * Load env, resolve the connector runtime config, and build a wired
 * `ConnectorRunner` (host client + local discovery + executor context).
 *
 * Returns `{ ok: false, reason }` when configuration is incomplete so callers
 * can report a friendly message; never throws for missing config.
 */
export function createConnectorRunner(
  options: CreateConnectorRunnerOptions = {},
): CreateConnectorRunnerResult {
  loadConnectorEnvFile(options.envPath);

  const configResult = resolveConnectorRuntimeConfig();
  if (!configResult.ok) {
    return { ok: false, reason: configResult.reason };
  }
  const config = configResult.config;

  const discoveryConfig = resolveDiscoveryConfig();

  // Client data dir holds the model profile store, job history, log ring, the
  // Tauri-owned config.json, and the Spotify session. Merge the audio/image
  // commands and Spotify token/device from there into the environment before
  // resolving capabilities so they are advertised correctly.
  const dataDir = resolveConnectorDataDir();
  applyClientRuntimeEnv(dataDir);
  const capabilityEnv = resolveCapabilityEnv();

  configureConnectorLogFile(connectorLogPath(dataDir));
  const history = new JobHistory({ persistPath: jobHistoryPath(dataDir) });

  // Ollama's /api/tags probe can blip transiently — a busy daemon loading a
  // large model, a slow response past the timeout, a brief restart. Without
  // hysteresis every such blip drops the enabled model to "not ready", which
  // flaps `llm_local` and the model in/out of the host each heartbeat (the host
  // shows the model list from the last heartbeat, so it "keeps losing" the
  // model). Reuse the last-good Ollama result for a grace window; a sustained
  // outage still propagates once the window elapses.
  const OLLAMA_HYSTERESIS_MS = 5 * 60_000;
  let lastGoodOllama: { models: DiscoveredModel[]; at: number } | null = null;

  // The store is reloaded on every discovery so toggling a model in the client
  // takes effect on the next heartbeat without restarting the connector.
  const discover = async () => {
    const store = loadModelProfileStore(dataDir);
    let llms = await discoverLocalLlms(discoveryConfig, store.scanPaths);

    const ollama = llms.providers.find((provider) => provider.provider === "ollama");
    if (ollama?.status === "ready") {
      lastGoodOllama = { models: ollama.models, at: Date.now() };
    } else if (ollama && lastGoodOllama && Date.now() - lastGoodOllama.at < OLLAMA_HYSTERESIS_MS) {
      const others = llms.models.filter((model) => model.provider !== "ollama");
      const merged = [...others, ...lastGoodOllama.models];
      llms = {
        ...llms,
        models: merged,
        hasChat: merged.some((model) => model.capabilities?.includes("chat")),
        hasEmbeddings: merged.some((model) => model.capabilities?.includes("embeddings")),
        hasVision: merged.some((model) => model.capabilities?.includes("vision")),
      } satisfies LocalLlmSummary;
    }

    // Advertise the user's enabled printer selection when present; otherwise fall
    // back to auto-detection (env `UWE_CONNECTOR_PRINTERS` or the host spooler).
    // The store is reloaded every cycle so toggling a printer in the client takes
    // effect on the next heartbeat without restarting the connector.
    const printerStore = loadPrinterStore(dataDir);
    const selected = enabledPrinters(printerStore).map(toLocalPrinterInfo);
    const printersSelected = selected.length > 0;
    const printers = printersSelected ? selected : await discoverLocalPrintersAsync();

    return detectCapabilities(llms, capabilityEnv, {
      profiles: store.profiles,
      forced: config.forcedCapabilities,
      printers,
      printersSelected,
    });
  };

  const client = new HostClient(config.hostUrl, config.token);
  const directClient =
    config.transportMode === "queue"
      ? undefined
      : new DirectStreamClient({
          hostUrl: config.hostUrl,
          token: config.token,
        });
  const runner = new ConnectorRunner({
    client,
    directClient,
    config,
    version: CONNECTOR_VERSION,
    discover,
    history,
    executorBase: {
      ollamaUrl: discoveryConfig.ollamaUrl,
      lmStudioUrl: discoveryConfig.lmStudioUrl,
      llamaCppUrl: discoveryConfig.llamaCppUrl,
      resolveModelProvider: (modelName: string) => {
        const store = loadModelProfileStore(dataDir);
        const match = store.profiles.find(
          (profile) =>
            profile.enabledForUwe &&
            (profile.name === modelName || profile.id === modelName),
        );
        return match?.provider;
      },
      audioCommand: process.env.UWE_CONNECTOR_AUDIO_CMD?.trim() || undefined,
      spotifyAccessToken:
        process.env.UWE_CONNECTOR_SPOTIFY_ACCESS_TOKEN?.trim() ||
        process.env.SPOTIFY_ACCESS_TOKEN?.trim() ||
        undefined,
      spotifyDeviceId: process.env.SPOTIFY_DEVICE_ID?.trim() || undefined,
      imageCommand: process.env.UWE_CONNECTOR_IMAGE_CMD?.trim() || undefined,
      printCommand: process.env.UWE_CONNECTOR_PRINT_CMD?.trim() || undefined,
      hostUrl: config.hostUrl,
      connectorToken: config.token,
      requestTimeoutMs: 120_000,
    },
  });

  return { ok: true, runner, config, discoveryConfig, dataDir };
}
