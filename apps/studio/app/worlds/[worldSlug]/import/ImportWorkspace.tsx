"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useMemo, useState } from "react";
import type {
  ImportExecuteResult,
  ImportFormat,
  ImportItemPreview,
  ImportPreviewResult,
  ImportStatus,
} from "@uwe/knoteforge-import";
import { waitForJob } from "@/src/lib/poll-job";
import { JobProgressBar } from "@/components/JobProgressBar";
import {
  completeImportCentralJobAction,
  failImportCentralJobAction,
  markImportCentralExecutingAction,
  previewImportCentralJobAction,
} from "@/app/import-central-actions";

const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  new: "Neu",
  update: "Update",
  duplicate: "Duplikat",
  conflict: "Konflikt",
  skipped: "Übersprungen",
  error: "Fehler",
};

const IMPORT_STATUS_CLASS: Record<ImportStatus, string> = {
  new: "uwe-badge uwe-badge-published",
  update: "uwe-badge uwe-badge-player",
  duplicate: "uwe-badge uwe-badge-draft",
  conflict: "uwe-badge",
  skipped: "uwe-badge uwe-badge-draft",
  error: "uwe-badge uwe-badge-secret",
};

interface Props {
  worldSlug: string;
  supportedFormats: ImportFormat[];
  plannedFormats: ImportFormat[];
  jobId?: string;
  onJobPreview?: (content: string) => Promise<void>;
  onJobExecuting?: () => Promise<void>;
  onJobComplete?: (resultSummary: Record<string, unknown>, undoToken?: string | null) => Promise<void>;
  onJobFail?: (errorMessage: string) => Promise<void>;
}

function isSelectable(status: ImportStatus): boolean {
  return status === "new" || status === "update" || status === "conflict";
}

function defaultSelectedIds(items: ImportItemPreview[]): Set<string> {
  return new Set(items.filter((item) => isSelectable(item.status)).map((item) => item.itemId));
}

function formatFromFileName(fileName: string): ImportFormat | null {
  const lower = fileName.toLocaleLowerCase("de");
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt")) {
    return "markdown";
  }
  return null;
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

function extractImportUndoToken(
  payload: unknown,
  responseUndoEntryId?: string | null,
): string | null {
  if (typeof responseUndoEntryId === "string" && responseUndoEntryId) {
    return responseUndoEntryId;
  }
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as { undoEntryId?: string | null };
  return typeof record.undoEntryId === "string" && record.undoEntryId ? record.undoEntryId : null;
}

export function ImportWorkspace({
  worldSlug,
  supportedFormats,
  plannedFormats,
  jobId,
  onJobPreview: _onJobPreview,
  onJobExecuting,
  onJobComplete,
  onJobFail,
}: Props) {
  const [format, setFormat] = useState<ImportFormat>(supportedFormats[0] ?? "json");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ImportExecuteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{
    progress: number | null;
    label: string | null;
  } | null>(null);
  const [autoResolveSlugConflicts, setAutoResolveSlugConflicts] = useState(true);
  const [allowUpdates, setAllowUpdates] = useState(true);

  const selectedCount = selectedIds.size;

  const summaryEntries = useMemo(() => {
    if (!preview) return [];
    return Object.entries(preview.summary).filter(([, count]) => count > 0);
  }, [preview]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    if (files.length === 0) return;

    setError(null);
    setResult(null);

    const loaded = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        text: await file.text(),
      })),
    );

    const detectedFormat = formatFromFileName(files[0]!.name);
    if (detectedFormat) {
      setFormat(detectedFormat);
    }

    if (files.length === 1 && detectedFormat === "json") {
      setFileName(files[0]!.name);
      setFileCount(1);
      setContent(loaded[0]!.text);
      return;
    }

    const combined = combineImportFiles(loaded);
    setFormat("markdown");
    setFileName(
      files.length === 1 ? files[0]!.name : `${files.length} Dateien`,
    );
    setFileCount(files.length);
    setContent(combined);
  }, []);

  const handleContentChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(event.target.value);
    setFileName(null);
    setFileCount(0);
    setError(null);
    setResult(null);
  }, []);

  const handlePreview = useCallback(async () => {
    if (!content.trim()) {
      setError("Bitte zuerst Text einfügen oder eine Import-Datei auswählen.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let nextPreview: ImportPreviewResult;

      if (jobId) {
        const response = await previewImportCentralJobAction(jobId, content);
        if (!("items" in response.preview) || !("totalEntities" in response.preview)) {
          throw new Error("Ungültige Vorschau für Welt-Import.");
        }
        nextPreview = response.preview;
      } else {
        const response = await fetch(studioApiUrl("/api/import/preview"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format, content, worldSlug }),
        });

        const data = (await response.json()) as {
          preview?: ImportPreviewResult;
          error?: string;
        };

        if (!response.ok || !data.preview) {
          throw new Error(data.error ?? "Vorschau fehlgeschlagen.");
        }

        nextPreview = data.preview;
      }

      setPreview(nextPreview);
      setSelectedIds(defaultSelectedIds(nextPreview.items));
    } catch (previewError) {
      setPreview(null);
      setSelectedIds(new Set());
      setError(
        previewError instanceof Error ? previewError.message : "Vorschau fehlgeschlagen.",
      );
    } finally {
      setLoading(false);
    }
  }, [content, format, jobId, worldSlug]);

  const handleExecute = useCallback(async () => {
    if (!preview || !content.trim()) {
      setError("Bitte zuerst eine Vorschau erstellen.");
      return;
    }

    if (selectedCount === 0) {
      setError("Keine Einträge zum Import ausgewählt.");
      return;
    }

    setLoading(true);
    setError(null);
    setImportProgress(null);

    try {
      if (jobId) {
        await markImportCentralExecutingAction(jobId);
      } else if (onJobExecuting) {
        await onJobExecuting();
      }

      const response = await fetch(studioApiUrl("/api/import/execute"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          content,
          worldSlug,
          confirmed: true,
          itemIds: [...selectedIds],
          autoResolveSlugConflicts,
          allowUpdates,
        }),
      });

      const data = (await response.json()) as {
        result?: ImportExecuteResult;
        undoEntryId?: string | null;
        job?: { id: string; result?: { result?: ImportExecuteResult; undoEntryId?: string | null } };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Import fehlgeschlagen.");
      }

      if (response.status === 202 && data.job?.id) {
        const job = await waitForJob(data.job.id, {
          onPoll: (snapshot) => {
            setImportProgress({
              progress: snapshot.progress ?? null,
              label: snapshot.progressLabel ?? "Import läuft…",
            });
          },
        });
        const jobPayload = job.result as
          | { result?: ImportExecuteResult; undoEntryId?: string | null }
          | ImportExecuteResult
          | undefined;
        const importResult =
          jobPayload && "result" in jobPayload
            ? jobPayload.result
            : (jobPayload as ImportExecuteResult | undefined);
        if (!importResult) {
          throw new Error("Import ohne Ergebnis abgeschlossen.");
        }
        const undoToken = extractImportUndoToken(jobPayload, data.undoEntryId);
        setResult(importResult);
        if (jobId) {
          await completeImportCentralJobAction(
            jobId,
            {
              created: importResult.created,
              updated: importResult.updated,
              failed: importResult.failed,
              skipped: importResult.skipped,
            },
            undoToken,
          );
        } else if (onJobComplete) {
          await onJobComplete(
            {
              created: importResult.created,
              updated: importResult.updated,
              failed: importResult.failed,
              skipped: importResult.skipped,
            },
            undoToken,
          );
        }
      } else if (data.result) {
        const undoToken = extractImportUndoToken(data.result, data.undoEntryId);
        setResult(data.result);
        if (jobId) {
          await completeImportCentralJobAction(
            jobId,
            {
              created: data.result.created,
              updated: data.result.updated,
              failed: data.result.failed,
              skipped: data.result.skipped,
            },
            undoToken,
          );
        } else if (onJobComplete) {
          await onJobComplete(
            {
              created: data.result.created,
              updated: data.result.updated,
              failed: data.result.failed,
              skipped: data.result.skipped,
            },
            undoToken,
          );
        }
      } else {
        throw new Error("Import fehlgeschlagen.");
      }
    } catch (executeError) {
      const message =
        executeError instanceof Error ? executeError.message : "Import fehlgeschlagen.";
      if (jobId) {
        await failImportCentralJobAction(jobId, message);
      } else if (onJobFail) {
        await onJobFail(message);
      }
      setError(message);
    } finally {
      setLoading(false);
      setImportProgress(null);
    }
  }, [
    allowUpdates,
    autoResolveSlugConflicts,
    content,
    format,
    jobId,
    onJobComplete,
    onJobExecuting,
    onJobFail,
    preview,
    selectedCount,
    selectedIds,
    worldSlug,
  ]);

  const toggleItem = useCallback((itemId: string, status: ImportStatus) => {
    if (!isSelectable(status)) return;

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

    const selectable = preview.items.filter((item) => isSelectable(item.status));
    const allSelected = selectable.every((item) => selectedIds.has(item.itemId));

    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable.map((item) => item.itemId)));
    }
  }, [preview, selectedIds]);

  return (
    <div className="uwe-import-workspace">
      <section className="uwe-panel">
        <h2>Import-Quelle</h2>
        <p className="uwe-panel-intro">
          KnoteForge-Export als JSON — entweder das UWE-Importformat (Objekt mit{" "}
          <code>entities</code>) oder einen Eingang-Export (<code>eingang_export.json</code>).
          Alternativ mehrere unstrukturierte Texte als Markdown/TXT: getrennt durch{" "}
          <code>---</code> in einer Datei oder als Mehrfachauswahl.
        </p>

        <div className="uwe-form-grid">
          <label>
            Format
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as ImportFormat)}
            >
              {supportedFormats.map((entry) => (
                <option key={entry} value={entry}>
                  {entry === "markdown" ? "MARKDOWN / TEXT" : entry.toUpperCase()}
                </option>
              ))}
              {plannedFormats.map((entry) => (
                <option key={entry} value={entry} disabled>
                  {entry.toUpperCase()} (geplant)
                </option>
              ))}
            </select>
          </label>

          <label>
            Datei(en)
            <input
              type="file"
              accept=".json,.md,.markdown,.txt,application/json,text/markdown,text/plain"
              multiple
              onChange={handleFileChange}
            />
          </label>
        </div>

        <label>
          Text einfügen (optional)
          <textarea
            rows={8}
            value={content}
            onChange={handleContentChange}
            placeholder={`# Lore-Fragment\n\nUnstrukturierter Text mit [[Wikilinks]].\n\n---\n\n# Zweites Fragment\n\nWeiterer Text …`}
          />
        </label>

        {fileName && (
          <p className="uwe-table-sub">
            Ausgewählt: {fileName}
            {fileCount > 1 ? ` (${fileCount} Dateien)` : ""} ({Math.round(content.length / 1024)} KB)
          </p>
        )}

        <div className="uwe-form-actions">
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-primary"
            onClick={handlePreview}
            disabled={loading || !content.trim()}
          >
            {loading && !result ? "Lädt…" : "Vorschau anzeigen"}
          </button>
        </div>
      </section>

      {error && <p className="uwe-flash uwe-flash-error">{error}</p>}

      {preview && (
        <>
          <section className="uwe-panel">
            <h2>Vorschau</h2>
            <p className="uwe-panel-intro">
              {preview.totalEntities} Einträge erkannt. Die Vorschau ändert keine Daten in der
              Datenbank.
            </p>

            {preview.errors.length > 0 && (
              <div className="uwe-import-alerts">
                <h3>Hinweise</h3>
                <ul>
                  {preview.errors.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </div>
            )}

            {summaryEntries.length > 0 && (
              <div className="uwe-import-summary">
                {summaryEntries.map(([status, count]) => (
                  <span key={status} className={IMPORT_STATUS_CLASS[status as ImportStatus]}>
                    {IMPORT_STATUS_LABELS[status as ImportStatus]}: {count}
                  </span>
                ))}
              </div>
            )}

            <div className="uwe-form-actions">
              <label className="uwe-checkbox-inline">
                <input
                  type="checkbox"
                  checked={autoResolveSlugConflicts}
                  onChange={(event) => setAutoResolveSlugConflicts(event.target.checked)}
                />
                Slug-Konflikte automatisch auflösen
              </label>
              <label className="uwe-checkbox-inline">
                <input
                  type="checkbox"
                  checked={allowUpdates}
                  onChange={(event) => setAllowUpdates(event.target.checked)}
                />
                Bestehende Einträge aktualisieren (gleiche KnoteForge-ID)
              </label>
            </div>

            <table className="uwe-page-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Alle auswählen"
                      onChange={toggleAll}
                      checked={
                        preview.items.filter((item) => isSelectable(item.status)).length > 0 &&
                        preview.items
                          .filter((item) => isSelectable(item.status))
                          .every((item) => selectedIds.has(item.itemId))
                      }
                    />
                  </th>
                  <th>Titel</th>
                  <th>Typ</th>
                  <th>Status</th>
                  <th>Slug</th>
                  <th>Konflikte</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((item) => (
                  <tr key={item.itemId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.itemId)}
                        disabled={!isSelectable(item.status)}
                        onChange={() => toggleItem(item.itemId, item.status)}
                        aria-label={`${item.title} importieren`}
                      />
                    </td>
                    <td>
                      <strong>{item.title}</strong>
                      {item.warnings.length > 0 && (
                        <ul className="uwe-import-warnings">
                          {item.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td>
                      <code>{item.knoteforgeType}</code>
                      <span className="uwe-table-sub"> → {item.pageType}</span>
                    </td>
                    <td>
                      <span className={IMPORT_STATUS_CLASS[item.status]}>
                        {IMPORT_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td>
                      {item.resolvedSlug !== item.slug ? (
                        <>
                          <span className="uwe-table-sub">{item.slug}</span>
                          <br />
                          → {item.resolvedSlug}
                        </>
                      ) : (
                        item.slug
                      )}
                    </td>
                    <td>
                      {item.conflicts.length > 0 ? (
                        <ul className="uwe-import-conflicts">
                          {item.conflicts.map((conflict, index) => (
                            <li key={`${conflict.kind}-${index}`}>{conflict.message}</li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {preview.items.length === 0 && (
              <p className="uwe-v2-empty">Keine importierbaren Einträge gefunden.</p>
            )}

            <p className="uwe-flash uwe-flash-warning">
              ⚠️ Dieser Import kann aktuell <strong>nicht automatisch zurückgerollt</strong>{" "}
              werden. Erstelle vorher ein Backup —{" "}
              <a href="/backup">Backup erstellen</a>. Ein Rollback ist sonst nur über ein
              vorhandenes Backup möglich.
            </p>

            {loading && importProgress ? (
              <JobProgressBar
                progress={importProgress.progress ?? 5}
                label={importProgress.label}
              />
            ) : null}

            <div className="uwe-form-actions">
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-primary"
                onClick={handleExecute}
                disabled={loading || !preview.canExecute || selectedCount === 0}
              >
                {loading && preview ? "Importiert…" : `Import bestätigen (${selectedCount})`}
              </button>
            </div>
          </section>
        </>
      )}

      {result && (
        <section className="uwe-panel">
          <h2>Import-Protokoll</h2>
          <p className="uwe-panel-intro">
            {result.created} erstellt, {result.updated} aktualisiert, {result.skipped}{" "}
            übersprungen, {result.failed} fehlgeschlagen.
          </p>

          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Status</th>
                <th>Eintrag</th>
                <th>Meldung</th>
              </tr>
            </thead>
            <tbody>
              {result.log.map((entry, index) => (
                <tr key={`${entry.timestamp}-${index}`}>
                  <td>{new Date(entry.timestamp).toLocaleTimeString("de-DE")}</td>
                  <td>
                    <span className={IMPORT_STATUS_CLASS[entry.status]}>
                      {IMPORT_STATUS_LABELS[entry.status]}
                    </span>
                  </td>
                  <td>{entry.title ?? entry.itemId ?? "—"}</td>
                  <td>{entry.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
