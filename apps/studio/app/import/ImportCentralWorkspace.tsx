"use client";

import { ResponsiveTable } from "@uwe/shared-ui";
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
  isImportCampaignTarget,
  isImportCentralComboSupported,
  isImportCentralMarkdownTarget,
  isImportCentralObsidianSource,
  isImportCentralPdfSource,
  isImportCentralSourceComingSoon,
  isImportCentralTargetComingSoon,
} from "@/src/lib/import-central-utils";
import { createImportCentralJobAction, rollbackImportCentralJobAction } from "../import-central-actions";
import { ImportWorkspace } from "../worlds/[worldSlug]/import/ImportWorkspace";
import { CampaignPdfImportPanel } from "./CampaignPdfImportPanel";
import { DocImportPanel } from "./DocImportPanel";
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


/** Native select — fester, nicht-leerer Wertebereich, siehe Muster in UserManagementWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

interface WorldOption {
  id: string;
  name: string;
  slug: string;
  campaigns: { id: string; name: string; slug: string }[];
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
  previewSummary: string | null;
  resultLabel: string | null;
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
  const [campaignSlug, setCampaignSlug] = useState(worlds[0]?.campaigns[0]?.slug ?? "");
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
  const campaignTarget = isImportCampaignTarget(targetType);
  const embedWorldSlug = activeJob?.targetWorldSlug ?? selectedWorld?.slug ?? null;

  useEffect(() => {
    const campaigns = selectedWorld?.campaigns ?? [];
    if (!campaigns.some((campaign) => campaign.slug === campaignSlug)) {
      setCampaignSlug(campaigns[0]?.slug ?? "");
    }
  }, [campaignSlug, selectedWorld]);

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
        if (campaignTarget) {
          formData.set("campaignSlug", campaignSlug);
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
  }, [campaignSlug, campaignTarget, fileName, needsWorld, router, sourceType, targetType, targetWorldId]);

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

    // Markdown und Obsidian gehen über den Dokument-Import: er kennt den
    // deutschen Frontmatter-Dialekt, baut Seitenbäume und schreibt Beziehungen.
    // Der KnoteForge-Pfad darunter bleibt für JSON-Exporte zuständig.
    if (
      activeJob.targetType === "world" &&
      isImportCentralComboSupported(activeJob.sourceType, activeJob.targetType) &&
      activeJob.sourceType !== "knoteforge"
    ) {
      return (
        <DocImportPanel
          jobId={activeJob.id}
          isObsidianSource={isImportCentralObsidianSource(activeJob.sourceType)}
          fileAccept={importCentralSourceAccept(activeJob.sourceType)}
          onComplete={handleImportComplete}
        />
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

    if (
      isImportCampaignTarget(activeJob.targetType) &&
      isImportCentralPdfSource(activeJob.sourceType)
    ) {
      return <CampaignPdfImportPanel jobId={activeJob.id} onComplete={handleImportComplete} />;
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
            Vault-Ordner oder Vault-ZIP) und PDF können in Life Brain, Capture, DnD-Seiten oder Kampagnen
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
                {(["world", "personal_brain", "capture", "dnd_page", "campaign"] as ImportTargetType[]).map(
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

            {campaignTarget ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="import-central-campaign">Kampagne</Label>
                <select
                  id="import-central-campaign"
                  value={campaignSlug}
                  onChange={(event) => setCampaignSlug(event.target.value)}
                  disabled={!selectedWorld || selectedWorld.campaigns.length === 0}
                  className={NATIVE_SELECT_CLASS}
                >
                  {selectedWorld?.campaigns.length ? (
                    selectedWorld.campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.slug}>{campaign.name}</option>
                    ))
                  ) : (
                    <option value="">Keine Kampagnen vorhanden</option>
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
          {campaignTarget && selectedWorld?.campaigns.length === 0 ? (
            <Alert tone="warning">Erst eine Kampagne in der Welt anlegen.</Alert>
          ) : null}

          <Button
            type="button"
            onClick={handleCreateJob}
            disabled={
              pending || (needsWorld && !targetWorldId) || (campaignTarget && !campaignSlug) || !comboSupported
            }
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
          <ResponsiveTable
            caption="Import-Verlauf"
            rowKey={(job) => job.id}
            rows={jobs}
            columns={[
              {
                key: "source",
                label: "Quelle",
                primary: true,
                render: (job) => IMPORT_SOURCE_TYPE_LABELS[job.sourceType],
              },
              {
                key: "status",
                label: "Status",
                render: (job) => (
                  <Badge variant={jobStatusVariant(job.status)}>
                    {IMPORT_JOB_STATUS_LABELS[
                      job.status as keyof typeof IMPORT_JOB_STATUS_LABELS
                    ] ?? job.status}
                  </Badge>
                ),
              },
              {
                key: "target",
                label: "Ziel",
                render: (job) => IMPORT_TARGET_TYPE_LABELS[job.targetType],
              },
              { key: "world", label: "Welt", render: (job) => job.targetWorldName ?? "—" },
              { key: "time", label: "Zeit", render: (job) => formatDate(job.createdAt) },
              {
                key: "details",
                label: "Details",
                priority: "low",
                render: (job) =>
                  job.errorMessage ? (
                    <span className="text-xs text-muted-foreground">{job.errorMessage}</span>
                  ) : (
                    job.resultLabel ?? job.previewSummary ?? "—"
                  ),
              },
              {
                key: "actions",
                label: "Aktionen",
                render: (job) => (
                  <span className="flex flex-wrap gap-2">
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
                  </span>
                ),
              },
            ]}
            empty={<p className="text-sm text-muted-foreground">Noch keine Import-Jobs.</p>}
          />
        </CardContent>
      </Card>
    </div>
  );
}
