/**
 * One-shot bootstrap: creates the first owner when no owner exists.
 * Usage: npx tsx scripts/bootstrap-owner-if-needed.ts
 */
import { createAuthService, createPrismaClient } from "@uwe/database/server";

async function main() {
  const db = createPrismaClient();
  const auth = createAuthService(db);

  try {
    if (!(await auth.isSetupAvailable())) {
      const owners = await db.user.findMany({
        where: { role: "owner" },
        select: { email: true, displayName: true, status: true },
      });
      console.log("Owner already exists — skipping bootstrap.");
      console.log(owners);
      return;
    }

    const owner = await auth.createOwnerViaSetup({
      displayName: process.env.UWE_OWNER_NAME ?? "UWE Owner",
      email: process.env.UWE_OWNER_EMAIL ?? "owner@uwe.local",
      password: process.env.UWE_OWNER_PASSWORD ?? "uwe-dev-owner",
    });

    console.log("Created owner:");
    console.log(`  Email: ${owner.email}`);
    console.log(`  Password: ${process.env.UWE_OWNER_PASSWORD ?? "uwe-dev-owner"}`);
  } finally {
    await db.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
