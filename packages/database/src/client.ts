import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "./generated/prisma/client";
import { isPostgresDatabaseUrl } from "./database-provider";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

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

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  const url = resolveDatabaseUrl(databaseUrl);

  if (isPostgresDatabaseUrl(url)) {
    throw new Error(
      "PostgreSQL DATABASE_URL detected, but schema.prisma still uses provider=sqlite. See docs/postgresql.md.",
    );
  }

  const adapter = new PrismaLibSql({ url });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type { PrismaClient };
