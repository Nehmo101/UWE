"use client";

import { useCallback, useMemo, useState } from "react";
import {
  MAX_CAMPAIGN_CONTEXT_CHARACTERS,
  type CampaignImportPreview,
} from "@uwe/pdf-campaign-import";
import { PAGE_TYPE_LABELS } from "@uwe/shared-ui";
import { arrayBufferToBase64 } from "@/src/lib/file-base64";
import {
  executeImportCampaignPdfJobAction,
  previewImportCampaignPdfJobAction,
} from "../import-campaign-actions";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Textarea,
} from "@/src/components/ui";

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";

interface Props {
  jobId: string;
  onComplete?: () => void;
}

function pageTypeLabel(pageType: string | undefined): string {
  if (!pageType) {
    return "Notiz";
  }
  return PAGE_TYPE_LABELS[pageType as keyof typeof PAGE_TYPE_LABELS] ?? pageType;
}

export function CampaignPdfImportPanel({ jobId, onComplete }: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [contentBase64, setContentBase64] = useState<string | null>(null);
  const [campaignContext, setCampaignContext] = useState("");
  const [preview, setPreview] = useState<CampaignImportPreview | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resultSummary, setResultSummary] = useState<Record<string, unknown> | null>(null);
  const [undoToken, setUndoToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<"preview" | "execute" | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    setLoading("preview");
    setError(null);
    setResultSummary(null);

    try {
      const response = await previewImportCampaignPdfJobAction(
        jobId,
        contentBase64,
        campaignContext,
      );
      setPreview(response.preview);
      setSelectedIds(new Set(response.preview.items.map((item) => item.itemId)));
    } catch (previewError) {
      setPreview(null);
      setSelectedIds(new Set());
      setError(previewError instanceof Error ? previewError.message : "Vorschau fehlgeschlagen.");
    } finally {
      setLoading(null);
    }
  }, [campaignContext, contentBase64, jobId]);

  const handleExecute = useCallback(async () => {
    if (!preview) {
      setError("Bitte zuerst eine Vorschau erstellen.");
      return;
    }
    if (selectedIds.size === 0) {
      setError("Keine Entitäten zum Import ausgewählt.");
      return;
    }

    setLoading("execute");
    setError(null);

    try {
      const response = await executeImportCampaignPdfJobAction(jobId, [...selectedIds]);
      setResultSummary(response.resultSummary);
      setUndoToken(response.undoToken);
      onComplete?.();
    } catch (executeError) {
      setError(executeError instanceof Error ? executeError.message : "Import fehlgeschlagen.");
    } finally {
      setLoading(null);
    }
  }, [jobId, onComplete, preview, selectedIds]);

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
    return String(resultSummary.created ?? 0) + " Kampagnenseiten erstellt";
  }, [resultSummary]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>PDF zu Kampagne</CardTitle>
          <CardDescription>
            Die lokale RTX-KI extrahiert Kampagnen-Entitäten. Vorschau und Seiten bleiben
            ausschließlich im DM-Bereich; gescannte PDFs benötigen vorab OCR.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campaign-pdf-import-file">PDF-Datei</Label>
            {/* TODO(design-kit): natives File-Input – Kit hat noch keine File-Input-Komponente. */}
            <input
              id="campaign-pdf-import-file"
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              disabled={preview !== null}
              className="text-sm text-foreground"
            />
          </div>

          {fileName ? <p className="text-sm text-muted-foreground">Ausgewählt: {fileName}</p> : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campaign-pdf-import-context">Kampagnen-Kontext in der Welt</Label>
            <Textarea
              id="campaign-pdf-import-context"
              value={campaignContext}
              onChange={(event) => setCampaignContext(event.target.value)}
              rows={5}
              maxLength={MAX_CAMPAIGN_CONTEXT_CHARACTERS}
              disabled={preview !== null}
              placeholder={
                "Die Kampagne spielt w\u00e4hrend des Thronfolgekriegs im Norden Validors."
              }
            />
            <p className="text-xs text-muted-foreground">
              {
                "Optional. Dieser Text hilft der lokalen KI bei der Einordnung; es wird kein zus\u00e4tzlicher Welt- oder Brain-Kontext geladen. "
              }
              {campaignContext.length}/{MAX_CAMPAIGN_CONTEXT_CHARACTERS} Zeichen
            </p>
          </div>

          <Button
            type="button"
            onClick={handlePreview}
            disabled={loading !== null || !contentBase64 || preview !== null}
            className="self-start"
          >
            {loading === "preview"
              ? "Lokale KI analysiert…"
              : preview
                ? "Vorschau erstellt"
                : "Vorschau anzeigen"}
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      ) : null}
      {preview?.errors.map((previewError) => (
        <Alert key={previewError} tone="danger" role="alert">
          {previewError}
        </Alert>
      ))}
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
              {preview.totalDocuments} Entität{preview.totalDocuments === 1 ? "" : "en"} erkannt.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={TH_CLASS}>
                      {/* TODO(design-kit): natives Checkbox-Element – Kit hat noch keine Checkbox-Komponente. */}
                      <input
                        type="checkbox"
                        aria-label="Alle Entitäten auswählen"
                        onChange={toggleAll}
                        checked={
                          preview.items.length > 0 &&
                          preview.items.every((item) => selectedIds.has(item.itemId))
                        }
                        className="h-4 w-4 rounded border-input"
                      />
                    </th>
                    <th className={TH_CLASS}>Art</th>
                    <th className={TH_CLASS}>Titel</th>
                    <th className={TH_CLASS}>Zusammenfassung</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((item) => (
                    <tr key={item.itemId}>
                      <td className={TD_CLASS}>
                        <input
                          type="checkbox"
                          aria-label={item.title + " auswählen"}
                          checked={selectedIds.has(item.itemId)}
                          onChange={() => toggleItem(item.itemId)}
                          className="h-4 w-4 rounded border-input"
                        />
                      </td>
                      <td className={TD_CLASS}>{pageTypeLabel(item.pageType)}</td>
                      <td className={TD_CLASS}>{item.title}</td>
                      <td className={TD_CLASS}>{item.excerpt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-sm text-muted-foreground">
              Die lokale KI läuft nur für diese Vorschau. „Import ausführen“ verwendet ausschließlich
              die gespeicherten Entitäten und erzeugt DM-only-Seiten in der gewählten Kampagne.
            </p>

            <Button
              type="button"
              onClick={handleExecute}
              disabled={loading !== null || !preview.canExecute || selectedIds.size === 0}
              className="self-start"
            >
              {loading === "execute" ? "Importiert…" : "Import ausführen"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
