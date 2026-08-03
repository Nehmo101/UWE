#!/usr/bin/env -S node --import tsx
/**
 * UWE Maschinenraum — desktop launcher.
 *
 * Long-running entry point spawned by the Tauri desktop client
 * (`apps/engine-connector-client`). It reuses the same wiring as the CLI
 * (`createConnectorRunner` from `bootstrap.ts`) but is tailored for being
 * managed as a child process:
 *
 *   • Configuration comes from the environment the desktop shell injects
 *     (UWE_HOST_URL, UWE_CONNECTOR_TOKEN, …) — no adjacent `.env` is required.
 *   • On SIGTERM/SIGINT the runner drains active jobs, sends a final heartbeat,
 *     clears its timers and lets the process exit cleanly so the desktop client
 *     can report a stopped state. `ConnectorRunner.start()` installs those
 *     signal handlers itself; relying on them (instead of a forced
 *     `process.exit`) keeps the graceful drain intact and never truncates the
 *     buffered log output.
 *
 * The connector is always optional: if the host is unreachable it keeps
 * retrying without ever blocking the host.
 */

import { createConnectorRunner } from "./bootstrap";
import { log } from "./logging";

async function main(): Promise<void> {
  const result = createConnectorRunner();
  if (!result.ok) {
    log.error(`Konfiguration unvollständig: ${result.reason}`);
    log.error(
      "Host-URL und Connector-Token müssen über die Desktop-App gesetzt sein.",
    );
    process.exitCode = 1;
    return;
  }

  // `start()` wires the outbound loop AND registers SIGTERM/SIGINT handlers
  // that stop the runner gracefully; the desktop shell terminates this process
  // with SIGTERM (or kills it on app exit), so no extra handler is required.
  await result.runner.start();
}

main().catch((error) => {
  log.error("Desktop-Connector konnte nicht gestartet werden.", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
