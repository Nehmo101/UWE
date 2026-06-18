#!/usr/bin/env node
import path from "node:path";
import { exportBackupZip } from "./export";

async function main() {
  const args = process.argv.slice(2);
  const typeArg = args.find((arg) => arg.startsWith("--type="))?.split("=")[1] ?? "full";
  const worldSlug = args.find((arg) => arg.startsWith("--world="))?.split("=")[1];
  const campaignSlug = args.find((arg) => arg.startsWith("--campaign="))?.split("=")[1];
  const format = args.find((arg) => arg.startsWith("--format="))?.split("=")[1] as
    | "zip"
    | "json"
    | undefined;
  const includePlayerNotes = args.includes("--include-player-notes");

  if (!["full", "world", "campaign"].includes(typeArg)) {
    throw new Error("Ungültiger --type Wert. Erlaubt: full, world, campaign");
  }

  const { outputPath } = await exportBackupZip(undefined, {
    type: typeArg as "full" | "world" | "campaign",
    worldSlug,
    campaignSlug,
    format: format ?? "zip",
    includePlayerNotes,
  });

  console.log(`Backup erstellt: ${path.resolve(outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
