/**
 * Read the Tauri-owned `config.json` from the connector client data directory.
 *
 * The Tauri shell persists the Command Center settings (host URL, token,
 * Spotify OAuth credentials, audio/image commands). The Node connector core and
 * the one-shot CLI helpers need a subset of those settings — Spotify OAuth
 * credentials and the local audio/image commands — to wire executors and run
 * Spotify auth. Reading the same file keeps secrets in one place instead of
 * passing them through argv.
 *
 * Reads are offline-safe: a missing or corrupt file yields safe defaults rather
 * than throwing, so the connector and CLI always start. Tokens are never logged.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const CLIENT_CONFIG_FILENAME = "config.json";

/**
 * Default Spotify OAuth loopback redirect URI. Mirrors
 * `DEFAULT_SPOTIFY_REDIRECT_URI` in `@uwe/connector-client-config`; kept inline
 * so the connector runtime carries no extra dependency.
 */
export const DEFAULT_SPOTIFY_REDIRECT_URI = "http://127.0.0.1:8742/callback";

export interface ClientRuntimeConfig {
  spotifyClientId: string;
  spotifyClientSecret: string;
  spotifyRedirectUri: string;
  audioCommand: string;
  imageCommand: string;
  sttCommand: string;
  printCommand: string;
}

export function clientConfigPath(dataDir: string): string {
  return join(dataDir, CLIENT_CONFIG_FILENAME);
}

function defaultClientRuntimeConfig(): ClientRuntimeConfig {
  return {
    spotifyClientId: "",
    spotifyClientSecret: "",
    spotifyRedirectUri: DEFAULT_SPOTIFY_REDIRECT_URI,
    audioCommand: "",
    imageCommand: "",
    sttCommand: "",
    printCommand: "",
  };
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Load the connector client runtime config from `<dataDir>/config.json`.
 * Returns safe defaults when the file is missing or unreadable.
 */
export function loadClientRuntimeConfig(dataDir: string): ClientRuntimeConfig {
  const defaults = defaultClientRuntimeConfig();

  let contents: string;
  try {
    contents = readFileSync(clientConfigPath(dataDir), "utf8");
  } catch {
    return defaults;
  }

  let json: unknown;
  try {
    json = JSON.parse(contents);
  } catch {
    return defaults;
  }

  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return defaults;
  }

  const input = json as Record<string, unknown>;
  const redirect = readString(input.spotifyRedirectUri);

  return {
    spotifyClientId: readString(input.spotifyClientId),
    spotifyClientSecret: readString(input.spotifyClientSecret),
    spotifyRedirectUri: redirect || defaults.spotifyRedirectUri,
    audioCommand: readString(input.audioCommand),
    imageCommand: readString(input.imageCommand),
    sttCommand: readString(input.sttCommand),
    printCommand: readString(input.printCommand),
  };
}
