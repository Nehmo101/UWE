"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  ImportExecuteResult,
  ImportFormat,
  ImportItemPreview,
  ImportPreviewResult,
  ImportStatus,
} from "@uwe/knoteforge-import";

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
}

function isSelectable(status: ImportStatus): boolean {
  return status === "new" || status === "update" || status === "conflict";
}

function defaultSelectedIds(items: ImportItemPreview[]): Set<string> {
  return new Set(items.filter((item) => isSelectable(item.status)).map((item) => item.itemId));
}

export function ImportWorkspace({ worldSlug, supportedFormats, plannedFormats }: Props) {
  const [format, setFormat] = useState<ImportFormat>(supportedFormats[0] ?? "json");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ImportExecuteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoResolveSlugConflicts, setAutoResolveSlugConflicts] = useState(true);
  const [allowUpdates, setAllowUpdates] = useState(true);

  const selectedCount = selectedIds.size;

  const summaryEntries = useMemo(() => {
    if (!preview) return [];
    return Object.entries(preview.summary).filter(([, count]) => count > 0);
  }, [preview]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setResult(null);

    const text = await file.text();
    setContent(text);
  }, []);

  const handlePreview = useCallback(async () => {
    if (!content.trim()) {
      setError("Bitte zuerst eine Import-Datei auswählen.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/import/preview", {
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

      setPreview(data.preview);
      setSelectedIds(defaultSelectedIds(data.preview.items));
    } catch (previewError) {
      setPreview(null);
      setSelectedIds(new Set());
      setError(
        previewError instanceof Error ? previewError.message : "Vorschau fehlgeschlagen.",
      );
    } finally {
      setLoading(false);
    }
  }, [content, format, worldSlug]);

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

    try {
      const response = await fetch("/api/import/execute", {
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
        error?: string;
      };

      if (!response.ok || !data.result) {
        throw new Error(data.error ?? "Import fehlgeschlagen.");
      }

      setResult(data.result);
    } catch (executeError) {
      setError(
        executeError instanceof Error ? executeError.message : "Import fehlgeschlagen.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    allowUpdates,
    autoResolveSlugConflicts,
    content,
    format,
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
        <h2>Import-Datei</h2>
        <p className="uwe-panel-intro">
          Export aus KnoteForge Local als JSON hochladen. Markdown und HTML sind vorbereitet,
          aber noch nicht verfügbar.
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
                  {entry.toUpperCase()}
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
            Datei
            <input type="file" accept=".json,application/json" onChange={handleFileChange} />
          </label>
        </div>

        {fileName && (
          <p className="uwe-table-sub">
            Ausgewählt: {fileName} ({Math.round(content.length / 1024)} KB)
          </p>
        )}

        <div className="uwe-form-actions">
          <button
            type="button"
            className="uwe-btn uwe-btn-primary"
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
              <p className="uwe-empty">Keine importierbaren Einträge gefunden.</p>
            )}

            <div className="uwe-form-actions">
              <button
                type="button"
                className="uwe-btn uwe-btn-primary"
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
