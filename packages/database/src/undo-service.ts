import type { PrismaClient } from "./client";
import { toPrismaJsonValue } from "./json-utils";
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
  | "block.delete"
  | "ai.page.create"
  | "ai.block.create"
  | "ai.session.recap"
  | "ai.session.summary_dm"
  | "ai.brain_document.create"
  | "import.execute"
  | "import_central.execute";

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

interface AiPageCreateSnapshot {
  kind: "ai_page_create";
  pageId: string;
}

interface AiBlockCreateSnapshot {
  kind: "ai_block_create";
  blockId: string;
}

interface SessionRecapSnapshot {
  kind: "session_recap";
  sessionId: string;
  summaryPlayer: string | null;
  status: string;
}

interface SessionSummaryDmSnapshot {
  kind: "session_summary_dm";
  sessionId: string;
  summaryDm: string | null;
}

interface BrainDocumentCreateSnapshot {
  kind: "brain_document_create";
  documentId: string;
}

export interface ImportPageUpdateSnapshot {
  pageId: string;
  page: PageSnapshot["page"];
  previousBlockIds: string[];
  addedBlockIds: string[];
}

interface ImportExecuteSnapshot {
  kind: "import_execute";
  worldId: string;
  jobId?: string;
  createdPageIds: string[];
  updatedPages: ImportPageUpdateSnapshot[];
}

interface ImportCentralExecuteSnapshot {
  kind: "import_central_execute";
  targetType: "personal_brain" | "capture" | "dnd_page";
  worldId?: string | null;
  jobId?: string;
  createdPersonalBrainDocumentIds: string[];
  createdCaptureIds: string[];
  createdPageIds: string[];
}

type UndoSnapshot =
  | PageSnapshot
  | BlockSnapshot
  | AiPageCreateSnapshot
  | AiBlockCreateSnapshot
  | SessionRecapSnapshot
  | SessionSummaryDmSnapshot
  | BrainDocumentCreateSnapshot
  | ImportExecuteSnapshot
  | ImportCentralExecuteSnapshot;

export interface UndoResult {
  ok: boolean;
  message: string;
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
        snapshot: toPrismaJsonValue(snapshot),
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
        snapshot: toPrismaJsonValue(snapshot),
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
        snapshot: toPrismaJsonValue(snapshot),
      },
    });
  }

  /** Snapshot before AI apply creates a new idea page (undo = delete page). */
  async captureAiPageCreate(pageId: string, worldId: string) {
    return this.db.undoEntry.create({
      data: {
        worldId,
        operation: "ai.page.create" satisfies UndoOperation,
        targetType: "page",
        targetId: pageId,
        snapshot: toPrismaJsonValue({ kind: "ai_page_create", pageId }),
      },
    });
  }

  /** Snapshot before AI apply creates a content block (undo = delete block). */
  async captureAiBlockCreate(blockId: string, worldId: string) {
    return this.db.undoEntry.create({
      data: {
        worldId,
        operation: "ai.block.create" satisfies UndoOperation,
        targetType: "content_block",
        targetId: blockId,
        snapshot: toPrismaJsonValue({ kind: "ai_block_create", blockId }),
      },
    });
  }

  /** Snapshot player recap before AI apply overwrites it. */
  async captureSessionRecap(sessionId: string) {
    const session = await this.db.gameSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new Error(`Session ${sessionId} nicht gefunden.`);

    const snapshot: SessionRecapSnapshot = {
      kind: "session_recap",
      sessionId: session.id,
      summaryPlayer: session.summaryPlayer,
      status: session.status,
    };

    return this.db.undoEntry.create({
      data: {
        worldId: session.worldId,
        operation: "ai.session.recap" satisfies UndoOperation,
        targetType: "game_session",
        targetId: session.id,
        snapshot: toPrismaJsonValue(snapshot),
      },
    });
  }

  /** Snapshot DM session summary before AI apply overwrites it. */
  async captureSessionSummaryDm(sessionId: string) {
    const session = await this.db.gameSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new Error(`Session ${sessionId} nicht gefunden.`);

    const snapshot: SessionSummaryDmSnapshot = {
      kind: "session_summary_dm",
      sessionId: session.id,
      summaryDm: session.summaryDm,
    };

    return this.db.undoEntry.create({
      data: {
        worldId: session.worldId,
        operation: "ai.session.summary_dm" satisfies UndoOperation,
        targetType: "game_session",
        targetId: session.id,
        snapshot: toPrismaJsonValue(snapshot),
      },
    });
  }

  /** Snapshot before AI apply creates a brain document (undo = delete document). */
  async captureBrainDocumentCreate(documentId: string, worldId: string) {
    return this.db.undoEntry.create({
      data: {
        worldId,
        operation: "ai.brain_document.create" satisfies UndoOperation,
        targetType: "brain_document",
        targetId: documentId,
        snapshot: toPrismaJsonValue({ kind: "brain_document_create", documentId }),
      },
    });
  }

  /** Batch snapshot for a completed import job. */
  async captureImportExecute(input: {
    worldId: string;
    jobId?: string;
    createdPageIds: string[];
    updatedPages: ImportPageUpdateSnapshot[];
  }) {
    const snapshot: ImportExecuteSnapshot = {
      kind: "import_execute",
      worldId: input.worldId,
      jobId: input.jobId,
      createdPageIds: input.createdPageIds,
      updatedPages: input.updatedPages,
    };

    return this.db.undoEntry.create({
      data: {
        worldId: input.worldId,
        operation: "import.execute" satisfies UndoOperation,
        targetType: "world",
        targetId: input.jobId ?? input.worldId,
        snapshot: toPrismaJsonValue(snapshot),
      },
    });
  }

  /** Batch snapshot for a completed Import-Zentrale markdown job. */
  async captureImportCentralExecute(input: {
    targetType: "personal_brain" | "capture" | "dnd_page";
    worldId?: string | null;
    jobId?: string;
    createdPersonalBrainDocumentIds?: string[];
    createdCaptureIds?: string[];
    createdPageIds?: string[];
  }) {
    const snapshot: ImportCentralExecuteSnapshot = {
      kind: "import_central_execute",
      targetType: input.targetType,
      worldId: input.worldId ?? null,
      jobId: input.jobId,
      createdPersonalBrainDocumentIds: input.createdPersonalBrainDocumentIds ?? [],
      createdCaptureIds: input.createdCaptureIds ?? [],
      createdPageIds: input.createdPageIds ?? [],
    };

    const total =
      snapshot.createdPersonalBrainDocumentIds.length +
      snapshot.createdCaptureIds.length +
      snapshot.createdPageIds.length;

    if (total === 0) {
      return null;
    }

    return this.db.undoEntry.create({
      data: {
        worldId: input.worldId ?? null,
        operation: "import_central.execute" satisfies UndoOperation,
        targetType: "system",
        targetId: input.jobId ?? `import-central-${input.targetType}`,
        snapshot: toPrismaJsonValue(snapshot),
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

    if (snapshot.kind === "ai_page_create") {
      const result = await this.undoAiPageCreate(snapshot);
      if (result.ok) await this.markUndone(entryId);
      return result;
    }

    if (snapshot.kind === "ai_block_create") {
      const result = await this.undoAiBlockCreate(snapshot);
      if (result.ok) await this.markUndone(entryId);
      return result;
    }

    if (snapshot.kind === "session_recap") {
      const result = await this.restoreSessionRecap(snapshot);
      if (result.ok) await this.markUndone(entryId);
      return result;
    }

    if (snapshot.kind === "session_summary_dm") {
      const result = await this.restoreSessionSummaryDm(snapshot);
      if (result.ok) await this.markUndone(entryId);
      return result;
    }

    if (snapshot.kind === "brain_document_create") {
      const result = await this.undoBrainDocumentCreate(snapshot);
      if (result.ok) await this.markUndone(entryId);
      return result;
    }

    if (snapshot.kind === "import_execute") {
      const result = await this.undoImportExecute(snapshot);
      if (result.ok) await this.markUndone(entryId);
      return result;
    }

    if (snapshot.kind === "import_central_execute") {
      const result = await this.undoImportCentralExecute(snapshot);
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
          tags: toPrismaJsonValue(data.tags),
          aliases: toPrismaJsonValue(data.aliases),
          contentBlocks: {
            create: (snapshot.blocks ?? []).map((block) => ({
              id: block.id,
              assetId: block.assetId,
              type: block.type,
              sortOrder: block.sortOrder,
              content: block.content,
              visibility: block.visibility,
              metadata: toPrismaJsonValue(block.metadata),
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
        tags: toPrismaJsonValue(data.tags),
        aliases: toPrismaJsonValue(data.aliases),
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
          metadata: toPrismaJsonValue(data.metadata),
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
        metadata: toPrismaJsonValue(data.metadata),
      },
    });

    return { ok: true, message: "Block auf vorherigen Stand zurückgesetzt." };
  }

  private async undoAiPageCreate(snapshot: AiPageCreateSnapshot): Promise<UndoResult> {
    const page = await this.db.page.findUnique({ where: { id: snapshot.pageId } });
    if (!page) {
      return { ok: false, message: "Die übernommene Idee-Seite existiert nicht mehr." };
    }

    await this.db.page.delete({ where: { id: snapshot.pageId } });
    return { ok: true, message: `KI-Idee-Seite „${page.title}“ rückgängig gemacht (gelöscht).` };
  }

  private async undoAiBlockCreate(snapshot: AiBlockCreateSnapshot): Promise<UndoResult> {
    const block = await this.db.contentBlock.findUnique({ where: { id: snapshot.blockId } });
    if (!block) {
      return { ok: false, message: "Der übernommene ContentBlock existiert nicht mehr." };
    }

    await this.db.contentBlock.delete({ where: { id: snapshot.blockId } });
    return { ok: true, message: "KI-ContentBlock rückgängig gemacht (gelöscht)." };
  }

  private async restoreSessionRecap(snapshot: SessionRecapSnapshot): Promise<UndoResult> {
    const session = await this.db.gameSession.findUnique({ where: { id: snapshot.sessionId } });
    if (!session) {
      return { ok: false, message: "Session existiert nicht mehr — Undo nicht möglich." };
    }

    await this.db.gameSession.update({
      where: { id: snapshot.sessionId },
      data: {
        summaryPlayer: snapshot.summaryPlayer,
        status: snapshot.status as import("./generated/prisma/client").GameSessionStatus,
      },
    });

    return { ok: true, message: "Spieler-Recap auf vorherigen Stand zurückgesetzt." };
  }

  private async restoreSessionSummaryDm(snapshot: SessionSummaryDmSnapshot): Promise<UndoResult> {
    const session = await this.db.gameSession.findUnique({ where: { id: snapshot.sessionId } });
    if (!session) {
      return { ok: false, message: "Session existiert nicht mehr — Undo nicht möglich." };
    }

    await this.db.gameSession.update({
      where: { id: snapshot.sessionId },
      data: { summaryDm: snapshot.summaryDm },
    });

    return { ok: true, message: "DM-Session-Recap auf vorherigen Stand zurückgesetzt." };
  }

  private async undoBrainDocumentCreate(snapshot: BrainDocumentCreateSnapshot): Promise<UndoResult> {
    const doc = await this.db.brainDocument.findUnique({ where: { id: snapshot.documentId } });
    if (!doc) {
      return { ok: false, message: "Das Brain-Dokument existiert nicht mehr." };
    }

    await this.db.brainDocument.delete({ where: { id: snapshot.documentId } });
    return { ok: true, message: `Brain-Dokument „${doc.title}“ rückgängig gemacht (gelöscht).` };
  }

  private async undoImportExecute(snapshot: ImportExecuteSnapshot): Promise<UndoResult> {
    for (const pageId of snapshot.createdPageIds) {
      const page = await this.db.page.findUnique({ where: { id: pageId } });
      if (page) {
        await this.db.page.delete({ where: { id: pageId } });
      }
    }

    for (const update of snapshot.updatedPages) {
      const existing = await this.db.page.findUnique({ where: { id: update.pageId } });
      if (!existing) continue;

      await this.db.page.update({
        where: { id: update.pageId },
        data: {
          campaignId: update.page.campaignId,
          parentPageId: update.page.parentPageId,
          title: update.page.title,
          slug: update.page.slug,
          type: update.page.type,
          summary: update.page.summary,
          visibility: update.page.visibility,
          publishStatus: update.page.publishStatus,
          canonicalStatus: update.page.canonicalStatus,
          tags: toPrismaJsonValue(update.page.tags),
          aliases: toPrismaJsonValue(update.page.aliases),
        },
      });

      if (update.addedBlockIds.length > 0) {
        await this.db.contentBlock.deleteMany({
          where: { id: { in: update.addedBlockIds } },
        });
      }
    }

    const total = snapshot.createdPageIds.length + snapshot.updatedPages.length;
    if (total === 0) {
      return { ok: false, message: "Import-Undo enthält keine Änderungen." };
    }

    return {
      ok: true,
      message: `Import rückgängig gemacht (${snapshot.createdPageIds.length} Seiten gelöscht, ${snapshot.updatedPages.length} Updates zurückgesetzt).`,
    };
  }

  private async undoImportCentralExecute(
    snapshot: ImportCentralExecuteSnapshot,
  ): Promise<UndoResult> {
    for (const documentId of snapshot.createdPersonalBrainDocumentIds) {
      const doc = await this.db.personalBrainDocument.findUnique({ where: { id: documentId } });
      if (doc) {
        await this.db.personalBrainDocument.delete({ where: { id: documentId } });
      }
    }

    for (const captureId of snapshot.createdCaptureIds) {
      const capture = await this.db.captureEntry.findUnique({ where: { id: captureId } });
      if (capture) {
        await this.db.captureEntry.delete({ where: { id: captureId } });
      }
    }

    for (const pageId of snapshot.createdPageIds) {
      const page = await this.db.page.findUnique({ where: { id: pageId } });
      if (page) {
        await this.db.page.delete({ where: { id: pageId } });
      }
    }

    const total =
      snapshot.createdPersonalBrainDocumentIds.length +
      snapshot.createdCaptureIds.length +
      snapshot.createdPageIds.length;

    if (total === 0) {
      return { ok: false, message: "Import-Undo enthält keine Änderungen." };
    }

    const parts: string[] = [];
    if (snapshot.createdPersonalBrainDocumentIds.length > 0) {
      parts.push(`${snapshot.createdPersonalBrainDocumentIds.length} Life-Brain-Dokument(e)`);
    }
    if (snapshot.createdCaptureIds.length > 0) {
      parts.push(`${snapshot.createdCaptureIds.length} Capture-Einträge`);
    }
    if (snapshot.createdPageIds.length > 0) {
      parts.push(`${snapshot.createdPageIds.length} DnD-Seite(n)`);
    }

    return {
      ok: true,
      message: `Markdown-Import rückgängig gemacht (${parts.join(", ")} gelöscht).`,
    };
  }
}

export function createUndoService(db: PrismaClient): UndoService {
  return new UndoService(db);
}
