import "dotenv/config";
import { prisma } from "../packages/database/src/client";
import { createUweRepository } from "../packages/database/src/repository";
import { runSeedOnce } from "../packages/database/src/seed-tracker";
import { seedStressWorld } from "../packages/database/src/stress-seed";
import { resolveStressScale } from "../packages/database/src/perf-budgets";

async function main() {
  const scale = resolveStressScale();
  const scaleName = process.env.UWE_STRESS_SCALE?.trim().toLowerCase() || "stress";
  const seedKey = scaleName === "mega" || scaleName === "10k" ? "stress-world-mega" : "stress-world";
  const seedVersion = scaleName === "mega" || scaleName === "10k" ? 1 : 1;

  const repo = createUweRepository();
  const { applied } = await runSeedOnce(prisma, seedKey, seedVersion, async () => {
    const result = await seedStressWorld(repo, prisma, scale);
    return { scale: scaleName, stats: result.stats };
  });

  if (applied) {
    console.log(`Seeded performance stress world (perf-test) with scale "${scaleName}".`);
  } else {
    console.log(`Performance stress world (${seedKey}) already seeded — skipped.`);
  }

  const world = await prisma.world.findUnique({ where: { slug: "perf-test" } });
  if (world) {
    const [pages, assets, captures, sessions] = await Promise.all([
      prisma.page.count({ where: { worldId: world.id } }),
      prisma.asset.count({ where: { worldId: world.id } }),
      prisma.captureEntry.count(),
      prisma.gameSession.count({ where: { worldId: world.id } }),
    ]);
    console.log(`  World: perf-test (${world.id})`);
    console.log(`  Scale: ${scaleName} (${scale.pages} pages target)`);
    console.log(`  Pages: ${pages}, Assets: ${assets}, Captures: ${captures}, Sessions: ${sessions}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
