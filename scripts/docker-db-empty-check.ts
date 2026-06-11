import { prisma } from "../packages/database/src/client";

async function main() {
  const count = await prisma.world.count();
  process.exit(count === 0 ? 0 : 1);
}

main()
  .catch(() => {
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
