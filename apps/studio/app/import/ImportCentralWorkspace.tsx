"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { ImportSourceType, ImportTargetType } from "@uwe/database/server";
import {
  IMPORT_JOB_STATUS_LABELS,
  IMPORT_SOURCE_TYPE_LABELS,
  IMPORT_TARGET_TYPE_LABELS,
} from "@uwe/database/server";
import type { ImportFormat } from "@uwe/knoteforge-import";
import {
  importCentralSourceAccept,
  isImportCentralComboSupported,
  isImportCentralSourceComingSoon,
  isImportCentralTargetComingSoon,
} from "@/src/lib/import-central-utils";
import { createImportCentralJobAction, rollbackImportCentralJobAction } from "../import-central-actions";
import { ImportWorkspace } from "../worlds/[worldSlug]/import/ImportWorkspace";

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

const JOB_STATUS_CLASS: Record<string, string> = {
  pending: "uwe-badge",
  preview: "uwe-badge uwe-badge-player",
  executing: "uwe-badge uwe-badge-player",
  completed: "uwe-badge uwe-badge-published",
  failed: "uwe-badge uwe-badge-secret",
  rolled_back: "uwe-badge uwe-badge-draft",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "medium" }).format(
    new Date(value),
  );
}

function readPreviewSummary(previewPayload: unknown): string | null {
  if (!previewPayload || typeof previewPayload !== "object" || Array.isArray(previewPayload)) {
    return null;
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

  const needsWorld = targetType === "world" || targetType === "dnd_page";
  const comboSupported = isImportCentralComboSupported(sourceType, targetType);
  const showComingSoon =
    isImportCentralSourceComingSoon(sourceType) || isImportCentralTargetComingSoon(targetType);
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

  return (
    <div className="uwe-import-workspace">
      <section className="uwe-panel">
        <h2>Neuer Import</h2>
        <p className="uwe-panel-intro">
          Wähle Quelle und Ziel und lege einen Import-Job an. Für KnoteForge/Markdown → Welt steht
          unten eine vereinfachte Upload-Oberfläche bereit; der vollständige Welt-Import bleibt über
          den Link erreichbar.
        </p>

        <div className="uwe-form-grid">
          <label>
            Quelle
            <select
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value as ImportSourceType)}
            >
              {(["knoteforge", "markdown", "obsidian", "pdf"] as ImportSourceType[]).map((entry) => (
                <option key={entry} value={entry}>
                  {IMPORT_SOURCE_TYPE_LABELS[entry]}
                  {isImportCentralSourceComingSoon(entry) ? " (demnächst)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            Ziel
            <select
              value={targetType}
              onChange={(event) => setTargetType(event.target.value as ImportTargetType)}
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
          </label>

          {needsWorld ? (
            <label>
              Welt
              <select
                value={targetWorldId}
                onChange={(event) => setTargetWorldId(event.target.value)}
                disabled={worlds.length === 0}
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
            </label>
          ) : null}
        </div>

        {showComingSoon ? (
          <p className="uwe-flash uwe-flash-warning">
            Diese Kombination ist in der Import-Zentrale noch nicht verfügbar — der Job wird
            angelegt, Vorschau und Import folgen in einer späteren Phase.
          </p>
        ) : null}

        {comboSupported ? (
          <label>
            Dateiname (optional)
            <input
              type="file"
              accept={importCentralSourceAccept(sourceType)}
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
            />
          </label>
        ) : null}

        <div className="uwe-form-actions">
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-primary"
            onClick={handleCreateJob}
            disabled={pending || (needsWorld && !targetWorldId)}
          >
            {pending ? "Wird angelegt…" : "Import-Job starten"}
          </button>
        </div>
      </section>

      {activeJob ? (
        <section className="uwe-panel">
          <h2>Aktiver Job</h2>
          <div className="uwe-import-summary">
            <span className={JOB_STATUS_CLASS[activeJob.status] ?? "uwe-badge"}>
              {IMPORT_JOB_STATUS_LABELS[activeJob.status as keyof typeof IMPORT_JOB_STATUS_LABELS] ??
                activeJob.status}
            </span>
            <span className="uwe-table-sub">
              {IMPORT_SOURCE_TYPE_LABELS[activeJob.sourceType]} →{" "}
              {IMPORT_TARGET_TYPE_LABELS[activeJob.targetType]}
              {activeJob.targetWorldName ? ` (${activeJob.targetWorldName})` : ""}
            </span>
          </div>

          {activeJob.sourceType === "knoteforge" &&
          activeJob.targetType === "world" &&
          activeJob.targetWorldSlug ? (
            <p className="uwe-panel-intro">
              Vollständiger Import:{" "}
              <Link href={`/worlds/${activeJob.targetWorldSlug}/import`}>
                Welt-Import öffnen
              </Link>
            </p>
          ) : null}

          {comboSupported && embedWorldSlug ? (
            <ImportWorkspace
              worldSlug={embedWorldSlug}
              supportedFormats={supportedFormats}
              plannedFormats={plannedFormats}
            />
          ) : (
            <p className="uwe-v2-empty">
              Für diese Quelle/Ziel-Kombination ist noch kein direkter Import implementiert.
            </p>
          )}
        </section>
      ) : null}

      {error ? <p className="uwe-flash uwe-flash-error">{error}</p> : null}

      <section className="uwe-panel">
        <h2>Import-Verlauf</h2>
        {jobs.length === 0 ? (
          <p className="uwe-v2-empty">Noch keine Import-Jobs.</p>
        ) : (
          <table className="uwe-page-table">
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Quelle</th>
                <th>Ziel</th>
                <th>Welt</th>
                <th>Status</th>
                <th>Details</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{formatDate(job.createdAt)}</td>
                  <td>{IMPORT_SOURCE_TYPE_LABELS[job.sourceType]}</td>
                  <td>{IMPORT_TARGET_TYPE_LABELS[job.targetType]}</td>
                  <td>{job.targetWorldName ?? "—"}</td>
                  <td>
                    <span className={JOB_STATUS_CLASS[job.status] ?? "uwe-badge"}>
                      {IMPORT_JOB_STATUS_LABELS[
                        job.status as keyof typeof IMPORT_JOB_STATUS_LABELS
                      ] ?? job.status}
                    </span>
                  </td>
                  <td>
                    {job.errorMessage ? (
                      <span className="uwe-table-sub">{job.errorMessage}</span>
                    ) : readResultSummary(job.resultSummary) ? (
                      readResultSummary(job.resultSummary)
                    ) : readPreviewSummary(job.previewPayload) ? (
                      readPreviewSummary(job.previewPayload)
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <div className="uwe-form-actions">
                      <button
                        type="button"
                        className="uwe-v2-btn"
                        onClick={() => setActiveJobId(job.id)}
                      >
                        Öffnen
                      </button>
                      {job.status === "completed" && job.undoToken ? (
                        <button
                          type="button"
                          className="uwe-v2-btn"
                          onClick={() => handleRollback(job.id)}
                          disabled={pending}
                        >
                          Zurückrollen
                        </button>
                      ) : null}
                      {job.sourceType === "knoteforge" &&
                      job.targetType === "world" &&
                      job.targetWorldSlug ? (
                        <Link
                          className="uwe-v2-btn"
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
        )}
      </section>
    </div>
  );
}
