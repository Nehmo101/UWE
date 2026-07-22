import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient as BrainSqliteClient } from "./generated/prisma-brain/client";

/**
 * Owner-private Brain database client (`uwe-brain.db`).
 *
 * Deliberately separate from the D&D core client (`client.ts`, `uwe.db`): the
 * Brain data model lives in `prisma/brain/schema.prisma` and is generated into
 * its own client, so a compile error is raised the moment app or shared-engine
 * code tries to read Brain data through the core client (or vice versa). Brain
 * is loopback/owner-only (ADR 004/007) and always local SQLite — there is no
 * Postgres runtime path here.
 */
const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export type BrainPrismaClient = BrainSqliteClient;

export function resolveBrainDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.BRAIN_DATABASE_URL ?? "file:./data/uwe-brain.db";

  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    if (path.isAbsolute(filePath)) {
      return url;
    }

    return `file:${path.resolve(packageRoot, "..", filePath)}`;
  }

  return url;
}

const globalForBrain = globalThis as unknown as {
  brainPrisma?: BrainPrismaClient;
};

/** WAL + busy_timeout, same rationale as the core client. Best-effort. */
function applyBrainPragmas(client: BrainSqliteClient): void {
  void (async () => {
    try {
      await client.$queryRawUnsafe("PRAGMA journal_mode = WAL");
      await client.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
      await client.$queryRawUnsafe("PRAGMA synchronous = NORMAL");
    } catch (error) {
      console.warn("[uwe/database] failed to apply Brain SQLite pragmas", error);
    }
  })();
}

function createBrainSqliteClient(url: string): BrainSqliteClient {
  const adapter = new PrismaLibSql({ url });
  const client = new BrainSqliteClient({ adapter });
  applyBrainPragmas(client);
  return client;
}

/** Process-wide Brain SQLite singleton — mirrors getSharedPrismaClient(). */
export function getSharedBrainPrismaClient(): BrainPrismaClient {
  if (!globalForBrain.brainPrisma) {
    globalForBrain.brainPrisma = createBrainSqliteClient(resolveBrainDatabaseUrl());
  }

  return globalForBrain.brainPrisma;
}

export function isSharedBrainPrismaClient(client: BrainPrismaClient): boolean {
  return client === globalForBrain.brainPrisma;
}

export async function disconnectBrainPrismaClientIfOwned(client: BrainPrismaClient): Promise<void> {
  if (!isSharedBrainPrismaClient(client)) {
    await client.$disconnect();
  }
}

export function createBrainPrismaClient(databaseUrl?: string): BrainPrismaClient {
  return createBrainSqliteClient(resolveBrainDatabaseUrl(databaseUrl));
}

export const brainPrisma = getSharedBrainPrismaClient();

export { BrainSqliteClient };
