"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { ImportSourceType, ImportTargetType } from "@uwe/database/import-constants";
import {
  IMPORT_JOB_STATUS_LABELS,
  IMPORT_SOURCE_TYPE_LABELS,
  IMPORT_TARGET_TYPE_LABELS,
} from "@uwe/database/import-constants";
import type { ImportFormat } from "@uwe/knoteforge-import";
import {
  importCentralSourceAccept,
  importCentralUsesWorldTarget,
  isImportCentralComboSupported,
  isImportCentralMarkdownTarget,
  isImportCentralPdfSource,
  isImportCentralSourceComingSoon,
  isImportCentralTargetComingSoon,
} from "@/src/lib/import-central-utils";
import { createImportCentralJobAction, rollbackImportCentralJobAction } from "../import-central-actions";
import { ImportWorkspace } from "../worlds/[worldSlug]/import/ImportWorkspace";
import { MarkdownCentralImportPanel } from "./MarkdownCentralImportPanel";
import { PdfCentralImportPanel } from "./PdfCentralImportPanel";
import {
  Alert,
  Badge,
  type BadgeProps,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  buttonVariants,
  cn,
} from "@/src/components/ui";

const TH_CLASS = "border-b border-border px-3 py-2 text-left font-medium text-muted-foreground";
const TD_CLASS = "border-b border-border/60 px-3 py-2 align-top";

/** Native select — fester, nicht-leerer Wertebereich, siehe Muster in UserManagementWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

interface WorldOption {
  id: string;
  name: string;
  slug: string;
}

export interface ImportCentralJobRow {
  id: string;
  sourceType: ImportSourceType;
  targetType: ImportTargetType;
  status: string;
  fileName: string | null;
  targetWorldId: string | null;
  targetWorldName: string | null;
  targetWorldSlug: string | null;
  previewPayload: unknown;
  resultSummary: unknown;
  undoToken: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  worlds: WorldOption[];
  initialJobs: ImportCentralJobRow[];
  supportedFormats: ImportFormat[];
  plannedFormats: ImportFormat[];
}

function jobStatusVariant(status: string): BadgeProps["variant"] {
  switch (status) {
    case "preview":
    case "executing":
      return "info";
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "rolled_back":
      return "warning";
    default:
      return "default";
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "medium" }).format(
    new Date(value),
  );
}

function readPreviewSummary(previewPayload: unknown): string | null {
  if (!previewPayload || typeof previewPayload !== "object" || Array.isArray(previewPayload)) {
    return null;
  }

  const markdownPreview = previewPayload as { totalDocuments?: unknown; items?: unknown[] };
  if (typeof markdownPreview.totalDocuments === "number") {
    return `${markdownPreview.totalDocuments} Dokument(e) in Vorschau`;
  }

  const total = (previewPayload as { totalEntities?: unknown }).totalEntities;
  return typeof total === "number" ? `${total} Einträge in Vorschau` : null;
}

function readResultSummary(resultSummary: unknown): string | null {
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

export function ImportCentralWorkspace({
  worlds,
  initialJobs,
  supportedFormats,
  plannedFormats,
}: Props) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [sourceType, setSourceType] = useState<ImportSourceType>("knoteforge");
  const [targetType, setTargetType] = useState<ImportTargetType>("world");
  const [targetWorldId, setTargetWorldId] = useState(worlds[0]?.id ?? "");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  const activeJob = useMemo(
    () => jobs.find((job) => job.id === activeJobId) ?? null,
    [activeJobId, jobs],
  );

  const needsWorld = importCentralUsesWorldTarget(targetType);
  const comboSupported = isImportCentralComboSupported(sourceType, targetType);
  const showComingSoon = isImportCentralSourceComingSoon(sourceType);
  const selectedWorld = worlds.find((world) => world.id === targetWorldId) ?? null;
  const embedWorldSlug = activeJob?.targetWorldSlug ?? selectedWorld?.slug ?? null;

  const handleCreateJob = useCallback(() => {
    startTransition(async () => {
      setError(null);

      try {
        const formData = new FormData();
        formData.set("sourceType", sourceType);
        formData.set("targetType", targetType);
        if (needsWorld) {
          formData.set("targetWorldId", targetWorldId);
        }
        if (fileName) {
          formData.set("fileName", fileName);
        }

        const { jobId } = await createImportCentralJobAction(formData);
        setActiveJobId(jobId);
        router.refresh();
      } catch (createError) {
        setError(
          createError instanceof Error ? createError.message : "Import-Job konnte nicht erstellt werden.",
        );
      }
    });
  }, [fileName, needsWorld, router, sourceType, targetType, targetWorldId]);

  const handleRollback = useCallback(
    (jobId: string) => {
      startTransition(async () => {
        setError(null);
        try {
          await rollbackImportCentralJobAction(jobId);
          router.refresh();
        } catch (rollbackError) {
          setError(
            rollbackError instanceof Error
              ? rollbackError.message
              : "Rollback fehlgeschlagen.",
          );
        }
      });
    },
    [router],
  );

  const handleImportComplete = useCallback(() => {
    router.refresh();
  }, [router]);

  const renderActiveJobImport = () => {
    if (!activeJob) return null;

    if (
      activeJob.targetType === "world" &&
      activeJob.sourceType === "knoteforge" &&
      activeJob.targetWorldSlug
    ) {
      return (
        <p className="text-sm text-muted-foreground">
          Vollständiger Import:{" "}
          <Link href={`/worlds/${activeJob.targetWorldSlug}/import`}>Welt-Import öffnen</Link>
        </p>
      );
    }

    if (
      activeJob.targetType === "world" &&
      embedWorldSlug &&
      isImportCentralComboSupported(activeJob.sourceType, activeJob.targetType)
    ) {
      return (
        <ImportWorkspace
          worldSlug={embedWorldSlug}
          supportedFormats={supportedFormats}
          plannedFormats={plannedFormats}
          jobId={activeJob.id}
        />
      );
    }

    if (isImportCentralPdfSource(activeJob.sourceType) && isImportCentralMarkdownTarget(activeJob.targetType)) {
      return (
        <PdfCentralImportPanel
          jobId={activeJob.id}
          targetType={activeJob.targetType}
          onComplete={handleImportComplete}
        />
      );
    }

    if (isImportCentralMarkdownTarget(activeJob.targetType)) {
      return (
        <MarkdownCentralImportPanel
          jobId={activeJob.id}
          sourceType={activeJob.sourceType}
          targetType={activeJob.targetType}
          fileAccept={importCentralSourceAccept(activeJob.sourceType)}
          onComplete={handleImportComplete}
        />
      );
    }

    return (
      <p className="text-sm text-muted-foreground">
        Für diese Quelle/Ziel-Kombination ist noch kein direkter Import implementiert.
      </p>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Neuer Import</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Wähle Quelle und Ziel und lege einen Import-Job an. Markdown, Obsidian (einzelne Dateien,
            Vault-Ordner oder Vault-ZIP) und PDF können in Life Brain, Capture oder DnD-Seiten
            importiert werden. KnoteForge-JSON importiert nur in Welten. Jeder Import zeigt zuerst
            eine Vorschau und kann nach der Ausführung über den Verlauf zurückgerollt werden.
          </p>

          {/* TODO(design-kit): Alle Selects hier sind controlled (value+onChange), Kit-Select
              (Radix) unterstützt das noch nicht direkt — native <select> bleibt, siehe Muster in
              UserManagementWorkspace.tsx. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-central-source">Quelle</Label>
              <select
                id="import-central-source"
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value as ImportSourceType)}
                className={NATIVE_SELECT_CLASS}
              >
                {(["knoteforge", "markdown", "obsidian", "pdf"] as ImportSourceType[]).map((entry) => (
                  <option key={entry} value={entry}>
                    {IMPORT_SOURCE_TYPE_LABELS[entry]}
                    {isImportCentralSourceComingSoon(entry) ? " (demnächst)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-central-target">Ziel</Label>
              <select
                id="import-central-target"
                value={targetType}
                onChange={(event) => setTargetType(event.target.value as ImportTargetType)}
                className={NATIVE_SELECT_CLASS}
              >
                {(["world", "personal_brain", "capture", "dnd_page"] as ImportTargetType[]).map(
                  (entry) => (
                    <option key={entry} value={entry}>
                      {IMPORT_TARGET_TYPE_LABELS[entry]}
                      {isImportCentralTargetComingSoon(entry) ? " (demnächst)" : ""}
                    </option>
                  ),
                )}
              </select>
            </div>

            {needsWorld ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="import-central-world">Welt</Label>
                <select
                  id="import-central-world"
                  value={targetWorldId}
                  onChange={(event) => setTargetWorldId(event.target.value)}
                  disabled={worlds.length === 0}
                  className={NATIVE_SELECT_CLASS}
                >
                  {worlds.length === 0 ? (
                    <option value="">Keine Welten vorhanden</option>
                  ) : (
                    worlds.map((world) => (
                      <option key={world.id} value={world.id}>
                        {world.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            ) : null}
          </div>

          {showComingSoon ? (
            <Alert tone="warning">Diese Quelle/Ziel-Kombination ist noch nicht verfügbar.</Alert>
          ) : null}

          {comboSupported ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="import-central-file">Dateiname (optional)</Label>
              <input
                id="import-central-file"
                type="file"
                accept={importCentralSourceAccept(sourceType)}
                onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
                className="text-sm text-foreground"
              />
            </div>
          ) : null}

          <Button
            type="button"
            onClick={handleCreateJob}
            disabled={pending || (needsWorld && !targetWorldId) || !comboSupported}
            className="self-start"
          >
            {pending ? "Wird angelegt…" : "Import-Job starten"}
          </Button>
        </CardContent>
      </Card>

      {activeJob ? (
        <Card>
          <CardHeader>
            <CardTitle>Aktiver Job</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={jobStatusVariant(activeJob.status)}>
                {IMPORT_JOB_STATUS_LABELS[activeJob.status as keyof typeof IMPORT_JOB_STATUS_LABELS] ??
                  activeJob.status}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {IMPORT_SOURCE_TYPE_LABELS[activeJob.sourceType]} →{" "}
                {IMPORT_TARGET_TYPE_LABELS[activeJob.targetType]}
                {activeJob.targetWorldName ? ` (${activeJob.targetWorldName})` : ""}
              </span>
            </div>

            {renderActiveJobImport()}
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Alert tone="danger" role="alert">
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Import-Verlauf</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Import-Jobs.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={TH_CLASS}>Zeit</th>
                    <th className={TH_CLASS}>Quelle</th>
                    <th className={TH_CLASS}>Ziel</th>
                    <th className={TH_CLASS}>Welt</th>
                    <th className={TH_CLASS}>Status</th>
                    <th className={TH_CLASS}>Details</th>
                    <th className={TH_CLASS}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td className={TD_CLASS}>{formatDate(job.createdAt)}</td>
                      <td className={TD_CLASS}>{IMPORT_SOURCE_TYPE_LABELS[job.sourceType]}</td>
                      <td className={TD_CLASS}>{IMPORT_TARGET_TYPE_LABELS[job.targetType]}</td>
                      <td className={TD_CLASS}>{job.targetWorldName ?? "—"}</td>
                      <td className={TD_CLASS}>
                        <Badge variant={jobStatusVariant(job.status)}>
                          {IMPORT_JOB_STATUS_LABELS[
                            job.status as keyof typeof IMPORT_JOB_STATUS_LABELS
                          ] ?? job.status}
                        </Badge>
                      </td>
                      <td className={TD_CLASS}>
                        {job.errorMessage ? (
                          <span className="text-xs text-muted-foreground">{job.errorMessage}</span>
                        ) : readResultSummary(job.resultSummary) ? (
                          readResultSummary(job.resultSummary)
                        ) : readPreviewSummary(job.previewPayload) ? (
                          readPreviewSummary(job.previewPayload)
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={TD_CLASS}>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" onClick={() => setActiveJobId(job.id)}>
                            Öffnen
                          </Button>
                          {job.status === "completed" && job.undoToken ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleRollback(job.id)}
                              disabled={pending}
                            >
                              Zurückrollen
                            </Button>
                          ) : null}
                          {job.sourceType === "knoteforge" &&
                          job.targetType === "world" &&
                          job.targetWorldSlug ? (
                            <Link
                              className={cn(buttonVariants({ variant: "outline" }))}
                              href={`/worlds/${job.targetWorldSlug}/import`}
                            >
                              Welt-Import
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
