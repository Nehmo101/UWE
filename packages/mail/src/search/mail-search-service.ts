import type { BrainPrismaClient as PrismaClient } from "@uwe/database/brain-client";
import { buildFtsMatchExpression } from "./query-parser";

/**
 * Full-text search over mail_inbox_messages using the SQLite FTS5 virtual
 * table (mail_messages_fts). Returns the matching message ids ranked by FTS
 * relevance, or null when FTS is unavailable (e.g. Postgres deployments) so the
 * caller can fall back to a LIKE/contains query.
 */
export async function ftsSearchMessageIds(
  db: PrismaClient,
  text: string,
  options?: { limit?: number },
): Promise<string[] | null> {
  const match = buildFtsMatchExpression(text);
  if (!match) return null;
  const limit = options?.limit ?? 500;
  try {
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT m."id" AS id
         FROM "mail_messages_fts" f
         JOIN "mail_inbox_messages" m ON m."rowid" = f."rowid"
        WHERE "mail_messages_fts" MATCH ?
        ORDER BY f."rank"
        LIMIT ?`,
      match,
      limit,
    );
    return rows.map((row) => row.id);
  } catch {
    // FTS table missing (Postgres) or malformed match → signal contains-fallback.
    return null;
  }
}
