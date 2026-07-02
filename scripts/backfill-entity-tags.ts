#!/usr/bin/env tsx
/**
 * Backfill Tag + EntityTag rows from legacy Json tag arrays.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-entity-tags.ts [--dry-run] [--world-id=<id>]
 */
import "dotenv/config";
import { createPrismaClient } from "../packages/database/src/client";
import { backfillEntityTagsFromJson } from "../packages/database/src/tag-service";

function parseArgs(argv: string[]) {
  let dryRun = false;
  let worldId: string | undefined;

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    if (arg.startsWith("--world-id=")) {
      worldId = arg.slice("--world-id=".length) || undefined;
    }
  }

  return { dryRun, worldId };
}

async function main() {
  const { dryRun, worldId } = parseArgs(process.argv.slice(2));
  const db = createPrismaClient();

  try {
    const result = await backfillEntityTagsFromJson(db, { worldId, dryRun });
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun,
          worldId: worldId ?? null,
          ...result,
        },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
