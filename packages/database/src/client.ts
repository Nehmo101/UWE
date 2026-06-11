import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "./generated/prisma/client";

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
  const adapter = new PrismaLibSql({
    url: resolveDatabaseUrl(databaseUrl),
  });

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
