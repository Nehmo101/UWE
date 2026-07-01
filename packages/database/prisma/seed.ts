import "dotenv/config";
import { createAuthService } from "../src/auth";
import { prisma } from "../src/client";
import { createUweRepository } from "../src/repository";
import { seedAuthDemoContent, seedAuthUsers } from "../src/auth-seed";
import { ensureSystemPageTemplates } from "../src/page-template-service";
import { ensureSystemMailTemplates } from "../src/mail-template-service";
import { seedTerraWorld, seedTerraChronicle } from "../src/terra-seed";

async function main() {
  const repo = createUweRepository();
  const auth = createAuthService(prisma);

  const templateSeed = await ensureSystemPageTemplates(prisma);
  console.log(
    templateSeed.applied
      ? "Seeded system page templates."
      : "System page templates already seeded — skipped.",
  );

  const mailTemplateSeed = await ensureSystemMailTemplates(prisma);
  console.log(
    mailTemplateSeed.applied
      ? "Seeded system mail templates."
      : "System mail templates already seeded — skipped.",
  );

  const result = await seedTerraWorld(repo);

  await seedTerraChronicle(prisma, result.world.id, {
    validori: result.pages.validori,
    nepurga: result.pages.nepurga,
  });

  await auth.setWorldGuestMode(result.world.id, true);

  const users = await seedAuthUsers(auth, repo, result.world.id);

  const playerIds = Object.fromEntries(
    users.players.map((player) => [player.displayName.toLowerCase(), player.id]),
  ) as Record<string, string>;

  await seedAuthDemoContent(auth, repo, result.world.id, {
    aman: playerIds.aman!,
    lazul: playerIds.lazul!,
    veldrin: playerIds.veldrin!,
    finnion: playerIds.finnion!,
  });

  console.log(`Seeded world "${result.world.name}" (${result.world.slug})`);
  console.log(`  Pages: ${Object.keys(result.pages).join(", ")}`);
  console.log(`  DM: ${users.dm.email} (password: uwe-dev)`);
  console.log(
    `  Players: ${users.players.map((player) => `${player.displayName} <${player.email}>`).join(", ")}`,
  );
  console.log("  All seed users use password: uwe-dev");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
