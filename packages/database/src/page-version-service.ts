import type { PrismaClient } from "./client";
import { toPrismaJsonValue } from "./json-utils";

export interface PageVersionRecord {
  id: string;
  pageId: string;
  version: number;
  snapshot: unknown;
  createdBy: string | null;
  createdAt: Date;
}

/** Prisma raises P2002 when a unique constraint (here: pageId_version) is violated. */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export class PageVersionService {
  constructor(private readonly db: PrismaClient) {}

  async list(pageId: string): Promise<PageVersionRecord[]> {
    const rows = await this.db.pageVersion.findMany({
      where: { pageId },
      orderBy: { version: "desc" },
    });
    return rows;
  }

  async createSnapshot(pageId: string, snapshot: unknown, createdBy?: string | null) {
    const data = toPrismaJsonValue(snapshot);
    // Two concurrent snapshots of the same page can read the same latest
    // version and both compute the same next number, violating the
    // pageId_version unique constraint. Retry on that collision instead of
    // losing a snapshot to a 500.
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const latest = await this.db.pageVersion.findFirst({
        where: { pageId },
        orderBy: { version: "desc" },
      });
      const version = (latest?.version ?? 0) + 1;
      try {
        return await this.db.pageVersion.create({
          data: {
            pageId,
            version,
            snapshot: data,
            createdBy: createdBy ?? null,
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error) && attempt < maxAttempts) {
          continue;
        }
        throw error;
      }
    }
    throw new Error(
      `Failed to create a page version snapshot for page ${pageId} after ${maxAttempts} attempts`,
    );
  }

  async restore(pageId: string, version: number): Promise<PageVersionRecord | null> {
    const row = await this.db.pageVersion.findUnique({
      where: { pageId_version: { pageId, version } },
    });
    return row;
  }
}

export function createPageVersionService(db: PrismaClient): PageVersionService {
  return new PageVersionService(db);
}
