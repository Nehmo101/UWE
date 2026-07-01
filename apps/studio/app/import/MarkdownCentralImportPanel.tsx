"use client";

import { useCallback, useMemo, useState } from "react";
import type { ImportPreviewResult } from "@uwe/knoteforge-import";
import type { ImportTargetType, MarkdownImportPreviewResult } from "@uwe/database/import-constants";
import {
  executeImportCentralJobAction,
  previewImportCentralJobAction,
} from "../import-central-actions";

interface Props {
  jobId: string;
  targetType: ImportTargetType;
  fileAccept: string;
  onComplete?: () => void;
}

function buildMarkdownDocumentFromFile(fileName: string, text: string): string {
  const title = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  const trimmed = text.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("---")) {
    return trimmed;
  }

  return `---
title: ${title}
source: ${fileName}
---

${trimmed}`;
}

function combineImportFiles(files: Array<{ name: string; text: string }>): string {
  return files
    .map((file) => buildMarkdownDocumentFromFile(file.name, file.text))
    .filter(Boolean)
    .join("\n\n---\n\n");
}

function isMarkdownPreview(
  preview: ImportPreviewResult | MarkdownImportPreviewResult,
): preview is MarkdownImportPreviewResult {
  return "totalDocuments" in preview;
}

export function MarkdownCentralImportPanel({ jobId, targetType, fileAccept, onComplete }: Props) {
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [preview, setPreview] = useState<MarkdownImportPreviewResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resultSummary, setResultSummary] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = selectedIds.size;
  const singleTarget = targetType === "dnd_page";

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    if (files.length === 0) return;

    setError(null);
    setResultSummary(null);
    setPreview(null);
    setSelectedIds(new Set());

    const loaded = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        text: await file.text(),
      })),
    );

    const combined = combineImportFiles(loaded);
    setFileName(files.length === 1 ? files[0]!.name : `${files.length} Dateien`);
    setFileCount(files.length);
    setContent(combined);
  }, []);

  const handleContentChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(event.target.value);
    setFileName(null);
    setFileCount(0);
    setError(null);
    setResultSummary(null);
    setPreview(null);
    setSelectedIds(new Set());
  }, []);

  const handlePreview = useCallback(async () => {
    if (!content.trim()) {
      setError("Bitte zuerst Text einfügen oder Dateien auswählen.");
      return;
    }

    setLoading(true);
    setError(null);
    setResultSummary(null);

    try {
      const { preview: nextPreview } = await previewImportCentralJobAction(jobId, content);
      if (!isMarkdownPreview(nextPreview)) {
        throw new Error("Ungültige Vorschau.");
      }

      setPreview(nextPreview);
      setSelectedIds(new Set(nextPreview.items.map((item) => item.itemId)));
    } catch (previewError) {
      setPreview(null);
      setSelectedIds(new Set());
      setError(previewError instanceof Error ? previewError.message : "Vorschau fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [content, jobId]);

  const handleExecute = useCallback(async () => {
    if (!preview || !content.trim()) {
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
      const { resultSummary: summary } = await executeImportCentralJobAction(
        jobId,
        content,
        singleTarget ? undefined : [...selectedIds],
      );
      setResultSummary(summary);
      onComplete?.();
    } catch (executeError) {
      setError(executeError instanceof Error ? executeError.message : "Import fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [content, jobId, onComplete, preview, selectedCount, selectedIds, singleTarget]);

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
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(preview.items.map((item) => item.itemId)));
    }
  }, [preview, selectedIds]);

  const resultLabel = useMemo(() => {
    if (!resultSummary) return null;
    const created = typeof resultSummary.created === "number" ? resultSummary.created : 0;
    const failed = typeof resultSummary.failed === "number" ? resultSummary.failed : 0;
    const skipped = typeof resultSummary.skipped === "number" ? resultSummary.skipped : 0;
    return `${created} erstellt, ${skipped} übersprungen, ${failed} fehlgeschlagen`;
  }, [resultSummary]);

  return (
    <div className="uwe-import-workspace">
      <section className="uwe-panel">
        <h3>Markdown-Import</h3>
        <p className="uwe-panel-intro">
          Mehrere Texte getrennt durch <code>---</code> oder als Mehrfachauswahl. Obsidian-Exporte
          werden wie Markdown behandelt.
        </p>

        <label>
          Datei(en)
          <input type="file" accept={fileAccept} multiple onChange={handleFileChange} />
        </label>

        <label>
          Text einfügen (optional)
          <textarea
            rows={8}
            value={content}
            onChange={handleContentChange}
            placeholder={`# Erstes Fragment\n\nInhalt …\n\n---\n\n# Zweites Fragment\n\nWeiterer Text …`}
          />
        </label>

        {fileName ? (
          <p className="uwe-table-sub">
            Ausgewählt: {fileName}
            {fileCount > 1 ? ` (${fileCount} Dateien)` : ""} ({Math.round(content.length / 1024)} KB)
          </p>
        ) : null}

        <div className="uwe-form-actions">
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-primary"
            onClick={handlePreview}
            disabled={loading || !content.trim()}
          >
            {loading && !resultSummary ? "Lädt…" : "Vorschau anzeigen"}
          </button>
        </div>
      </section>

      {error ? <p className="uwe-flash uwe-flash-error">{error}</p> : null}

      {preview ? (
        <section className="uwe-panel">
          <h3>Vorschau</h3>
          <p className="uwe-panel-intro">
            {preview.totalDocuments} Dokument{preview.totalDocuments === 1 ? "" : "e"} erkannt.
          </p>

          {preview.errors.length > 0 ? (
            <ul className="uwe-import-alerts">
              {preview.errors.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          ) : null}

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
                {targetType === "dnd_page" ? <th>Seitentyp</th> : null}
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
                        aria-label={`${item.title} importieren`}
                      />
                    </td>
                  ) : null}
                  <td>
                    <strong>{item.title}</strong>
                  </td>
                  <td>{item.excerpt}</td>
                  {targetType === "dnd_page" ? <td>{item.pageType ?? "lore"}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="uwe-form-actions">
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-primary"
              onClick={handleExecute}
              disabled={loading || !preview.canExecute || (!singleTarget && selectedCount === 0)}
            >
              {loading ? "Importiert…" : singleTarget ? "Import bestätigen" : `Import bestätigen (${selectedCount})`}
            </button>
          </div>
        </section>
      ) : null}

      {resultLabel ? (
        <section className="uwe-panel">
          <h3>Import-Protokoll</h3>
          <p className="uwe-panel-intro">{resultLabel}</p>
        </section>
      ) : null}
    </div>
  );
}
