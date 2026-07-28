import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient as PostgresPrismaClient } from "./generated/prisma-postgres/client";
import { PrismaClient as SqlitePrismaClient } from "./generated/prisma/client";
import { isPostgresDatabaseUrl } from "./database-provider";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export type PrismaClient = SqlitePrismaClient;

export function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL ?? "file:./data/uwe.db";

  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    if (path.isAbsolute(filePath)) {
      return url;
    }

    return `file:${path.resolve(packageRoot, "..", filePath)}`;
  }

  return url;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: pg.Pool;
};

/**
 * Studio and Portal run as two separate Node processes against the same SQLite
 * file. Without WAL, a reader blocks a writer (and vice versa); without a
 * busy_timeout, the loser of that race fails immediately with SQLITE_BUSY
 * instead of waiting. WAL is a persistent property of the database file, so
 * setting it once on any connection is enough; busy_timeout is per-connection,
 * so we apply it whenever a client is created. Best-effort: a failure here must
 * never crash client creation.
 *
 * The promise is kept so callers can wait for it — see `whenPragmasApplied`.
 * Measured before that existed: `PRAGMA busy_timeout` read back **0**
 * immediately after `createPrismaClient()` and only became 5000 after ~300 ms.
 * A caller that created a client and wrote straight away therefore ran with
 * exactly the timeout this function is meant to prevent, and lost the race
 * with SQLITE_BUSY instead of waiting.
 */
const pragmasApplied = new WeakMap<SqlitePrismaClient, Promise<void>>();

function applySqlitePragmas(client: SqlitePrismaClient): void {
  const done = (async () => {
    try {
      await client.$queryRawUnsafe("PRAGMA journal_mode = WAL");
      await client.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
      await client.$queryRawUnsafe("PRAGMA synchronous = NORMAL");
    } catch (error) {
      console.warn("[uwe/database] failed to apply SQLite pragmas", error);
    }
  })();

  pragmasApplied.set(client, done);
}

/**
 * Resolves once the SQLite pragmas of `client` have been applied.
 *
 * Await this before the first write on a **freshly created** client. The shared
 * client (`prisma` / `getSharedPrismaClient`) is built at module load, so its
 * pragmas are long settled by the time any request arrives — there, awaiting is
 * a no-op and callers need not bother.
 *
 * Never rejects: a failed pragma is logged and the client stays usable, same as
 * before.
 */
export async function whenPragmasApplied(client: PrismaClient): Promise<void> {
  await pragmasApplied.get(client as SqlitePrismaClient);
}

function createSqliteClient(url: string): SqlitePrismaClient {
  const adapter = new PrismaLibSql({ url });
  const client = new SqlitePrismaClient({ adapter });
  applySqlitePragmas(client);
  return client;
}

function createPostgresClient(url: string): PostgresPrismaClient {
  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = new pg.Pool({
      connectionString: url,
      max: Number(process.env.UWE_PG_POOL_MAX ?? 10),
    });
  }

  const adapter = new PrismaPg(globalForPrisma.pgPool);
  return new PostgresPrismaClient({ adapter });
}

/** Process-wide SQLite singleton — avoids lock storms from per-request clients. */
export function getSharedPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createSqliteClient(resolveDatabaseUrl());
  }

  return globalForPrisma.prisma;
}

export function isSharedPrismaClient(client: PrismaClient): boolean {
  return client === globalForPrisma.prisma;
}

export async function disconnectPrismaClientIfOwned(client: PrismaClient): Promise<void> {
  if (!isSharedPrismaClient(client)) {
    await client.$disconnect();
  }
}

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  const url = resolveDatabaseUrl(databaseUrl);

  if (isPostgresDatabaseUrl(url)) {
    return createPostgresClient(url) as unknown as PrismaClient;
  }

  return createSqliteClient(url);
}

export const prisma = getSharedPrismaClient();

export { SqlitePrismaClient, PostgresPrismaClient };
