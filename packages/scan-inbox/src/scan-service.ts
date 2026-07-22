/**
 * Scan-Inbox-Persistenz + Ablage. Business-Logik hier (CLAUDE.md „Goldene
 * Regel"); die reine Analyse liegt in `analyze.ts`. Die OCR-Text-Beschaffung
 * (PDF/Connector-Vision) wird von der aufrufenden Schicht übergeben.
 */
import {
  createLifeAdminService,
  createUweRepositoryFromClient,
  slugifyPageTitle,
  toPrismaJsonValue,
  type PrismaClient,
} from "@uwe/database/server";
import type { BrainPrismaClient } from "@uwe/database/brain-client";
import { createKitchenService } from "@uwe/kitchen";
import { analyzeScanText } from "./analyze";
import { parseRecipeText } from "./parse-recipe";
import type {
  ExtractedFields,
  ScanDocumentKind,
  ScanDocumentRecord,
  ScanDocumentStatus,
  ScanFilingProposal,
  ScanFilingTarget,
  ScanPrivacyLevel,
} from "./scan-types";

export type { ScanDocumentRecord } from "./scan-types";

export interface CreateScanInput {
  storageKey: string;
  mimeType: string;
  fileSize?: number;
  title?: string;
  privacyLevel?: ScanPrivacyLevel;
  worldId?: string | null;
}

function toRecord(row: {
  id: string;
  title: string;
  status: string;
  privacyLevel: string;
  mimeType: string;
  ocrText: string;
  ocrEngine: string | null;
  detectedKind: string;
  detectionConfidence: string | null;
  extractedFields: unknown;
  proposal: unknown;
  uncertainties: unknown;
  worldId: string | null;
  filedTargetType: string | null;
  filedTargetId: string | null;
  createdAt: Date;
}): ScanDocumentRecord {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    privacyLevel: row.privacyLevel as ScanPrivacyLevel,
    mimeType: row.mimeType,
    ocrText: row.ocrText,
    ocrEngine: row.ocrEngine,
    detectedKind: row.detectedKind as ScanDocumentKind,
    detectionConfidence: row.detectionConfidence,
    extractedFields: (row.extractedFields as ExtractedFields | null) ?? null,
    proposal: (row.proposal as ScanFilingProposal | null) ?? null,
    uncertainties: Array.isArray(row.uncertainties) ? (row.uncertainties as string[]) : [],
    worldId: row.worldId,
    filedTargetType: row.filedTargetType,
    filedTargetId: row.filedTargetId,
    createdAt: row.createdAt,
  };
}

export class ScanInboxService {
  constructor(
    private readonly brainDb: BrainPrismaClient,
    private readonly db: PrismaClient,
  ) {}

  async create(input: CreateScanInput): Promise<ScanDocumentRecord> {
    const row = await this.brainDb.scanDocument.create({
      data: {
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        fileSize: input.fileSize ?? 0,
        title: input.title ?? "",
        privacyLevel: input.privacyLevel ?? "private",
        worldId: input.worldId ?? null,
      },
    });
    return toRecord(row);
  }

  async list(status?: ScanDocumentStatus): Promise<ScanDocumentRecord[]> {
    const rows = await this.brainDb.scanDocument.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toRecord);
  }

  async get(id: string): Promise<ScanDocumentRecord | null> {
    const row = await this.brainDb.scanDocument.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  /** Speichert OCR-Text + Analyse und setzt den Status auf proposal_ready/uncertain. */
  async applyAnalysis(
    id: string,
    input: { ocrText: string; ocrEngine: string },
  ): Promise<ScanDocumentRecord> {
    const analysis = analyzeScanText(input.ocrText);
    const row = await this.brainDb.scanDocument.update({
      where: { id },
      data: {
        ocrText: input.ocrText,
        ocrEngine: input.ocrEngine,
        detectedKind: analysis.detectedKind,
        detectionConfidence: analysis.confidence,
        extractedFields: toPrismaJsonValue(analysis.fields),
        proposal: toPrismaJsonValue(analysis.proposal),
        uncertainties: toPrismaJsonValue(analysis.uncertainties),
        title: analysis.proposal.title,
        status: analysis.needsReview ? "uncertain" : "proposal_ready",
      },
    });
    return toRecord(row);
  }

  async markWaitingForRtx(id: string, message?: string): Promise<void> {
    await this.brainDb.scanDocument.update({
      where: { id },
      data: { status: "waiting_for_rtx", errorMessage: message ?? null },
    });
  }

  async setConnectorJob(id: string, jobId: string): Promise<void> {
    await this.brainDb.scanDocument.update({
      where: { id },
      data: { status: "analyzing", connectorJobId: jobId },
    });
  }

  /**
   * Holt das Ergebnis eines fertigen `vision_extract`-Connector-Jobs ab und
   * schreibt es via Analyse zurück. Poll-on-demand (kein blockierendes Warten):
   * läuft der Job noch, bleibt der Scan auf `analyzing`.
   */
  async applyConnectorJobResult(id: string): Promise<ScanDocumentRecord | null> {
    const scan = await this.brainDb.scanDocument.findUnique({
      where: { id },
      select: { connectorJobId: true },
    });
    if (!scan?.connectorJobId) return this.get(id);

    const job = await this.db.connectorJob.findUnique({
      where: { id: scan.connectorJobId },
      select: { status: true, result: true, failedReason: true },
    });
    if (!job) {
      await this.brainDb.scanDocument.update({
        where: { id },
        data: { status: "uncertain", errorMessage: "Connector-Job nicht gefunden." },
      });
      return this.get(id);
    }

    if (job.status === "completed") {
      const text =
        job.result && typeof job.result === "object"
          ? String((job.result as Record<string, unknown>).text ?? "")
          : "";
      if (text.trim()) {
        return this.applyAnalysis(id, { ocrText: text, ocrEngine: "vision_llm" });
      }
      await this.brainDb.scanDocument.update({
        where: { id },
        data: { status: "uncertain", errorMessage: "Vision-Job lieferte keinen Text." },
      });
      return this.get(id);
    }

    if (job.status === "failed" || job.status === "expired") {
      await this.brainDb.scanDocument.update({
        where: { id },
        data: { status: "uncertain", errorMessage: job.failedReason ?? `Vision-Job ${job.status}.` },
      });
      return this.get(id);
    }

    // Noch in Bearbeitung — Status bleibt analyzing.
    return this.get(id);
  }

  async reject(id: string): Promise<void> {
    await this.brainDb.scanDocument.update({
      where: { id },
      data: { status: "rejected", rejectedAt: new Date() },
    });
  }

  async archive(id: string): Promise<void> {
    await this.brainDb.scanDocument.update({ where: { id }, data: { status: "archived" } });
  }

  /** Markiert einen Scan als DnD-Modus und ordnet ihn einer Welt zu. */
  async setDndWorld(id: string, worldId: string): Promise<ScanDocumentRecord | null> {
    await this.brainDb.scanDocument.update({
      where: { id },
      data: { privacyLevel: "dnd", worldId },
    });
    return this.get(id);
  }

  /**
   * Legt einen DnD-Scan als Draft-Seite in der Welt ab (nie Auto-Kanon). Handouts
   * bekommen einen player_text-Block (spielersicher), Sessionnotizen/Dungeon-Zettel
   * einen gm_note-Block (nur DM). Der DM überführt sie danach bewusst in den Kanon.
   */
  private async fileDndDraft(
    scan: ScanDocumentRecord,
    worldId: string,
    kind: "dnd_session_note" | "dnd_dungeon_note" | "dnd_handout",
  ): Promise<{ targetType: string; targetId: string | null }> {
    const pageType = kind === "dnd_handout" ? "handout" : kind === "dnd_dungeon_note" ? "dungeon" : "session";
    const title = scan.proposal?.title || scan.title || "Aus Scan";
    const blocks =
      kind === "dnd_handout"
        ? [{ type: "player_text" as const, sortOrder: 0, content: scan.ocrText, visibility: "player_visible" as const }]
        : [{ type: "gm_note" as const, sortOrder: 0, content: scan.ocrText, visibility: "dm_only" as const }];

    const page = await createUweRepositoryFromClient(this.db).createPage({
      worldId,
      title,
      slug: slugifyPageTitle(`${title}-${scan.id.slice(0, 6)}`),
      type: pageType,
      summary: scan.proposal?.rationale ?? "",
      canonicalStatus: "draft",
      publishStatus: "draft",
      contentBlocks: blocks,
    });
    return { targetType: "page", targetId: page.id };
  }

  /**
   * Legt das Dokument beim bestätigten Ziel ab. Nur explizit aufgerufen — nie
   * automatisch. Rückgabe: Typ/Id des angelegten Ziels.
   */
  async file(
    id: string,
    target: ScanFilingTarget,
  ): Promise<{ targetType: string; targetId: string | null }> {
    const scan = await this.get(id);
    if (!scan) throw new Error("Scan nicht gefunden.");
    const fields = scan.extractedFields ?? {};

    let targetType = target as string;
    let targetId: string | null = null;

    if (target === "contract") {
      const contract = await createLifeAdminService(this.brainDb, this.db).createContractExpense({
        name: scan.proposal?.title || scan.title || "Aus Scan",
        vendor: fields.vendor ?? undefined,
        amountCents: fields.amountCents ?? undefined,
        cancelByDate: fields.cancelByDate ? new Date(fields.cancelByDate) : undefined,
        renewalDate: fields.renewalDate ? new Date(fields.renewalDate) : undefined,
        nextPaymentDate: fields.dueDate ? new Date(fields.dueDate) : undefined,
      });
      targetType = "contract_expense";
      targetId = contract.id;
    } else if (target === "capture" || target === "todo") {
      const capture = await this.brainDb.captureEntry.create({
        data: {
          title: scan.title || "Aus Scan",
          content: scan.ocrText,
          captureType: target === "todo" ? "uwe_todo" : "quick_note",
          metadata: toPrismaJsonValue({ sourceScanId: id }),
        },
      });
      targetType = "capture";
      targetId = capture.id;
    } else if (target === "life_brain") {
      const doc = await this.brainDb.personalBrainDocument.create({
        data: {
          title: scan.proposal?.title || scan.title || "Aus Scan",
          content: scan.ocrText,
          category: "scan",
        },
      });
      targetType = "personal_brain_document";
      targetId = doc.id;
    } else if (target === "calendar_event") {
      const reminder = scan.proposal?.reminder;
      const startAt = reminder?.date ? new Date(reminder.date) : new Date();
      const event = await this.brainDb.calendarEvent.create({
        data: {
          title: `${reminder?.label ? `${reminder.label}: ` : ""}${scan.proposal?.title || scan.title || "Aus Scan"}`,
          startAt,
          allDay: true,
          kind: "personal",
        },
      });
      targetType = "calendar_event";
      targetId = event.id;
    } else if (target === "recipe") {
      // Rezept-Entwurf aus dem OCR-Text mit strukturierten Zutaten + Schritten
      // (S3). Der Parser ist best-effort — ohne erkennbare Abschnitte bleibt der
      // volle OCR-Text als Notiz erhalten. Rezept-Writes gehören zu @uwe/kitchen.
      const parsed = parseRecipeText(scan.ocrText);
      const recipe = await createKitchenService(this.brainDb, this.db).createRecipe({
        title: scan.proposal?.title || scan.title || "Aus Scan",
        status: "draft",
        steps: parsed.steps,
        ingredients: parsed.ingredients,
        notes: scan.ocrText,
        sourceScanId: id,
      });
      targetType = "recipe";
      targetId = recipe.id;
    } else if (
      target === "dnd_session_note" ||
      target === "dnd_handout"
    ) {
      const scanRow = await this.brainDb.scanDocument.findUnique({
        where: { id },
        select: { worldId: true, detectedKind: true },
      });
      if (!scanRow?.worldId) {
        throw new Error("DnD-Ablage benötigt eine zugeordnete Welt (DnD-Modus setzen).");
      }
      const kind = target === "dnd_handout"
        ? "dnd_handout"
        : scanRow.detectedKind === "dnd_dungeon_note"
          ? "dnd_dungeon_note"
          : "dnd_session_note";
      const result = await this.fileDndDraft(scan, scanRow.worldId, kind);
      targetType = result.targetType;
      targetId = result.targetId;
    }

    await this.brainDb.scanDocument.update({
      where: { id },
      data: { status: "filed", filedAt: new Date(), filedTargetType: targetType, filedTargetId: targetId },
    });
    return { targetType, targetId };
  }
}

export function createScanInboxService(brainDb: BrainPrismaClient, db: PrismaClient): ScanInboxService {
  return new ScanInboxService(brainDb, db);
}
