/**
 * Pure helpers that reduce an import job's stored preview/result payloads to a
 * short human label. These run on the server (in the Import-Zentrale page) so the
 * full payloads — which for campaign-PDF jobs contain every AI-extracted entity
 * body — are never serialized into the client RSC payload; only the summary
 * strings cross the boundary.
 */

export function readPreviewSummary(previewPayload: unknown): string | null {
  if (!previewPayload || typeof previewPayload !== "object" || Array.isArray(previewPayload)) {
    return null;
  }

  const markdownPreview = previewPayload as { totalDocuments?: unknown };
  if (typeof markdownPreview.totalDocuments === "number") {
    return `${markdownPreview.totalDocuments} Dokument(e) in Vorschau`;
  }

  const total = (previewPayload as { totalEntities?: unknown }).totalEntities;
  return typeof total === "number" ? `${total} Einträge in Vorschau` : null;
}

export function readResultSummary(resultSummary: unknown): string | null {
  if (!resultSummary || typeof resultSummary !== "object" || Array.isArray(resultSummary)) {
    return null;
  }
  const summary = resultSummary as { created?: number; updated?: number; failed?: number };
  if (
    typeof summary.created !== "number" &&
    typeof summary.updated !== "number" &&
    typeof summary.failed !== "number"
  ) {
    return null;
  }
  return `${summary.created ?? 0} erstellt, ${summary.updated ?? 0} aktualisiert, ${summary.failed ?? 0} fehlgeschlagen`;
}
