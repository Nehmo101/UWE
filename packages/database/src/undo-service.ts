import type { PrismaClient } from "./client";
import type {
  CanonicalStatus,
  ContentBlockType,
  PageType,
  PublishStatus,
  Visibility,
} from "./generated/prisma/client";

/**
 * Undo basis (soft delete light): before a destructive or automatic change
 * (inspector fix, block deletion, page deletion), a JSON snapshot of the
 * previous state is stored as an `UndoEntry`. `undo()` restores the snapshot
 * and marks the entry as consumed. The activity log references these entries
 * so a future "undo from the activity log" only needs the entry id.
 */

export type UndoOperation =
  | "page.update"
  | "page.delete"
  | "block.update"
  | "block.delete";

interface PageSnapshot {
  kind: "page";
  page: {
    id: string;
    worldId: string;
    campaignId: string | null;
    parentPageId: string | null;
    title: string;
    slug: string;
    type: PageType;
    summary: string | null;
    visibility: Visibility;
    publishStatus: PublishStatus;
    canonicalStatus: CanonicalStatus;
    tags: unknown;
    aliases: unknown;
  };
  blocks?: BlockSnapshot["block"][];
}

interface BlockSnapshot {
  kind: "block";
  block: {
    id: string;
    pageId: string;
    assetId: string | null;
    type: ContentBlockType;
    sortOrder: number;
    content: string;
    visibility: Visibility;
    metadata: unknown;
  };
}

type UndoSnapshot = PageSnapshot | BlockSnapshot;

export interface UndoResult {
  ok: boolean;
  message: string;
}

function asJson(value: unknown) {
  return value == null ? undefined : JSON.parse(JSON.stringify(value));
}

export class UndoService {
  constructor(private readonly db: PrismaClient) {}

  /** Snapshot a page's scalar state before an update. */
  async capturePageUpdate(pageId: string, operation: UndoOperation = "page.update") {
    const page = await this.db.page.findUnique({ where: { id: pageId } });
    if (!page) throw new Error(`Seite ${pageId} nicht gefunden.`);

    const snapshot: PageSnapshot = {
      kind: "page",
      page: {
        id: page.id,
        worldId: page.worldId,
        campaignId: page.campaignId,
        parentPageId: page.parentPageId,
        title: page.title,
        slug: page.slug,
        type: page.type,
        summary: page.summary,
        visibility: page.visibility,
        publishStatus: page.publishStatus,
        canonicalStatus: page.canonicalStatus,
        tags: page.tags,
        aliases: page.aliases,
      },
    };

    return this.db.undoEntry.create({
      data: {
        worldId: page.worldId,
        operation,
        targetType: "page",
        targetId: page.id,
        snapshot: asJson(snapshot),
      },
    });
  }

  /** Snapshot a full page including its content blocks before deletion. */
  async capturePageDelete(pageId: string) {
    const page = await this.db.page.findUnique({
      where: { id: pageId },
      include: { contentBlocks: { orderBy: { sortOrder: "asc" } } },
    });
    if (!page) throw new Error(`Seite ${pageId} nicht gefunden.`);

    const snapshot: PageSnapshot = {
      kind: "page",
      page: {
        id: page.id,
        worldId: page.worldId,
        campaignId: page.campaignId,
        parentPageId: page.parentPageId,
        title: page.title,
        slug: page.slug,
        type: page.type,
        summary: page.summary,
        visibility: page.visibility,
        publishStatus: page.publishStatus,
        canonicalStatus: page.canonicalStatus,
        tags: page.tags,
        aliases: page.aliases,
      },
      blocks: page.contentBlocks.map((block) => ({
        id: block.id,
        pageId: block.pageId,
        assetId: block.assetId,
        type: block.type,
        sortOrder: block.sortOrder,
        content: block.content,
        visibility: block.visibility,
        metadata: block.metadata,
      })),
    };

    return this.db.undoEntry.create({
      data: {
        worldId: page.worldId,
        operation: "page.delete" satisfies UndoOperation,
        targetType: "page",
        targetId: page.id,
        snapshot: asJson(snapshot),
      },
    });
  }

  /** Snapshot a content block before an update or deletion. */
  async captureBlock(blockId: string, operation: "block.update" | "block.delete") {
    const block = await this.db.contentBlock.findUnique({
      where: { id: blockId },
      include: { page: { select: { worldId: true } } },
    });
    if (!block) throw new Error(`Block ${blockId} nicht gefunden.`);

    const snapshot: BlockSnapshot = {
      kind: "block",
      block: {
        id: block.id,
        pageId: block.pageId,
        assetId: block.assetId,
        type: block.type,
        sortOrder: block.sortOrder,
        content: block.content,
        visibility: block.visibility,
        metadata: block.metadata,
      },
    };

    return this.db.undoEntry.create({
      data: {
        worldId: block.page.worldId,
        operation,
        targetType: "content_block",
        targetId: block.id,
        snapshot: asJson(snapshot),
      },
    });
  }

  /**
   * Restore the snapshot of an undo entry. Restores are conservative: if the
   * target no longer exists for an update snapshot, the undo fails with a
   * clear message instead of guessing.
   */
  async undo(entryId: string): Promise<UndoResult> {
    const entry = await this.db.undoEntry.findUnique({ where: { id: entryId } });
    if (!entry) return { ok: false, message: "Undo-Eintrag nicht gefunden." };
    if (entry.undoneAt) {
      return { ok: false, message: "Diese Änderung wurde bereits rückgängig gemacht." };
    }

    const snapshot = entry.snapshot as unknown as UndoSnapshot;

    if (snapshot.kind === "page") {
      const result = await this.restorePage(entry.operation as UndoOperation, snapshot);
      if (result.ok) await this.markUndone(entryId);
      return result;
    }

    if (snapshot.kind === "block") {
      const result = await this.restoreBlock(entry.operation as UndoOperation, snapshot);
      if (result.ok) await this.markUndone(entryId);
      return result;
    }

    return { ok: false, message: "Unbekanntes Undo-Snapshot-Format." };
  }

  private async markUndone(entryId: string) {
    await this.db.undoEntry.update({
      where: { id: entryId },
      data: { undoneAt: new Date() },
    });
  }

  private async restorePage(
    operation: UndoOperation,
    snapshot: PageSnapshot,
  ): Promise<UndoResult> {
    const data = snapshot.page;

    if (operation === "page.delete") {
      const existing = await this.db.page.findUnique({ where: { id: data.id } });
      if (existing) {
        return { ok: false, message: `Seite „${data.title}“ existiert bereits wieder.` };
      }

      const slugTaken = await this.db.page.findFirst({
        where: { worldId: data.worldId, slug: data.slug },
      });
      if (slugTaken) {
        return {
          ok: false,
          message: `Slug „${data.slug}“ ist inzwischen anderweitig vergeben.`,
        };
      }

      await this.db.page.create({
        data: {
          id: data.id,
          worldId: data.worldId,
          campaignId: data.campaignId,
          parentPageId: data.parentPageId,
          title: data.title,
          slug: data.slug,
          type: data.type,
          summary: data.summary,
          visibility: data.visibility,
          publishStatus: data.publishStatus,
          canonicalStatus: data.canonicalStatus,
          tags: asJson(data.tags),
          aliases: asJson(data.aliases),
          contentBlocks: {
            create: (snapshot.blocks ?? []).map((block) => ({
              id: block.id,
              assetId: block.assetId,
              type: block.type,
              sortOrder: block.sortOrder,
              content: block.content,
              visibility: block.visibility,
              metadata: asJson(block.metadata),
            })),
          },
        },
      });

      return { ok: true, message: `Seite „${data.title}“ wiederhergestellt.` };
    }

    const existing = await this.db.page.findUnique({ where: { id: data.id } });
    if (!existing) {
      return {
        ok: false,
        message: `Seite „${data.title}“ existiert nicht mehr — Undo nicht möglich.`,
      };
    }

    await this.db.page.update({
      where: { id: data.id },
      data: {
        campaignId: data.campaignId,
        parentPageId: data.parentPageId,
        title: data.title,
        slug: data.slug,
        type: data.type,
        summary: data.summary,
        visibility: data.visibility,
        publishStatus: data.publishStatus,
        canonicalStatus: data.canonicalStatus,
        tags: asJson(data.tags),
        aliases: asJson(data.aliases),
      },
    });

    return { ok: true, message: `Seite „${data.title}“ auf vorherigen Stand zurückgesetzt.` };
  }

  private async restoreBlock(
    operation: UndoOperation,
    snapshot: BlockSnapshot,
  ): Promise<UndoResult> {
    const data = snapshot.block;

    if (operation === "block.delete") {
      const existing = await this.db.contentBlock.findUnique({ where: { id: data.id } });
      if (existing) {
        return { ok: false, message: "Block existiert bereits wieder." };
      }

      const page = await this.db.page.findUnique({ where: { id: data.pageId } });
      if (!page) {
        return {
          ok: false,
          message: "Die zugehörige Seite existiert nicht mehr — Undo nicht möglich.",
        };
      }

      await this.db.contentBlock.create({
        data: {
          id: data.id,
          pageId: data.pageId,
          assetId: data.assetId,
          type: data.type,
          sortOrder: data.sortOrder,
          content: data.content,
          visibility: data.visibility,
          metadata: asJson(data.metadata),
        },
      });

      return { ok: true, message: "Block wiederhergestellt." };
    }

    const existing = await this.db.contentBlock.findUnique({ where: { id: data.id } });
    if (!existing) {
      return { ok: false, message: "Block existiert nicht mehr — Undo nicht möglich." };
    }

    await this.db.contentBlock.update({
      where: { id: data.id },
      data: {
        type: data.type,
        sortOrder: data.sortOrder,
        content: data.content,
        visibility: data.visibility,
        metadata: asJson(data.metadata),
      },
    });

    return { ok: true, message: "Block auf vorherigen Stand zurückgesetzt." };
  }
}

export function createUndoService(db: PrismaClient): UndoService {
  return new UndoService(db);
}
