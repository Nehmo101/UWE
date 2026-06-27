/**
 * Filesystem persistence for the connector's model profile store.
 *
 * The store lives at `<dataDir>/model-store.json`, where `dataDir` comes from
 * `UWE_CONNECTOR_CLIENT_DATA_DIR` (set by the Tauri client) or a sensible
 * per-user default. Reads are offline-safe: a missing or corrupt file yields the
 * empty default rather than throwing, so the connector always starts.
 *
 * The store only holds model metadata and enable flags — never tokens, world,
 * brain, or personal data.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  defaultModelProfileStore,
  parseModelProfileStore,
  type ConnectorModelProfileStore,
} from "@uwe/connector-model-profile";

export const MODEL_STORE_FILENAME = "model-store.json";

/**
 * Resolve the connector client data directory from the environment, falling
 * back to a per-user directory when unset. The Tauri client always sets
 * `UWE_CONNECTOR_CLIENT_DATA_DIR`; the fallback keeps the CLI usable standalone.
 */
export function resolveConnectorDataDir(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.UWE_CONNECTOR_CLIENT_DATA_DIR?.trim();
  if (configured) {
    return resolve(configured);
  }
  return join(homedir(), ".uwe-rtx-connector");
}

export function modelStorePath(dataDir: string): string {
  return join(dataDir, MODEL_STORE_FILENAME);
}

/**
 * Load and validate the model store from disk. Returns the empty default when
 * the file is missing or unreadable; throws only for an explicit parse failure
 * the caller may want to surface.
 */
export function loadModelProfileStore(dataDir: string): ConnectorModelProfileStore {
  let contents: string;
  try {
    contents = readFileSync(modelStorePath(dataDir), "utf8");
  } catch {
    return defaultModelProfileStore();
  }

  let json: unknown;
  try {
    json = JSON.parse(contents);
  } catch {
    // A corrupt file should never stop the connector from starting.
    return defaultModelProfileStore();
  }

  try {
    return parseModelProfileStore(json);
  } catch {
    return defaultModelProfileStore();
  }
}

/** Persist the model store to disk, creating the data directory if needed. */
export function saveModelProfileStore(
  dataDir: string,
  store: ConnectorModelProfileStore,
): void {
  const path = modelStorePath(dataDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}
