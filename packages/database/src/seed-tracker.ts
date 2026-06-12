import type { PrismaClient } from "./client";

/**
 * Seed tracking: records which data seeds have been applied (and in which
 * version) in the `seed_history` table, so seeds stay idempotent across
 * restarts and upgrades. Schema migrations themselves are tracked by Prisma
 * in `_prisma_migrations`; this covers *data* seeds on top of that.
 */

export interface SeedStatus {
  key: string;
  version: number;
  appliedAt: Date;
}

export async function isSeedApplied(
  db: PrismaClient,
  key: string,
  version: number,
): Promise<boolean> {
  const entry = await db.seedHistory.findUnique({ where: { key } });
  return entry !== null && entry.version >= version;
}

/**
 * Run a data seed exactly once per (key, version). Re-running with the same
 * version is a no-op; a higher version runs the seed again and bumps the
 * recorded version. The seed function itself must still be written
 * idempotently (e.g. upserts) in case two processes race on first start.
 */
export async function runSeedOnce(
  db: PrismaClient,
  key: string,
  version: number,
  seed: () => Promise<unknown>,
): Promise<{ applied: boolean }> {
  if (await isSeedApplied(db, key, version)) {
    return { applied: false };
  }

  const details = await seed();

  await db.seedHistory.upsert({
    where: { key },
    create: {
      key,
      version,
      details: details === undefined ? undefined : JSON.parse(JSON.stringify(details)),
    },
    update: {
      version,
      appliedAt: new Date(),
      details: details === undefined ? undefined : JSON.parse(JSON.stringify(details)),
    },
  });

  return { applied: true };
}

export async function listSeedHistory(db: PrismaClient): Promise<SeedStatus[]> {
  const entries = await db.seedHistory.findMany({ orderBy: { appliedAt: "desc" } });
  return entries.map((entry) => ({
    key: entry.key,
    version: entry.version,
    appliedAt: entry.appliedAt,
  }));
}
