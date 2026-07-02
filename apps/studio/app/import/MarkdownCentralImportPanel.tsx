"use client";

import { useCallback, useMemo, useState } from "react";
import type { ImportPreviewResult } from "@uwe/knoteforge-import";
import type {
  ImportSourceType,
  ImportTargetType,
  MarkdownImportPreviewResult,
} from "@uwe/database/import-constants";
import { arrayBufferToBase64 } from "@/src/lib/file-base64";
import {
  executeImportCentralJobAction,
  executeImportCentralObsidianVaultAction,
  previewImportCentralJobAction,
  previewImportCentralObsidianVaultAction,
} from "../import-central-actions";

interface Props {
  jobId: string;
  sourceType: ImportSourceType;
  targetType: ImportTargetType;
  fileAccept: string;
  onComplete?: () => void;
}

const DIRECTORY_INPUT_PROPS = {
  webkitdirectory: "",
} as unknown as React.InputHTMLAttributes<HTMLInputElement>;

function relativeFileName(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return relative?.trim() ? relative : file.name;
}

function isMarkdownLikeFile(file: File): boolean {
  const name = relativeFileName(file).replace(/\\/g, "/");
  if (name.split("/").some((segment) => segment.startsWith("."))) return false;
  const lower = name.toLocaleLowerCase("de");
  return lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt");
}

function buildMarkdownDocumentFromFile(fileName: string, text: string): string {
  const baseName = fileName.replace(/\\/g, "/").split("/").pop() ?? fileName;
  const title = baseName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
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

export function MarkdownCentralImportPanel({
  jobId,
  sourceType,
  targetType,
  fileAccept,
  onComplete,
}: Props) {
  const [content, setContent] = useState("");
  const [zipBase64, setZipBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [vaultFileCount, setVaultFileCount] = useState<number | null>(null);
  const [preview, setPreview] = useState<MarkdownImportPreviewResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resultSummary, setResultSummary] = useState<Record<string, unknown> | null>(null);
  const [undoToken, setUndoToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = selectedIds.size;
  const singleTarget = targetType === "dnd_page";
  const isObsidian = sourceType === "obsidian";
  const zipMode = zipBase64 !== null;

  const resetSelection = useCallback(() => {
    setError(null);
    setResultSummary(null);
    setUndoToken(null);
    setPreview(null);
    setSelectedIds(new Set());
    setVaultFileCount(null);
  }, []);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      resetSelection();

      const zipFile =
        files.length === 1 && files[0]!.name.toLocaleLowerCase("de").endsWith(".zip")
          ? files[0]!
          : null;

      if (zipFile) {
        if (!isObsidian) {
          setError("ZIP-Dateien werden nur für die Obsidian-Quelle unterstützt.");
          return;
        }
        const buffer = await zipFile.arrayBuffer();
        setZipBase64(arrayBufferToBase64(buffer));
        setContent("");
        setFileName(zipFile.name);
        setFileCount(1);
        return;
      }

      const textFiles = files.filter(isMarkdownLikeFile);
      if (textFiles.length === 0) {
        setError("Keine Markdown-Dateien in der Auswahl gefunden (.md, .markdown, .txt).");
        return;
      }

      const loaded = await Promise.all(
        textFiles.map(async (file) => ({
          name: relativeFileName(file),
          text: await file.text(),
        })),
      );

      setZipBase64(null);
      setFileName(
        textFiles.length === 1 ? relativeFileName(textFiles[0]!) : `${textFiles.length} Dateien`,
      );
      setFileCount(textFiles.length);
      setContent(combineImportFiles(loaded));
    },
    [isObsidian, resetSelection],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      void handleFiles([...(event.target.files ?? [])]);
    },
    [handleFiles],
  );

  const handleContentChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(event.target.value);
      setZipBase64(null);
      setFileName(null);
      setFileCount(0);
      resetSelection();
    },
    [resetSelection],
  );

  const handlePreview = useCallback(async () => {
    if (!zipMode && !content.trim()) {
      setError("Bitte zuerst Text einfügen oder Dateien auswählen.");
      return;
    }

    setLoading(true);
    setError(null);
    setResultSummary(null);
    setUndoToken(null);

    try {
      let nextPreview: MarkdownImportPreviewResult;

      if (zipMode && zipBase64) {
        const response = await previewImportCentralObsidianVaultAction(jobId, zipBase64);
        nextPreview = response.preview;
        setVaultFileCount(response.vaultFileCount);
      } else {
        const response = await previewImportCentralJobAction(jobId, content);
        if (!isMarkdownPreview(response.preview)) {
          throw new Error("Ungültige Vorschau.");
        }
        nextPreview = response.preview;
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
  }, [content, jobId, zipBase64, zipMode]);

  const handleExecute = useCallback(async () => {
    if (!preview || (!zipMode && !content.trim())) {
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
      const itemIds = singleTarget ? undefined : [...selectedIds];
      const response =
        zipMode && zipBase64
          ? await executeImportCentralObsidianVaultAction(jobId, zipBase64, itemIds)
          : await executeImportCentralJobAction(jobId, content, itemIds);

      setResultSummary(response.resultSummary);
      setUndoToken(response.undoToken);
      onComplete?.();
    } catch (executeError) {
      setError(executeError instanceof Error ? executeError.message : "Import fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [content, jobId, onComplete, preview, selectedCount, selectedIds, singleTarget, zipBase64, zipMode]);

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
        <h3>{isObsidian ? "Obsidian-Import" : "Markdown-Import"}</h3>
        <p className="uwe-panel-intro">
          {isObsidian ? (
            <>
              Vault-Export als ZIP, kompletter Vault-Ordner oder einzelne Markdown-Dateien.
              Wikilinks <code>[[…]]</code> bleiben unverändert als Text erhalten;{" "}
              <code>.obsidian/</code> und Anhänge werden übersprungen.
            </>
          ) : (
            <>
              Mehrere Texte getrennt durch <code>---</code> oder als Mehrfachauswahl.
            </>
          )}
        </p>

        <label>
          {isObsidian ? "Vault-ZIP oder Markdown-Datei(en)" : "Datei(en)"}
          <input type="file" accept={fileAccept} multiple onChange={handleFileChange} />
        </label>

        {isObsidian ? (
          <label>
            Vault-Ordner auswählen (alternativ)
            <input type="file" multiple onChange={handleFileChange} {...DIRECTORY_INPUT_PROPS} />
          </label>
        ) : null}

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
            {fileCount > 1 ? ` (${fileCount} Dateien)` : ""}
            {zipMode ? " — Vault-ZIP wird serverseitig entpackt" : ` (${Math.round(content.length / 1024)} KB)`}
          </p>
        ) : null}

        <div className="uwe-form-actions">
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-primary"
            onClick={handlePreview}
            disabled={loading || (!zipMode && !content.trim())}
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
            {vaultFileCount !== null
              ? ` ${vaultFileCount} Markdown-Datei${vaultFileCount === 1 ? "" : "en"} im Vault gefunden.`
              : ""}
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

          <p className="uwe-table-sub">
            Die Vorschau ändert keine Daten. Nach dem Import kannst du den Job im Import-Verlauf
            über „Zurückrollen“ rückgängig machen.
          </p>

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
          {undoToken ? (
            <p className="uwe-table-sub">
              Dieser Import kann im Import-Verlauf über „Zurückrollen“ rückgängig gemacht werden.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
