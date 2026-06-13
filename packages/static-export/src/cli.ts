#!/usr/bin/env tsx
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { resolveUploadsDirFromEnv } from "@uwe/assets";
import { createUweRepository, resolveDatabaseUrl } from "@uwe/database/server";
import { exportWorldStatic } from "./export-world";

loadEnv({ path: path.resolve(process.cwd(), ".env") });

function parseArgs(argv: string[]) {
  let worldSlug = "terra";
  let outputDir = "exports/terra-static";
  let uploadsDir = resolveUploadsDirFromEnv(process.cwd());

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--world" || arg === "-w") {
      worldSlug = argv[i + 1] ?? worldSlug;
      i += 1;
    } else if (arg === "--output" || arg === "-o") {
      outputDir = argv[i + 1] ?? outputDir;
      i += 1;
    } else if (arg === "--uploads") {
      uploadsDir = argv[i + 1] ?? uploadsDir;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!outputDir.includes(worldSlug)) {
    outputDir = path.join("exports", `${worldSlug}-static`);
  }

  return { worldSlug, outputDir, uploadsDir };
}

function printHelp() {
  console.log(`UWE Static Export

Usage:
  pnpm export:static [--world terra] [--output exports/terra-static]

Options:
  --world, -w     World slug to export (default: terra)
  --output, -o    Output directory (default: exports/<world>-static)
  --uploads       Uploads directory for asset copying (default: data/uploads)
  --help, -h      Show this help
`);
}

async function main() {
  const { worldSlug, outputDir, uploadsDir } = parseArgs(process.argv.slice(2));
  const databaseUrl = resolveDatabaseUrl();
  const repo = createUweRepository(databaseUrl);

  console.log(`Exporting world "${worldSlug}" to ${outputDir}…`);

  const result = await exportWorldStatic(repo, {
    worldSlug,
    outputDir,
    uploadsDir,
  });

  console.log(`Done. ${result.pageCount} pages, ${result.assetCount} bundled assets.`);
  console.log(`Output: ${result.outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
