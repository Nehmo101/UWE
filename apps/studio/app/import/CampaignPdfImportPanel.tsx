"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MAX_CAMPAIGN_CONTEXT_CHARACTERS,
  MAX_CAMPAIGN_PDF_BYTES,
  type CampaignFitChatMessage,
  type CampaignImportPreviewSummary,
} from "@uwe/pdf-campaign-import";
import {
  PAGE_TYPE_LABELS,
  ResponsiveTable,
} from "@uwe/shared-ui";
import type {
  CampaignAnalysisProgress,
  CampaignFigurePreview,
  CampaignPdfJobStatus,
} from "@/src/lib/campaign-import-payloads";
import {
  executeImportCampaignPdfJobAction,
  getImportCampaignJobStatusAction,
  previewImportCampaignPdfJobAction,
} from "../import-campaign-actions";
import { CampaignFitChatCard } from "./CampaignFitChatCard";
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
  Textarea,
} from "@/src/components/ui";


const MAX_PDF_MEGABYTES = Math.floor(MAX_CAMPAIGN_PDF_BYTES / (1024 * 1024));
const STATUS_POLL_MS = 2_000;
/** Kein Fortschritts-Update mehr seit dieser Spanne ⇒ Analyse gilt als abgebrochen. */
const STALE_PROGRESS_MS = 3.5 * 60 * 1000;

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

function uploadCampaignPdf(
  jobId: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/import/campaign-pdf-upload");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      const body = xhr.response as { error?: string } | null;
      reject(new Error(body?.error || `Upload fehlgeschlagen (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Upload fehlgeschlagen — Netzwerkfehler."));
    const form = new FormData();
    form.set("jobId", jobId);
    form.set("file", file);
    xhr.send(form);
  });
}

function ProgressBar({ label, percent }: { label: string; percent: number | null }) {
  return (
    <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        {percent !== null ? <span>{percent}%</span> : null}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={
            percent !== null
              ? "h-full rounded-full bg-primary transition-all duration-500"
              : "h-full w-full animate-pulse rounded-full bg-primary/60"
          }
          style={percent !== null ? { width: `${Math.min(100, Math.max(0, percent))}%` } : undefined}
        />
      </div>
    </div>
  );
}

function analysisLabel(progress: CampaignAnalysisProgress): string {
  if (progress.phase === "extracting") {
    return "Text wird aus der PDF extrahiert…";
  }
  if (progress.phase === "ocr") {
    return progress.totalChunks
      ? `Lokale OCR liest die Seiten — ${progress.processedChunks} von ${progress.totalChunks} Blöcken`
      : "Lokale OCR liest die Seiten…";
  }
  if (!progress.totalChunks) {
    return "Lokale KI analysiert…";
  }
  return `Lokale KI analysiert — ${progress.processedChunks} von ${progress.totalChunks} Abschnitten`;
}

function analysisPercent(progress: CampaignAnalysisProgress): number | null {
  if (progress.phase === "extracting" || !progress.totalChunks) {
    return null;
  }
  return Math.round((progress.processedChunks / progress.totalChunks) * 100);
}

export function CampaignPdfImportPanel({ jobId, onComplete }: Props) {
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [hasPdf, setHasPdf] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [campaignContext, setCampaignContext] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<CampaignAnalysisProgress | null>(null);
  const [preview, setPreview] = useState<CampaignImportPreviewSummary | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resultSummary, setResultSummary] = useState<Record<string, unknown> | null>(null);
  const [undoToken, setUndoToken] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fitChatInitial, setFitChatInitial] = useState<CampaignFitChatMessage[] | null>(null);
  const [figures, setFigures] = useState<CampaignFigurePreview[]>([]);
  const progressWatchRef = useRef<{ key: string; changedAt: number } | null>(null);

  const applyFinishedPreview = useCallback((summary: CampaignImportPreviewSummary) => {
    setAnalyzing(false);
    setProgress(null);
    progressWatchRef.current = null;
    if (summary.totalDocuments > 0) {
      setPreview(summary);
      setSelectedIds(new Set(summary.items.map((item) => item.itemId)));
      setError(null);
    } else {
      setPreview(null);
      setError(summary.errors[0] ?? "Lokale KI hat keine gültigen Kampagnen-Entitäten geliefert.");
    }
  }, []);

  const applyStatus = useCallback(
    (status: CampaignPdfJobStatus) => {
      setHasPdf(status.hasPdf);
      setFigures(status.figures);
      if (status.pdfFileName) {
        setPdfFileName(status.pdfFileName);
      }
      if (status.progress) {
        const key = `${status.progress.phase}:${status.progress.processedChunks}`;
        const watch = progressWatchRef.current;
        if (!watch || watch.key !== key) {
          progressWatchRef.current = { key, changedAt: Date.now() };
        } else if (Date.now() - watch.changedAt > STALE_PROGRESS_MS) {
          setAnalyzing(false);
          setProgress(null);
          progressWatchRef.current = null;
          setError("Die Analyse scheint unterbrochen worden zu sein — bitte erneut starten.");
          return;
        }
        setAnalyzing(true);
        setProgress(status.progress);
        return;
      }
      if (status.preview) {
        applyFinishedPreview(status.preview);
        return;
      }
      if (status.status === "failed") {
        setAnalyzing(false);
        setProgress(null);
        progressWatchRef.current = null;
        setError(status.errorMessage ?? "PDF-Kampagnenvorschau fehlgeschlagen.");
      }
    },
    [applyFinishedPreview],
  );

  // Initialer Status: stellt Upload/Analyse/Vorschau/Chat nach einem Reload wieder her.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getImportCampaignJobStatusAction(jobId);
        if (cancelled) return;
        setFitChatInitial(status.fitChat);
        applyStatus(status);
      } catch {
        if (!cancelled) {
          setFitChatInitial([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, applyStatus]);

  // Fortschritts-Polling, solange die Analyse läuft.
  useEffect(() => {
    if (!analyzing) {
      return;
    }
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const status = await getImportCampaignJobStatusAction(jobId);
        if (!cancelled) {
          applyStatus(status);
        }
      } catch {
        // Kurzzeitige Netzwerkfehler beim Polling ignorieren.
      }
    }, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [analyzing, jobId, applyStatus]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > MAX_CAMPAIGN_PDF_BYTES) {
        setError(`PDF-Datei ist zu groß (max. ${MAX_PDF_MEGABYTES} MB).`);
        return;
      }

      setError(null);
      setResultSummary(null);
      setUndoToken(null);
      setPreview(null);
      setSelectedIds(new Set());
      setUploading(true);
      setUploadPercent(0);

      try {
        await uploadCampaignPdf(jobId, file, setUploadPercent);
        setPdfFileName(file.name);
        setHasPdf(true);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error ? uploadError.message : "Upload fehlgeschlagen.",
        );
      } finally {
        setUploading(false);
        setUploadPercent(null);
      }
    },
    [jobId],
  );

  const handleStartAnalysis = useCallback(async () => {
    if (!hasPdf) {
      setError("Bitte zuerst eine PDF-Datei hochladen.");
      return;
    }

    setError(null);
    setResultSummary(null);
    setUndoToken(null);
    setAnalyzing(true);
    setProgress({ phase: "extracting", processedChunks: 0, totalChunks: null, startedAt: "" });
    progressWatchRef.current = null;

    try {
      const response = await previewImportCampaignPdfJobAction(jobId, campaignContext);
      if (response.preview) {
        applyFinishedPreview(response.preview);
        return;
      }
      // Analyse läuft jetzt als Hintergrund-Job — der Fortschritt kommt über
      // das Polling in `applyStatus`, `analyzing` bleibt so lange gesetzt.
    } catch (previewError) {
      // Bei sehr langen Analysen kann die Verbindung abreißen, während der
      // Server weiterarbeitet — erst den Job-Status prüfen, dann Fehler zeigen.
      try {
        const status = await getImportCampaignJobStatusAction(jobId);
        if (status.progress || status.preview) {
          applyStatus(status);
          return;
        }
      } catch {
        // Status nicht erreichbar — unten als Fehler behandeln.
      }
      setAnalyzing(false);
      setProgress(null);
      setError(
        previewError instanceof Error ? previewError.message : "Vorschau fehlgeschlagen.",
      );
    }
  }, [applyFinishedPreview, applyStatus, campaignContext, hasPdf, jobId]);

  const handleExecute = useCallback(async () => {
    if (!preview) {
      setError("Bitte zuerst eine Vorschau erstellen.");
      return;
    }
    if (selectedIds.size === 0) {
      setError("Keine Entitäten zum Import ausgewählt.");
      return;
    }

    setExecuting(true);
    setError(null);

    try {
      const response = await executeImportCampaignPdfJobAction(jobId, [...selectedIds]);
      setResultSummary(response.resultSummary);
      setUndoToken(response.undoToken);
      onComplete?.();
    } catch (executeError) {
      setError(executeError instanceof Error ? executeError.message : "Import fehlgeschlagen.");
    } finally {
      setExecuting(false);
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

  const busy = uploading || analyzing || executing;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>PDF zu Kampagne</CardTitle>
          <CardDescription>
            Die lokale Maschinenraum-KI extrahiert Kampagnen-Entitäten. Vorschau und Seiten bleiben
            ausschließlich im DM-Bereich; gescannte PDFs benötigen vorab OCR. PDFs bis{" "}
            {MAX_PDF_MEGABYTES} MB werden direkt auf den UWE-Host hochgeladen.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campaign-pdf-import-file">PDF-Datei</Label>
            <FileInput
              id="campaign-pdf-import-file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              disabled={busy || preview !== null}
            />
          </div>

          {uploading ? (
            <ProgressBar label="PDF wird hochgeladen…" percent={uploadPercent} />
          ) : null}
          {!uploading && pdfFileName ? (
            <p className="text-sm text-muted-foreground">
              Hochgeladen: {pdfFileName}
              {hasPdf ? "" : " (Datei bereits verarbeitet)"}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campaign-pdf-import-context">Kampagnen-Kontext in der Welt</Label>
            <Textarea
              id="campaign-pdf-import-context"
              value={campaignContext}
              onChange={(event) => setCampaignContext(event.target.value)}
              rows={8}
              maxLength={MAX_CAMPAIGN_CONTEXT_CHARACTERS}
              disabled={analyzing || preview !== null}
              placeholder={
                "Die Kampagne spielt während des Thronfolgekriegs im Norden Validors."
              }
            />
            <p className="text-xs text-muted-foreground">
              {
                "Optional. Dieser Text hilft der lokalen KI bei der Einordnung; es wird kein zusätzlicher Welt- oder Brain-Kontext geladen. "
              }
              {campaignContext.length}/{MAX_CAMPAIGN_CONTEXT_CHARACTERS} Zeichen
            </p>
          </div>

          {analyzing && progress ? (
            <ProgressBar label={analysisLabel(progress)} percent={analysisPercent(progress)} />
          ) : null}

          <Button
            type="button"
            onClick={handleStartAnalysis}
            disabled={busy || !hasPdf || preview !== null}
            className="self-start"
          >
            {analyzing
              ? "Lokale KI analysiert…"
              : preview
                ? "Vorschau erstellt"
                : "Analyse starten"}
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
      {preview?.notes.map((note) => (
        <Alert key={note} tone="info">
          {note}
        </Alert>
      ))}
      {figures.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Gefundene Abbildungen ({figures.length})</CardTitle>
            <CardDescription>
              Karten und Illustrationen aus der PDF. Sie werden beim Import an die Seiten
              gehängt, die aus derselben PDF-Seite stammen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {figures.map((figure) => (
                <li key={figure.index} className="flex flex-col gap-1">
                  {/* Zwischenmaterial ohne Asset-Eintrag — eigene Route,
                      deshalb kein next/image. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/import/campaign-figure?jobId=${encodeURIComponent(jobId)}&index=${figure.index}`}
                    alt={`Abbildung von Seite ${figure.pageNumber}`}
                    loading="lazy"
                    className="w-full rounded-md border border-border bg-muted object-contain"
                  />
                  <span className="text-xs text-muted-foreground">
                    Seite {figure.pageNumber} · {figure.type}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
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
              {preview.totalDocuments} Entität{preview.totalDocuments === 1 ? "" : "en"} erkannt.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ResponsiveTable
              caption="Erkannte Entitäten"
              rowKey={(item) => item.itemId}
              rows={preview.items}
              columns={[
                {
                  key: "select",
                  label: "Auswahl",
                  header: (
                    /* TODO(design-kit): natives Checkbox-Element – Kit hat noch keine Checkbox-Komponente. */
                    <input
                      type="checkbox"
                      aria-label="Alle Entitäten auswählen"
                      onChange={toggleAll}
                      checked={
                        preview.items.length > 0 &&
                        preview.items.every((entry) => selectedIds.has(entry.itemId))
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                  ),
                  render: (item) => (
                    <input
                      type="checkbox"
                      aria-label={item.title + " auswählen"}
                      checked={selectedIds.has(item.itemId)}
                      onChange={() => toggleItem(item.itemId)}
                      className="h-4 w-4 rounded border-input"
                    />
                  ),
                },
                { key: "title", label: "Titel", primary: true, render: (item) => item.title },
                { key: "kind", label: "Art", render: (item) => pageTypeLabel(item.pageType) },
                { key: "excerpt", label: "Zusammenfassung", render: (item) => item.excerpt },
              ]}
            />

            <p className="text-sm text-muted-foreground">
              Die lokale KI läuft nur für diese Vorschau. „Import ausführen“ verwendet ausschließlich
              die gespeicherten Entitäten und erzeugt DM-only-Seiten in der gewählten Kampagne.
            </p>

            <Button
              type="button"
              onClick={handleExecute}
              disabled={busy || !preview.canExecute || selectedIds.size === 0}
              className="self-start"
            >
              {executing ? "Importiert…" : "Import ausführen"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {fitChatInitial !== null ? (
        <CampaignFitChatCard jobId={jobId} initialMessages={fitChatInitial} />
      ) : null}
    </div>
  );
}
