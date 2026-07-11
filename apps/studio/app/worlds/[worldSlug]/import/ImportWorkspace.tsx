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
import {
  Alert,
  Badge,
  type BadgeProps,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Textarea,
} from "@/src/components/ui";

const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  new: "Neu",
  update: "Update",
  duplicate: "Duplikat",
  conflict: "Konflikt",
  skipped: "Übersprungen",
  error: "Fehler",
};

function statusVariant(status: ImportStatus): BadgeProps["variant"] {
  switch (status) {
    case "new":
      return "success";
    case "update":
      return "info";
    case "duplicate":
    case "skipped":
      return "warning";
    case "error":
      return "danger";
    default:
      return "default";
  }
}

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";

/** Native select — fester, nicht-leerer Wertebereich, siehe Muster in UserManagementWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Import-Quelle</CardTitle>
          <CardDescription>
            KnoteForge-Export als JSON — entweder das UWE-Importformat (Objekt mit{" "}
            <code>entities</code>) oder einen Eingang-Export (<code>eingang_export.json</code>).
            Alternativ mehrere unstrukturierte Texte als Markdown/TXT: getrennt durch{" "}
            <code>---</code> in einer Datei oder als Mehrfachauswahl.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-format">Format</Label>
              {/* TODO(design-kit): natives Select — fester Wertebereich, kein Leerwert, siehe Muster in UserManagementWorkspace.tsx. */}
              <select id="import-format" value={format} onChange={(event) => setFormat(event.target.value as ImportFormat)} className={NATIVE_SELECT_CLASS}>
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
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-files">Datei(en)</Label>
              <input id="import-files" type="file" accept=".json,.md,.markdown,.txt,application/json,text/markdown,text/plain" multiple onChange={handleFileChange} className="text-sm text-foreground" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-content">Text einfügen (optional)</Label>
            <Textarea id="import-content" rows={8} value={content} onChange={handleContentChange} placeholder={`# Lore-Fragment\n\nUnstrukturierter Text mit [[Wikilinks]].\n\n---\n\n# Zweites Fragment\n\nWeiterer Text …`} />
          </div>

          {fileName && (
            <p className="text-sm text-muted-foreground">
              Ausgewählt: {fileName}
              {fileCount > 1 ? ` (${fileCount} Dateien)` : ""} ({Math.round(content.length / 1024)} KB)
            </p>
          )}

          <Button type="button" disabled={loading || !content.trim()} onClick={handlePreview} className="self-start">
            {loading && !result ? "Lädt…" : "Vorschau anzeigen"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      )}

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Vorschau</CardTitle>
            <CardDescription>
              {preview.totalEntities} Einträge erkannt. Die Vorschau ändert keine Daten in der
              Datenbank.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {preview.errors.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-semibold">Hinweise</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {preview.errors.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </div>
            )}

            {summaryEntries.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {summaryEntries.map(([status, count]) => (
                  <Badge key={status} variant={statusVariant(status as ImportStatus)}>
                    {IMPORT_STATUS_LABELS[status as ImportStatus]}: {count}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              {/* TODO(design-kit): natives Checkbox-Element — Kit hat noch keine Checkbox-Komponente. */}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={autoResolveSlugConflicts} onChange={(event) => setAutoResolveSlugConflicts(event.target.checked)} className="h-4 w-4 rounded border-input" />
                Slug-Konflikte automatisch auflösen
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allowUpdates} onChange={(event) => setAllowUpdates(event.target.checked)} className="h-4 w-4 rounded border-input" />
                Bestehende Einträge aktualisieren (gleiche KnoteForge-ID)
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={TH_CLASS}>
                      <input
                        type="checkbox"
                        aria-label="Alle auswählen"
                        onChange={toggleAll}
                        checked={
                          preview.items.filter((item) => isSelectable(item.status)).length > 0 &&
                          preview.items.filter((item) => isSelectable(item.status)).every((item) => selectedIds.has(item.itemId))
                        }
                        className="h-4 w-4 rounded border-input"
                      />
                    </th>
                    <th className={TH_CLASS}>Titel</th>
                    <th className={TH_CLASS}>Typ</th>
                    <th className={TH_CLASS}>Status</th>
                    <th className={TH_CLASS}>Slug</th>
                    <th className={TH_CLASS}>Konflikte</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((item) => (
                    <tr key={item.itemId}>
                      <td className={TD_CLASS}>
                        <input type="checkbox" checked={selectedIds.has(item.itemId)} disabled={!isSelectable(item.status)} onChange={() => toggleItem(item.itemId, item.status)} aria-label={`${item.title} importieren`} className="h-4 w-4 rounded border-input" />
                      </td>
                      <td className={TD_CLASS}>
                        <strong>{item.title}</strong>
                        {item.warnings.length > 0 && (
                          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            {item.warnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className={TD_CLASS}>
                        <code>{item.knoteforgeType}</code>
                        <span className="text-xs text-muted-foreground"> → {item.pageType}</span>
                      </td>
                      <td className={TD_CLASS}>
                        <Badge variant={statusVariant(item.status)}>{IMPORT_STATUS_LABELS[item.status]}</Badge>
                      </td>
                      <td className={TD_CLASS}>
                        {item.resolvedSlug !== item.slug ? (
                          <>
                            <span className="text-xs text-muted-foreground">{item.slug}</span>
                            <br />
                            → {item.resolvedSlug}
                          </>
                        ) : (
                          item.slug
                        )}
                      </td>
                      <td className={TD_CLASS}>
                        {item.conflicts.length > 0 ? (
                          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
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
            </div>

            {preview.items.length === 0 && (
              <p className="text-sm text-muted-foreground">Keine importierbaren Einträge gefunden.</p>
            )}

            <Alert tone="warning">
              Dieser Import kann aktuell <strong>nicht automatisch zurückgerollt</strong> werden.
              Erstelle vorher ein Backup — <a href="/backup">Backup erstellen</a>. Ein Rollback ist
              sonst nur über ein vorhandenes Backup möglich.
            </Alert>

            {loading && importProgress ? (
              <JobProgressBar progress={importProgress.progress ?? 5} label={importProgress.label} />
            ) : null}

            <Button type="button" disabled={loading || !preview.canExecute || selectedCount === 0} onClick={handleExecute} className="self-start">
              {loading && preview ? "Importiert…" : `Import bestätigen (${selectedCount})`}
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Import-Protokoll</CardTitle>
            <CardDescription>
              {result.created} erstellt, {result.updated} aktualisiert, {result.skipped}{" "}
              übersprungen, {result.failed} fehlgeschlagen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={TH_CLASS}>Zeit</th>
                    <th className={TH_CLASS}>Status</th>
                    <th className={TH_CLASS}>Eintrag</th>
                    <th className={TH_CLASS}>Meldung</th>
                  </tr>
                </thead>
                <tbody>
                  {result.log.map((entry, index) => (
                    <tr key={`${entry.timestamp}-${index}`}>
                      <td className={TD_CLASS}>{new Date(entry.timestamp).toLocaleTimeString("de-DE")}</td>
                      <td className={TD_CLASS}>
                        <Badge variant={statusVariant(entry.status)}>{IMPORT_STATUS_LABELS[entry.status]}</Badge>
                      </td>
                      <td className={TD_CLASS}>{entry.title ?? entry.itemId ?? "—"}</td>
                      <td className={TD_CLASS}>{entry.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
