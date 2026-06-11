import "dotenv/config";
import { prisma } from "../src/client";
import { createUweRepository } from "../src/repository";
import { seedTerraWorld } from "../src/terra-seed";

async function main() {
  const repo = createUweRepository();
  const result = await seedTerraWorld(repo);

  console.log(`Seeded world "${result.world.name}" (${result.world.slug})`);
  console.log(`  Pages: ${Object.keys(result.pages).join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
