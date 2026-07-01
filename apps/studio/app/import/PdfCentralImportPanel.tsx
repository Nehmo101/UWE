"use client";

import { useCallback, useMemo, useState } from "react";
import type { ImportTargetType, MarkdownImportPreviewResult } from "@uwe/database/server";
import {
  executeImportCentralPdfJobAction,
  previewImportCentralPdfJobAction,
} from "../import-central-actions";

interface Props {
  jobId: string;
  targetType: ImportTargetType;
  onComplete?: () => void;
}

export function PdfCentralImportPanel({ jobId, targetType, onComplete }: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [contentBase64, setContentBase64] = useState<string | null>(null);
  const [preview, setPreview] = useState<MarkdownImportPreviewResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resultSummary, setResultSummary] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const singleTarget = targetType === "dnd_page";
  const selectedCount = selectedIds.size;

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setResultSummary(null);
    setPreview(null);
    setSelectedIds(new Set());

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    setContentBase64(btoa(binary));
    setFileName(file.name);
  }, []);

  const handlePreview = useCallback(async () => {
    if (!contentBase64) {
      setError("Bitte zuerst eine PDF-Datei auswählen.");
      return;
    }

    setLoading(true);
    setError(null);
    setResultSummary(null);

    try {
      const { preview: nextPreview } = await previewImportCentralPdfJobAction(jobId, contentBase64);
      setPreview(nextPreview);
      setSelectedIds(new Set(nextPreview.items.map((item) => item.itemId)));
    } catch (previewError) {
      setPreview(null);
      setSelectedIds(new Set());
      setError(previewError instanceof Error ? previewError.message : "Vorschau fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [contentBase64, jobId]);

  const handleExecute = useCallback(async () => {
    if (!preview || !contentBase64) {
      setError("Bitte zuerst eine Vorschau erstellen.");
      return;
    }

    if (!singleTarget && selectedCount === 0) {
      setError("Keine Einträge zum Import ausgewählt.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { resultSummary: summary } = await executeImportCentralPdfJobAction(
        jobId,
        contentBase64,
        singleTarget ? undefined : [...selectedIds],
      );
      setResultSummary(summary);
      onComplete?.();
    } catch (executeError) {
      setError(executeError instanceof Error ? executeError.message : "Import fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [contentBase64, jobId, onComplete, preview, selectedCount, selectedIds, singleTarget]);

  const toggleItem = useCallback((itemId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (!preview) return;
    const allSelected = preview.items.every((item) => selectedIds.has(item.itemId));
    setSelectedIds(allSelected ? new Set() : new Set(preview.items.map((item) => item.itemId)));
  }, [preview, selectedIds]);

  const resultLabel = useMemo(() => {
    if (!resultSummary) return null;
    const created = resultSummary.created;
    const failed = resultSummary.failed;
    return `${created ?? 0} erstellt, ${failed ?? 0} fehlgeschlagen`;
  }, [resultSummary]);

  return (
    <div className="uwe-import-workspace">
      <section className="uwe-panel">
        <h3>PDF-Import</h3>
        <p className="uwe-panel-intro">
          Text wird aus der PDF extrahiert und wie Markdown importiert. Gescannte PDFs ohne Textlayer
          benötigen OCR vorab.
        </p>

        <label>
          PDF-Datei
          <input type="file" accept=".pdf,application/pdf" onChange={handleFileChange} />
        </label>

        {fileName ? <p className="uwe-table-sub">Ausgewählt: {fileName}</p> : null}

        <div className="uwe-form-actions">
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-primary"
            onClick={handlePreview}
            disabled={loading || !contentBase64}
          >
            {loading && !resultSummary ? "Lädt…" : "Vorschau anzeigen"}
          </button>
        </div>
      </section>

      {error ? <p className="uwe-flash uwe-flash-error">{error}</p> : null}
      {resultLabel ? <p className="uwe-flash uwe-flash-success">{resultLabel}</p> : null}

      {preview ? (
        <section className="uwe-panel">
          <h3>Vorschau</h3>
          <p className="uwe-panel-intro">
            {preview.totalDocuments} Abschnitt{preview.totalDocuments === 1 ? "" : "e"} erkannt.
          </p>

          <table className="uwe-page-table">
            <thead>
              <tr>
                {!singleTarget ? (
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Alle auswählen"
                      onChange={toggleAll}
                      checked={
                        preview.items.length > 0 &&
                        preview.items.every((item) => selectedIds.has(item.itemId))
                      }
                    />
                  </th>
                ) : null}
                <th>Titel</th>
                <th>Auszug</th>
              </tr>
            </thead>
            <tbody>
              {preview.items.map((item) => (
                <tr key={item.itemId}>
                  {!singleTarget ? (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.itemId)}
                        onChange={() => toggleItem(item.itemId)}
                      />
                    </td>
                  ) : null}
                  <td>{item.title}</td>
                  <td>{item.excerpt}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="uwe-form-actions">
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-primary"
              onClick={handleExecute}
              disabled={loading || (!singleTarget && selectedCount === 0)}
            >
              Import ausführen
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
