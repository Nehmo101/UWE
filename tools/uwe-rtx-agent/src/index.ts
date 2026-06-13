#!/usr/bin/env node
import { disableAutostart, enableAutostart, getAutostartStatus } from "./autostart.js";
import { loadConfig } from "./config.js";
import { loadEnvFile } from "./env.js";
import { buildTrayStatusResponse } from "./health.js";
import { appendAgentLog } from "./logging.js";
import { BackendManager } from "./backend-manager.js";
import { getAgentLogDir, getEnvFilePath, resolveAgentUrl } from "./paths.js";
import { startAgentServer } from "./server.js";
import { setPersistedEnabled } from "./state.js";

loadEnvFile();

function printHelp(): void {
  console.log(`UWE RTX Agent

Usage:
  uwe-rtx-agent <command>

Commands:
  start                 Start the HTTP agent server
  status                Print current health/status as JSON
  enable                Enable the agent
  disable               Disable the agent
  enable-autostart      Register tray autostart for current user
  disable-autostart     Remove tray autostart
  autostart-status      Show autostart state as JSON

Environment:
  Configure via .env in the agent root (${getEnvFilePath()})
`);
}

async function main(): Promise<void> {
  const command = process.argv[2]?.trim() || "start";

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;
    case "start":
      await runServer();
      return;
    case "status":
      await printStatus();
      return;
    case "enable":
      setPersistedEnabled(true);
      console.log("Agent enabled.");
      return;
    case "disable":
      setPersistedEnabled(false);
      console.log("Agent disabled.");
      return;
    case "enable-autostart":
      console.log(JSON.stringify(enableAutostart(), null, 2));
      return;
    case "disable-autostart":
      console.log(JSON.stringify(disableAutostart(), null, 2));
      return;
    case "autostart-status":
      console.log(JSON.stringify(getAutostartStatus(), null, 2));
      return;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exitCode = 1;
  }
}

async function runServer(): Promise<void> {
  const config = loadConfig();
  appendAgentLog("Starting UWE RTX Agent.");
  const server = await startAgentServer(config);

  const shutdown = async (signal: string) => {
    appendAgentLog(`Received ${signal}, shutting down.`);
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

async function printStatus(): Promise<void> {
  const config = loadConfig();
  const backend = new BackendManager(config);
  const status = await buildTrayStatusResponse(config, backend);
  console.log(JSON.stringify(status, null, 2));
  console.log(`Logs: ${getAgentLogDir()}`);
  console.log(`Agent URL: ${resolveAgentUrl(config.host, config.port)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
