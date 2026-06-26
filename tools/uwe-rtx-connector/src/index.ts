#!/usr/bin/env -S node --import tsx
/**
 * UWE RTX Host Connector — CLI entry.
 *
 *   pnpm connector:start        # from the repo root
 *   tsx tools/uwe-rtx-connector/src/index.ts start
 *
 * Reads configuration from the environment (and an optional adjacent .env), then
 * runs the outbound work loop. The connector is always optional: if the host is
 * unreachable it keeps retrying without ever blocking the host.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveConnectorRuntimeConfig } from "@uwe/connector";

import { HostClient } from "./host-client";
import {
  detectCapabilities,
  resolveCapabilityEnv,
} from "./local-capabilities";
import { discoverLocalLlms, resolveDiscoveryConfig } from "./llm-discovery";
import { log } from "./logging";
import { ConnectorRunner } from "./runner";

const CONNECTOR_VERSION = "1.0.0";

function loadEnvFile(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, "..", ".env");
  let contents: string;
  try {
    contents = readFileSync(envPath, "utf8");
  } catch {
    return; // No .env is fine — rely on the process environment.
  }
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
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "start";
  if (command !== "start") {
    log.error(`Unbekannter Befehl: ${command}. Verwende: start`);
    process.exitCode = 1;
    return;
  }

  loadEnvFile();

  const configResult = resolveConnectorRuntimeConfig();
  if (!configResult.ok) {
    log.error(`Konfiguration unvollständig: ${configResult.reason}`);
    log.error("Siehe tools/uwe-rtx-connector/.env.example für die nötigen Werte.");
    process.exitCode = 1;
    return;
  }
  const config = configResult.config;

  const discoveryConfig = resolveDiscoveryConfig();
  const capabilityEnv = resolveCapabilityEnv();

  const discover = async () => {
    const llms = await discoverLocalLlms(discoveryConfig);
    return detectCapabilities(llms, capabilityEnv, config.forcedCapabilities);
  };

  const client = new HostClient(config.hostUrl, config.token);
  const runner = new ConnectorRunner({
    client,
    config,
    version: CONNECTOR_VERSION,
    discover,
    executorBase: {
      ollamaUrl: discoveryConfig.ollamaUrl,
      audioCommand: process.env.UWE_CONNECTOR_AUDIO_CMD?.trim() || undefined,
      requestTimeoutMs: 120_000,
    },
  });

  await runner.start();
}

main().catch((error) => {
  log.error("Connector konnte nicht gestartet werden.", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
