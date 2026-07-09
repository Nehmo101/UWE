/**
 * Host-side label print queue — creates connector jobs and renders documents
 * for the RTX connector to fetch over the LAN (connector token auth only).
 */

import {
  labelPrintDocumentPath,
  normalizeLocalPrinters,
  parseLabelPrintJobPayload,
  type LabelPrintFormat,
  type LocalPrinterInfo,
} from "@uwe/connector";

import type { ConnectorJob } from "./generated/prisma/client";
import { createPrismaClient, prisma, type PrismaClient } from "./client";
import { ConnectorService, createConnectorService } from "./connector-service";
import { renderMultiLabelHtml, renderMultiLabelPdfAsync } from "./label-export";
import { PrintListService } from "./label-print-list-service";
import { toPrismaJsonValue } from "./json-utils";
import {
  assertPlayerSafeExport,
  normalizeLabel,
} from "./label-service";
import { stripDmOnlyForPlayer } from "./label-safety";

export type LabelPrintQueueStatus =
  | "pending"
  | "claimed"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export const LABEL_PRINT_QUEUE_STATUS_LABELS: Record<LabelPrintQueueStatus, string> = {
  pending: "Wartend",
  claimed: "Übernommen",
  running: "Druckt",
  completed: "Fertig",
  failed: "Fehler",
  cancelled: "Abgebrochen",
  expired: "Abgelaufen",
};

/** Simplified batch-progress phase for print-list detail UI (#751). */
export type PrintListBatchJobPhase = "queued" | "printing" | "done" | "failed";

export const PRINT_LIST_BATCH_JOB_PHASE_LABELS: Record<PrintListBatchJobPhase, string> = {
  queued: "In Warteschlange",
  printing: "Druckt",
  done: "Fertig",
  failed: "Fehler",
};

export function toPrintListBatchJobPhase(status: LabelPrintQueueStatus): PrintListBatchJobPhase {
  if (status === "pending") return "queued";
  if (status === "claimed" || status === "running") return "printing";
  if (status === "completed") return "done";
  return "failed";
}

export interface LabelPrintQueueItem {
  id: string;
  type: "label_print" | "printer_discover";
  status: LabelPrintQueueStatus;
  title: string;
  printerId?: string;
  printerName?: string;
  format?: LabelPrintFormat;
  worldId?: string | null;
  printListId?: string | null;
  failedReason?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
  connectorId?: string | null;
  connectorName?: string | null;
}

export interface EnqueuePrintListInput {
  worldSlug: string;
  printListId: string;
  printerId: string;
  printerName?: string;
  format?: LabelPrintFormat;
  includeDmOnly?: boolean;
  targetConnectorId?: string | null;
  createdByUserId?: string | null;
}

export interface LabelPrintDocument {
  body: Buffer | string;
  contentType: string;
  filename: string;
}

export type LabelPrintDocumentAccessCode = "not_found" | "forbidden";

export class LabelPrintDocumentAccessError extends Error {
  readonly code: LabelPrintDocumentAccessCode;

  constructor(code: LabelPrintDocumentAccessCode) {
    super(code === "not_found" ? "Druckjob nicht gefunden." : "Kein Zugriff auf diesen Druckjob.");
    this.code = code;
  }
}

function toQueueItem(job: ConnectorJob, connectorName?: string | null): LabelPrintQueueItem {
  const payload = parseLabelPrintJobPayload(job.payload);
  const type = job.type === "printer_discover" ? "printer_discover" : "label_print";
  return {
    id: job.id,
    type,
    status: job.status as LabelPrintQueueStatus,
    title: type === "printer_discover" ? "Drucker suchen" : (payload?.title ?? "Label-Druck"),
    printerId: payload?.printerId,
    printerName: payload?.printerName,
    format: payload?.format,
    worldId: job.worldId,
    printListId: payload?.printListId ?? null,
    failedReason: job.failedReason,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    connectorId: job.claimedByConnectorId,
    connectorName: connectorName ?? null,
  };
}

export class LabelPrintQueueService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly connectors: ConnectorService = createConnectorService(db),
  ) {}

  async enqueuePrintList(input: EnqueuePrintListInput): Promise<LabelPrintQueueItem> {
    const printListService = new PrintListService(this.db);
    const list = await printListService.getById(input.printListId);
    if (!list) throw new Error("Druckliste nicht gefunden.");

    const world = await this.db.world.findUnique({ where: { slug: input.worldSlug } });
    if (!world || list.worldId !== world.id) throw new Error("Druckliste gehört nicht zu dieser Welt.");

    const format = input.format ?? "pdf";
    const job = await this.connectors.enqueueJob({
      type: "label_print",
      worldId: world.id,
      targetConnectorId: input.targetConnectorId ?? null,
      createdByUserId: input.createdByUserId ?? null,
      payload: {
        printerId: input.printerId,
        printerName: input.printerName,
        format,
        title: list.name,
        worldSlug: input.worldSlug,
        printListId: input.printListId,
        includeDmOnly: input.includeDmOnly === true,
      },
    });

    const payload = {
      printerId: input.printerId,
      printerName: input.printerName,
      format,
      title: list.name,
      worldSlug: input.worldSlug,
      printListId: input.printListId,
      includeDmOnly: input.includeDmOnly === true,
      documentPath: labelPrintDocumentPath(job.id),
    };

    const updated = await this.db.connectorJob.update({
      where: { id: job.id },
      data: { payload: toPrismaJsonValue(payload) },
    });

    return toQueueItem(updated);
  }

  async enqueuePrinterDiscover(options: {
    targetConnectorId?: string | null;
    createdByUserId?: string | null;
  } = {}): Promise<LabelPrintQueueItem> {
    const job = await this.connectors.enqueueJob({
      type: "printer_discover",
      targetConnectorId: options.targetConnectorId ?? null,
      createdByUserId: options.createdByUserId ?? null,
      payload: { reason: "studio_refresh" },
    });
    return toQueueItem(job);
  }

  async listRecent(options: { worldId?: string; limit?: number } = {}): Promise<LabelPrintQueueItem[]> {
    const jobs = await this.db.connectorJob.findMany({
      where: {
        type: { in: ["label_print", "printer_discover"] },
        ...(options.worldId ? { worldId: options.worldId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 50,
      include: { claimedBy: { select: { id: true, name: true } } },
    });
    return jobs.map((job) => toQueueItem(job, job.claimedBy?.name));
  }

  /** Recent label_print jobs for one print list (batch progress on detail page). */
  async listByPrintList(
    printListId: string,
    options: { worldId?: string; limit?: number } = {},
  ): Promise<LabelPrintQueueItem[]> {
    const limit = options.limit ?? 20;
    const jobs = await this.db.connectorJob.findMany({
      where: {
        type: "label_print",
        ...(options.worldId ? { worldId: options.worldId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.max(limit * 5, 50),
      include: { claimedBy: { select: { id: true, name: true } } },
    });

    return jobs
      .filter((job) => parseLabelPrintJobPayload(job.payload)?.printListId === printListId)
      .slice(0, limit)
      .map((job) => toQueueItem(job, job.claimedBy?.name));
  }

  async getJob(jobId: string): Promise<LabelPrintQueueItem | null> {
    const job = await this.db.connectorJob.findUnique({
      where: { id: jobId },
      include: { claimedBy: { select: { id: true, name: true } } },
    });
    if (!job || (job.type !== "label_print" && job.type !== "printer_discover")) return null;
    return toQueueItem(job, job.claimedBy?.name);
  }

  /** Ensures only the connector that claimed the job can fetch its document. */
  async assertConnectorPrintDocumentAccess(jobId: string, connectorId: string): Promise<void> {
    const job = await this.db.connectorJob.findUnique({
      where: { id: jobId },
      select: { type: true, claimedByConnectorId: true, status: true },
    });
    if (!job || job.type !== "label_print") {
      throw new LabelPrintDocumentAccessError("not_found");
    }
    if (job.claimedByConnectorId !== connectorId) {
      throw new LabelPrintDocumentAccessError("forbidden");
    }
    if (job.status !== "claimed" && job.status !== "running") {
      throw new LabelPrintDocumentAccessError("forbidden");
    }
  }

  async listPrinters(): Promise<
    Array<{ connectorId: string; connectorName: string; printers: LocalPrinterInfo[] }>
  > {
    const connectors = await this.db.connector.findMany({ where: { disabled: false }, orderBy: { name: "asc" } });
    return connectors.map((c) => ({
      connectorId: c.id,
      connectorName: c.name,
      printers: normalizeLocalPrinters(c.printers),
    }));
  }

  async renderDocument(jobId: string, assetBaseUrl: string): Promise<LabelPrintDocument> {
    const job = await this.db.connectorJob.findUnique({ where: { id: jobId } });
    if (!job || job.type !== "label_print") throw new Error("Druckjob nicht gefunden.");

    const payload = parseLabelPrintJobPayload(job.payload);
    if (!payload?.worldSlug || !payload.printListId) throw new Error("Druckjob-Payload unvollständig.");

    const printListService = new PrintListService(this.db);
    const list = await printListService.getById(payload.printListId);
    if (!list) throw new Error("Druckliste nicht gefunden.");

    const exportOptions = [];
    for (const label of printListService.expandItemsForExport(list)) {
      const parsed = normalizeLabel(label);
      const content = payload.includeDmOnly ? parsed.content : stripDmOnlyForPlayer(parsed.content);
      if (!payload.includeDmOnly) {
        const safety = assertPlayerSafeExport(content, false);
        if (!safety.allowed) throw new Error(`Label „${label.title}" enthält DM-only Inhalte.`);
      }
      const imageUrls: Record<string, string> = {};
      if (content.imageAssetId) {
        imageUrls[content.imageAssetId] = new URL(`/api/assets/${content.imageAssetId}/file`, assetBaseUrl).toString();
      }
      for (const el of content.elements ?? []) {
        if (el.imageAssetId) {
          imageUrls[el.imageAssetId] = new URL(`/api/assets/${el.imageAssetId}/file`, assetBaseUrl).toString();
        }
      }
      exportOptions.push({
        content,
        layoutSettings: parsed.layoutSettings,
        title: label.title,
        imageUrl: content.imageAssetId ? imageUrls[content.imageAssetId] : null,
        imageUrls,
        worldName: list.campaign?.name ?? undefined,
        includeDmOnly: payload.includeDmOnly,
      });
    }

    const safeTitle = payload.title.replace(/[^\w\-]+/g, "_").slice(0, 60) || "labels";
    if (payload.format === "html") {
      return { body: renderMultiLabelHtml(exportOptions, true), contentType: "text/html; charset=utf-8", filename: `${safeTitle}.html` };
    }
    try {
      const pdf = await renderMultiLabelPdfAsync(exportOptions);
      return { body: pdf, contentType: "application/pdf", filename: `${safeTitle}.pdf` };
    } catch {
      return { body: renderMultiLabelHtml(exportOptions, true), contentType: "text/html; charset=utf-8", filename: `${safeTitle}.print.html` };
    }
  }
}

export function createLabelPrintQueueService(databaseUrl?: string): LabelPrintQueueService {
  if (databaseUrl) {
    const db = createPrismaClient(databaseUrl);
    return new LabelPrintQueueService(db, createConnectorService(db));
  }
  return new LabelPrintQueueService();
}
