/**
 * Audit Character.species JSON in the local uwe.db (tsx entry point).
 *
 * Run from repo root:
 *   pnpm exec tsx packages/character-creator/dev-progress/_query-species.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient, disconnectPrismaClientIfOwned } from "@uwe/database/client";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const databaseUrl = `file:${path.join(repoRoot, "packages/database/data/uwe.db")}`;

const prisma = createPrismaClient(databaseUrl);

async function main() {
  const total = await prisma.character.count();
  const all = await prisma.character.findMany({
    select: { id: true, displayName: true, worldId: true, species: true, pageId: true },
  });
  const withSpecies = all.filter(
    (c) => c.species && typeof c.species === "object" && c.species !== null && "key" in c.species && c.species.key,
  );
  const worlds = await prisma.world.findMany({ select: { id: true, slug: true, name: true } });
  const worldById = new Map(worlds.map((w) => [w.id, w]));
  console.log(
    JSON.stringify(
      {
        counts: {
          totalCharacters: total,
          withSpeciesJson: withSpecies.length,
          withoutSpeciesJson: total - withSpecies.length,
        },
        charactersWithSpecies: withSpecies.map((c) => ({
          id: c.id,
          displayName: c.displayName,
          worldId: c.worldId,
          worldSlug: worldById.get(c.worldId)?.slug ?? null,
          speciesKey: c.species.key,
          speciesName: c.species.name,
          lineageKey: c.species.lineage?.key ?? null,
          lineageName: c.species.lineage?.name ?? null,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => disconnectPrismaClientIfOwned(prisma))
  .catch(async (err) => {
    console.error(err);
    await disconnectPrismaClientIfOwned(prisma);
    process.exit(1);
  });
