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
    const latest = await this.db.pageVersion.findFirst({
      where: { pageId },
      orderBy: { version: "desc" },
    });
    const version = (latest?.version ?? 0) + 1;
    return this.db.pageVersion.create({
      data: {
        pageId,
        version,
        snapshot: toPrismaJsonValue(snapshot),
        createdBy: createdBy ?? null,
      },
    });
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
