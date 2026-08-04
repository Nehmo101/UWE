"use client";

import { useCallback, useMemo, useState } from "react";
import type { ImportTargetType, MarkdownImportPreviewResult } from "@uwe/database/import-constants";
import { arrayBufferToBase64 } from "@/src/lib/file-base64";
import {
  executeImportCentralPdfJobAction,
  previewImportCentralPdfJobAction,
} from "../import-central-actions";
import { ResponsiveTable } from "@uwe/shared-ui";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FileInput,
  Label,
} from "@/src/components/ui";


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
  const [undoToken, setUndoToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const singleTarget = targetType === "dnd_page";
  const selectedCount = selectedIds.size;

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setResultSummary(null);
    setUndoToken(null);
    setPreview(null);
    setSelectedIds(new Set());

    const buffer = await file.arrayBuffer();
    setContentBase64(arrayBufferToBase64(buffer));
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
      const response = await executeImportCentralPdfJobAction(
        jobId,
        contentBase64,
        singleTarget ? undefined : [...selectedIds],
      );
      setResultSummary(response.resultSummary);
      setUndoToken(response.undoToken);
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
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>PDF-Import</CardTitle>
          <CardDescription>
            Text wird aus der PDF extrahiert und wie Markdown importiert. Gescannte PDFs ohne Textlayer
            benötigen OCR vorab.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pdf-import-file">PDF-Datei</Label>
            <FileInput
              id="pdf-import-file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
            />
          </div>

          {fileName ? <p className="text-sm text-muted-foreground">Ausgewählt: {fileName}</p> : null}

          <Button type="button" onClick={handlePreview} disabled={loading || !contentBase64} className="self-start">
            {loading && !resultSummary ? "Lädt…" : "Vorschau anzeigen"}
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      ) : null}
      {resultLabel ? (
        <Alert tone="success">
          {resultLabel}
          {undoToken
            ? " — der Import kann im Import-Verlauf über „Zurückrollen“ rückgängig gemacht werden."
            : ""}
        </Alert>
      ) : null}

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle>Vorschau</CardTitle>
            <CardDescription>
              {preview.totalDocuments} Abschnitt{preview.totalDocuments === 1 ? "" : "e"} erkannt.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Das Auswahl-Kästchen je Zeile trug keine Beschriftung — im
                Screenreader hieß jede Zeile nur „Kontrollkästchen". */}
            <ResponsiveTable
              caption="Import-Vorschau"
              rowKey={(item) => item.itemId}
              rows={preview.items}
              columns={[
                ...(singleTarget
                  ? []
                  : [
                      {
                        key: "select",
                        label: "Auswahl",
                        header: (
                          /* TODO(design-kit): natives Checkbox-Element — Kit hat noch keine Checkbox-Komponente. */
                          <input
                            type="checkbox"
                            aria-label="Alle auswählen"
                            onChange={toggleAll}
                            checked={
                              preview.items.length > 0 &&
                              preview.items.every((entry) => selectedIds.has(entry.itemId))
                            }
                            className="h-4 w-4 rounded border-input"
                          />
                        ),
                        render: (item: MarkdownImportPreviewResult["items"][number]) => (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.itemId)}
                            onChange={() => toggleItem(item.itemId)}
                            aria-label={`${item.title} importieren`}
                            className="h-4 w-4 rounded border-input"
                          />
                        ),
                      },
                    ]),
                { key: "title", label: "Titel", primary: true, render: (item) => item.title },
                { key: "excerpt", label: "Auszug", render: (item) => item.excerpt },
              ]}
            />

            <p className="text-sm text-muted-foreground">
              Die Vorschau ändert keine Daten. Nach dem Import kannst du den Job im Import-Verlauf
              über „Zurückrollen“ rückgängig machen.
            </p>

            <Button
              type="button"
              onClick={handleExecute}
              disabled={loading || !preview.canExecute || (!singleTarget && selectedCount === 0)}
              className="self-start"
            >
              Import ausführen
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
