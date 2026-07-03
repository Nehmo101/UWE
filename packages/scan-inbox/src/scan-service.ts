/**
 * Scan-Inbox-Persistenz + Ablage. Business-Logik hier (CLAUDE.md „Goldene
 * Regel"); die reine Analyse liegt in `analyze.ts`. Die OCR-Text-Beschaffung
 * (PDF/Connector-Vision) wird von der aufrufenden Schicht übergeben.
 */
import {
  createLifeAdminService,
  toPrismaJsonValue,
  type PrismaClient,
} from "@uwe/database/server";
import { analyzeScanText } from "./analyze";
import type {
  ExtractedFields,
  ScanDocumentKind,
  ScanDocumentStatus,
  ScanFilingProposal,
  ScanFilingTarget,
  ScanPrivacyLevel,
} from "./scan-types";

export interface CreateScanInput {
  storageKey: string;
  mimeType: string;
  fileSize?: number;
  title?: string;
  privacyLevel?: ScanPrivacyLevel;
  worldId?: string | null;
}

export interface ScanDocumentRecord {
  id: string;
  title: string;
  status: string;
  privacyLevel: ScanPrivacyLevel;
  mimeType: string;
  ocrText: string;
  ocrEngine: string | null;
  detectedKind: ScanDocumentKind;
  detectionConfidence: string | null;
  extractedFields: ExtractedFields | null;
  proposal: ScanFilingProposal | null;
  uncertainties: string[];
  filedTargetType: string | null;
  filedTargetId: string | null;
  createdAt: Date;
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
    filedTargetType: row.filedTargetType,
    filedTargetId: row.filedTargetId,
    createdAt: row.createdAt,
  };
}

export class ScanInboxService {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateScanInput): Promise<ScanDocumentRecord> {
    const row = await this.db.scanDocument.create({
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
    const rows = await this.db.scanDocument.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toRecord);
  }

  async get(id: string): Promise<ScanDocumentRecord | null> {
    const row = await this.db.scanDocument.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  /** Speichert OCR-Text + Analyse und setzt den Status auf proposal_ready/uncertain. */
  async applyAnalysis(
    id: string,
    input: { ocrText: string; ocrEngine: string },
  ): Promise<ScanDocumentRecord> {
    const analysis = analyzeScanText(input.ocrText);
    const row = await this.db.scanDocument.update({
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
    await this.db.scanDocument.update({
      where: { id },
      data: { status: "waiting_for_rtx", errorMessage: message ?? null },
    });
  }

  async setConnectorJob(id: string, jobId: string): Promise<void> {
    await this.db.scanDocument.update({
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
    const scan = await this.db.scanDocument.findUnique({
      where: { id },
      select: { connectorJobId: true },
    });
    if (!scan?.connectorJobId) return this.get(id);

    const job = await this.db.connectorJob.findUnique({
      where: { id: scan.connectorJobId },
      select: { status: true, result: true, failedReason: true },
    });
    if (!job) {
      await this.db.scanDocument.update({
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
      await this.db.scanDocument.update({
        where: { id },
        data: { status: "uncertain", errorMessage: "Vision-Job lieferte keinen Text." },
      });
      return this.get(id);
    }

    if (job.status === "failed" || job.status === "expired") {
      await this.db.scanDocument.update({
        where: { id },
        data: { status: "uncertain", errorMessage: job.failedReason ?? `Vision-Job ${job.status}.` },
      });
      return this.get(id);
    }

    // Noch in Bearbeitung — Status bleibt analyzing.
    return this.get(id);
  }

  async reject(id: string): Promise<void> {
    await this.db.scanDocument.update({
      where: { id },
      data: { status: "rejected", rejectedAt: new Date() },
    });
  }

  async archive(id: string): Promise<void> {
    await this.db.scanDocument.update({ where: { id }, data: { status: "archived" } });
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
      const contract = await createLifeAdminService(this.db).createContractExpense({
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
      const capture = await this.db.captureEntry.create({
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
      const doc = await this.db.personalBrainDocument.create({
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
      const event = await this.db.calendarEvent.create({
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
      // Rezept-Entwurf aus dem OCR-Text; strukturierte Zutaten folgen in S3.
      const recipe = await this.db.recipe.create({
        data: {
          title: scan.proposal?.title || scan.title || "Aus Scan",
          status: "draft",
          steps: toPrismaJsonValue([]),
          notes: scan.ocrText,
          sourceScanId: id,
        },
      });
      targetType = "recipe";
      targetId = recipe.id;
    }

    await this.db.scanDocument.update({
      where: { id },
      data: { status: "filed", filedAt: new Date(), filedTargetType: targetType, filedTargetId: targetId },
    });
    return { targetType, targetId };
  }
}

export function createScanInboxService(db: PrismaClient): ScanInboxService {
  return new ScanInboxService(db);
}
