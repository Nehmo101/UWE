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

function createSqliteClient(url: string): SqlitePrismaClient {
  const adapter = new PrismaLibSql({ url });
  return new SqlitePrismaClient({ adapter });
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
