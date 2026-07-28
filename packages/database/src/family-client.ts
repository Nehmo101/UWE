import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient as FamilySqliteClient } from "./generated/prisma-family/client";

/**
 * Shared Family database client (`uwe-family.db`).
 *
 * Der dritte Datenspeicher neben `uwe.db` (D&D) und `uwe-brain.db` (owner-privat).
 * Family-Daten — Verträge, Dokumente, Küche, Haushalt, Kalender, Scan-Eingang —
 * sind bewusst *nicht* owner-privat: wer das Häkchen `Family` hat, sieht alles
 * darin (Notiz Lasse, Abschnitt G15). Genau deshalb liegen sie nicht in der
 * Brain-DB.
 *
 * Wie die Brain-DB: immer lokales SQLite, kein Postgres-Laufzeitpfad, eigener
 * generierter Client — ein Tippfehler, der Family-Daten über den Brain-Client
 * lesen will, ist damit ein Compile-Fehler.
 */
const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export type FamilyPrismaClient = FamilySqliteClient;

export function resolveFamilyDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.FAMILY_DATABASE_URL ?? "file:./data/uwe-family.db";

  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    if (path.isAbsolute(filePath)) {
      return url;
    }

    return `file:${path.resolve(packageRoot, "..", filePath)}`;
  }

  return url;
}

const globalForFamily = globalThis as unknown as {
  familyPrisma?: FamilyPrismaClient;
};

/** WAL + busy_timeout, same rationale as the core and Brain clients. Best-effort. */
function applyFamilyPragmas(client: FamilySqliteClient): void {
  void (async () => {
    try {
      await client.$queryRawUnsafe("PRAGMA journal_mode = WAL");
      await client.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
      await client.$queryRawUnsafe("PRAGMA synchronous = NORMAL");
    } catch (error) {
      console.warn("[uwe/database] failed to apply Family SQLite pragmas", error);
    }
  })();
}

function createFamilySqliteClient(url: string): FamilySqliteClient {
  const adapter = new PrismaLibSql({ url });
  const client = new FamilySqliteClient({ adapter });
  applyFamilyPragmas(client);
  return client;
}

/** Process-wide Family SQLite singleton — mirrors getSharedBrainPrismaClient(). */
export function getSharedFamilyPrismaClient(): FamilyPrismaClient {
  if (!globalForFamily.familyPrisma) {
    globalForFamily.familyPrisma = createFamilySqliteClient(resolveFamilyDatabaseUrl());
  }

  return globalForFamily.familyPrisma;
}

export function isSharedFamilyPrismaClient(client: FamilyPrismaClient): boolean {
  return client === globalForFamily.familyPrisma;
}

export async function disconnectFamilyPrismaClientIfOwned(
  client: FamilyPrismaClient,
): Promise<void> {
  if (!isSharedFamilyPrismaClient(client)) {
    await client.$disconnect();
  }
}

export function createFamilyPrismaClient(databaseUrl?: string): FamilyPrismaClient {
  return createFamilySqliteClient(resolveFamilyDatabaseUrl(databaseUrl));
}

export const familyPrisma = getSharedFamilyPrismaClient();

export { FamilySqliteClient };
