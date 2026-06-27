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

import { HostClient } from "./host-client";
import { JobHistory, jobHistoryPath } from "./job-history";
import {
  detectCapabilities,
  resolveCapabilityEnv,
} from "./local-capabilities";
import {
  discoverLocalLlms,
  resolveDiscoveryConfig,
  type DiscoveryConfig,
} from "./llm-discovery";
import { configureConnectorLogFile, connectorLogPath } from "./logging";
import {
  loadModelProfileStore,
  resolveConnectorDataDir,
} from "./model-profile-store";
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
  const capabilityEnv = resolveCapabilityEnv();

  // Client data dir holds the model profile store, job history, and log ring.
  const dataDir = resolveConnectorDataDir();
  configureConnectorLogFile(connectorLogPath(dataDir));
  const history = new JobHistory({ persistPath: jobHistoryPath(dataDir) });

  // The store is reloaded on every discovery so toggling a model in the client
  // takes effect on the next heartbeat without restarting the connector.
  const discover = async () => {
    const store = loadModelProfileStore(dataDir);
    const llms = await discoverLocalLlms(discoveryConfig, store.scanPaths);
    return detectCapabilities(llms, capabilityEnv, {
      profiles: store.profiles,
      forced: config.forcedCapabilities,
    });
  };

  const client = new HostClient(config.hostUrl, config.token);
  const runner = new ConnectorRunner({
    client,
    config,
    version: CONNECTOR_VERSION,
    discover,
    history,
    executorBase: {
      ollamaUrl: discoveryConfig.ollamaUrl,
      audioCommand: process.env.UWE_CONNECTOR_AUDIO_CMD?.trim() || undefined,
      spotifyAccessToken:
        process.env.UWE_CONNECTOR_SPOTIFY_ACCESS_TOKEN?.trim() ||
        process.env.SPOTIFY_ACCESS_TOKEN?.trim() ||
        undefined,
      spotifyDeviceId: process.env.SPOTIFY_DEVICE_ID?.trim() || undefined,
      imageCommand: process.env.UWE_CONNECTOR_IMAGE_CMD?.trim() || undefined,
      requestTimeoutMs: 120_000,
    },
  });

  return { ok: true, runner, config, discoveryConfig, dataDir };
}
