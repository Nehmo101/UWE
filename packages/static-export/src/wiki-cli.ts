#!/usr/bin/env tsx
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createUweRepository, resolveDatabaseUrl } from "@uwe/database/server";
import { exportWorldWiki, type WikiExportFormat } from "./export-world-wiki";

loadEnv({ path: path.resolve(process.cwd(), ".env") });

function parseArgs(argv: string[]) {
  let worldSlug = "terra";
  let outputDir = "";
  let format: WikiExportFormat = "markdown";
  let context: "portal" | "dm" = "portal";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--world" || arg === "-w") {
      worldSlug = argv[i + 1] ?? worldSlug;
      i += 1;
    } else if (arg === "--output" || arg === "-o") {
      outputDir = argv[i + 1] ?? outputDir;
      i += 1;
    } else if (arg === "--format" || arg === "-f") {
      format = (argv[i + 1] as WikiExportFormat | undefined) ?? format;
      i += 1;
    } else if (arg === "--context") {
      context = (argv[i + 1] as "portal" | "dm" | undefined) ?? context;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!outputDir) {
    outputDir = path.join("exports", `${worldSlug}-wiki-${format}`);
  }

  return { worldSlug, outputDir, format, context };
}

function printHelp() {
  console.log(`UWE Wiki Export (Markdown/HTML)

Usage:
  pnpm export:wiki [--world terra] [--format markdown|html] [--context portal|dm]

Options:
  --world, -w       World slug (default: terra)
  --output, -o        Output directory
  --format, -f        markdown or html (default: markdown)
  --context           portal (player-safe) or dm (includes dm_only)
  --help, -h          Show this help
`);
}

async function main() {
  const { worldSlug, outputDir, format, context } = parseArgs(process.argv.slice(2));
  const databaseUrl = resolveDatabaseUrl();
  const repo = createUweRepository(databaseUrl);

  console.log(`Exporting wiki "${worldSlug}" (${format}, ${context}) to ${outputDir}…`);

  const result = await exportWorldWiki(repo, {
    worldSlug,
    outputDir,
    format,
    context,
  });

  console.log(`Done. ${result.pageCount} pages exported.`);
  console.log(`Output: ${result.outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
