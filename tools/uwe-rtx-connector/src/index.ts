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
 *
 * The reusable wiring lives in `bootstrap.ts`; this file only handles the CLI
 * command, error reporting, and starting the loop.
 */

import { createConnectorRunner } from "./bootstrap";
import { log } from "./logging";

async function main(): Promise<void> {
  const command = process.argv[2] ?? "start";
  if (command !== "start") {
    log.error(`Unbekannter Befehl: ${command}. Verwende: start`);
    process.exitCode = 1;
    return;
  }

  const result = createConnectorRunner();
  if (!result.ok) {
    log.error(`Konfiguration unvollständig: ${result.reason}`);
    log.error("Siehe tools/uwe-rtx-connector/.env.example für die nötigen Werte.");
    process.exitCode = 1;
    return;
  }

  await result.runner.start();
}

main().catch((error) => {
  log.error("Connector konnte nicht gestartet werden.", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
