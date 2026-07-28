import type { ImportJob, ImportJobStatus } from "@uwe/database/server";
import {
  buildCampaignPreview,
  parseCampaignEntities,
  sanitizeFitChatTranscript,
  toCampaignPreviewSummary,
  type CampaignFitChatMessage,
  type CampaignImportPreview,
  type CampaignImportPreviewSummary,
  type ExtractedCampaignEntity,
} from "@uwe/pdf-campaign-import";

/**
 * Gemeinsame Reader/Builder für die Payloads des PDF-zu-Kampagne-Imports.
 * Werden von den Server Actions (Vorschau/Ausführen/Status/Fit-Chat) geteilt —
 * "use server"-Dateien dürfen nur async-Funktionen exportieren, daher hier.
 */
export const CAMPAIGN_PREVIEW_KIND = "campaign_entities";
export const CAMPAIGN_PROGRESS_KIND = "campaign_analysis_progress";

export interface CampaignAnalysisProgress {
  phase: "extracting" | "analyzing";
  processedChunks: number;
  totalChunks: number | null;
  startedAt: string;
}

export interface CampaignPdfJobStatus {
  status: ImportJobStatus;
  errorMessage: string | null;
  pdfFileName: string | null;
  hasPdf: boolean;
  progress: CampaignAnalysisProgress | null;
  preview: CampaignImportPreviewSummary | null;
  fitChat: CampaignFitChatMessage[];
}

export function recordFrom(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readCampaignMetadata(
  metadata: unknown,
  targetWorldId: string | null,
): { worldId: string; worldSlug: string; campaignId: string; campaignSlug: string } {
  const record = recordFrom(metadata);
  const worldSlug = record ? readString(record, "worldSlug") : null;
  const campaignId = record ? readString(record, "campaignId") : null;
  const campaignSlug = record ? readString(record, "campaignSlug") : null;
  if (!targetWorldId || !worldSlug || !campaignId || !campaignSlug) {
    throw new Error("Kampagnen-Kontext fehlt im Import-Job.");
  }
  return { worldId: targetWorldId, worldSlug, campaignId, campaignSlug };
}

export function readPdfFileName(metadata: unknown): string | null {
  const record = recordFrom(metadata);
  return record ? readString(record, "pdfFileName") : null;
}

export function readFitChatTranscript(metadata: unknown): CampaignFitChatMessage[] {
  const record = recordFrom(metadata);
  return sanitizeFitChatTranscript(record?.fitChat);
}

export function readPreviewEntities(previewPayload: unknown): ExtractedCampaignEntity[] | null {
  const record = recordFrom(previewPayload);
  if (record?.kind !== CAMPAIGN_PREVIEW_KIND || !Array.isArray(record.entities)) {
    return null;
  }
  return parseCampaignEntities(JSON.stringify(record.entities));
}

export function readStoredPreview(previewPayload: unknown): CampaignImportPreview | null {
  const record = recordFrom(previewPayload);
  const entities = readPreviewEntities(previewPayload);
  if (!record || !entities) {
    return null;
  }
  const preview = buildCampaignPreview(entities);
  const errors = Array.isArray(record.errors)
    ? record.errors.filter((error): error is string => typeof error === "string")
    : [];
  return {
    ...preview,
    errors,
    canExecute: preview.canExecute && record.canExecute !== false,
  };
}

/** Vom Nutzer bei der Analyse angegebener Kampagnen-Kontext (aus extractionMeta). */
export function readStoredCampaignContext(previewPayload: unknown): string | null {
  const record = recordFrom(previewPayload);
  const meta = record ? recordFrom(record.extractionMeta) : null;
  return meta ? readString(meta, "campaignContext") : null;
}

export function readAnalysisProgress(previewPayload: unknown): CampaignAnalysisProgress | null {
  const record = recordFrom(previewPayload);
  if (record?.kind !== CAMPAIGN_PROGRESS_KIND) {
    return null;
  }
  const phase = record.phase === "extracting" || record.phase === "analyzing" ? record.phase : null;
  if (!phase) {
    return null;
  }
  return {
    phase,
    processedChunks: typeof record.processedChunks === "number" ? record.processedChunks : 0,
    totalChunks: typeof record.totalChunks === "number" ? record.totalChunks : null,
    startedAt: typeof record.startedAt === "string" ? record.startedAt : "",
  };
}

export function buildProgressPayload(progress: CampaignAnalysisProgress): Record<string, unknown> {
  return { kind: CAMPAIGN_PROGRESS_KIND, ...progress };
}

export function buildPreviewPayload(
  preview: CampaignImportPreview,
  extractionMeta: Record<string, unknown>,
): Record<string, unknown> {
  return {
    kind: CAMPAIGN_PREVIEW_KIND,
    ...preview,
    extractionMeta,
  };
}

export function jobToCampaignStatus(job: ImportJob, hasPdf: boolean): CampaignPdfJobStatus {
  const storedPreview = readStoredPreview(job.previewPayload);
  return {
    status: job.status,
    errorMessage: job.errorMessage ?? null,
    pdfFileName: readPdfFileName(job.metadata),
    hasPdf,
    progress: readAnalysisProgress(job.previewPayload),
    preview: storedPreview ? toCampaignPreviewSummary(storedPreview) : null,
    fitChat: readFitChatTranscript(job.metadata),
  };
}
