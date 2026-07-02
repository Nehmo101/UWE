#!/usr/bin/env tsx
/**
 * Verify EntityTag backfill completeness against legacy Json tag arrays.
 *
 * Compares the legacy Json tags (page.tags, asset.tags, ..., metadata.tags)
 * with the EntityTag rows of each entity and reports every entity whose Json
 * tags are not fully represented in EntityTag (direction Json -> EntityTag).
 *
 * Exit code 0 when coverage is complete, 1 when discrepancies are found.
 * Run this on the live instance BEFORE removing the legacy Json dual-write.
 *
 * Usage:
 *   pnpm verify:tag-backfill [-- --world-id=<id>]
 *   pnpm tsx scripts/verify-tag-backfill.ts [--world-id=<id>]
 */
import "dotenv/config";
import { createPrismaClient } from "../packages/database/src/client";
import { verifyTagBackfill } from "../packages/database/src/tag-service";

function parseArgs(argv: string[]) {
  let worldId: string | undefined;

  for (const arg of argv) {
    if (arg.startsWith("--world-id=")) {
      worldId = arg.slice("--world-id=".length) || undefined;
    }
  }

  return { worldId };
}

async function main() {
  const { worldId } = parseArgs(process.argv.slice(2));
  const db = createPrismaClient();

  try {
    const result = await verifyTagBackfill(db, { worldId });
    console.log(
      JSON.stringify(
        {
          ok: result.ok,
          worldId: worldId ?? null,
          totalEntitiesWithJsonTags: result.totalEntitiesWithJsonTags,
          totalEntitiesMissing: result.totalEntitiesMissing,
          totalMissingLinks: result.totalMissingLinks,
          types: result.types,
        },
        null,
        2,
      ),
    );

    if (!result.ok) {
      console.error(
        `Backfill incomplete: ${result.totalEntitiesMissing} entities with ${result.totalMissingLinks} missing EntityTag links. Run: pnpm backfill:entity-tags`,
      );
      process.exit(1);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
