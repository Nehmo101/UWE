#!/usr/bin/env node
import { startHostCommandCenterServer } from "./server";

async function main() {
  const { host, port } = await startHostCommandCenterServer();
  console.log(`UWE Host Command Center läuft auf http://${host}:${port}/`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
