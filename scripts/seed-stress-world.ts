import "dotenv/config";
import { prisma } from "../src/client";
import { createUweRepository } from "../src/repository";
import { runSeedOnce } from "../src/seed-tracker";
import { seedStressWorld } from "../src/stress-seed";
import { PERF_STRESS_SCALE } from "../src/perf-budgets";

async function main() {
  const repo = createUweRepository();
  const { applied } = await runSeedOnce(prisma, "stress-world", 1, async () => {
    const result = await seedStressWorld(repo, prisma, PERF_STRESS_SCALE);
    return result.stats;
  });

  if (applied) {
    console.log("Seeded performance stress world (perf-test).");
  } else {
    console.log("Performance stress world already seeded — skipped.");
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
