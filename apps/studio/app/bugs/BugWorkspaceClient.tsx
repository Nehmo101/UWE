"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { updateBugReportAction } from "../bug-actions";
import { BugReportForm } from "./BugReportForm";
import { BugScreenshotUpload } from "./BugScreenshotUpload";
import { BugReportList } from "./BugReportList";
import {
  BugSeverityBadge,
  BugStatusBadge,
  BUG_SEVERITY_ORDER,
} from "./bug-badges";
import { BUG_REPORT_SEVERITY_LABELS, type BugReportSeverity, type BugReportStatus } from "./bug-constants";
import {
  Alert,
  Button,
  Card,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";

export interface BugReportDto {
  id: string;
  title: string;
  description: string;
  status: BugReportStatus;
  severity: BugReportSeverity;
  module: string | null;
  screenshotAssetId: string | null;
  reporterUserId: string | null;
  githubIssueUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BugGithubIssueSyncConfig {
  canCreate: boolean;
  tokenConfigured: boolean;
  githubRepo: string | null;
}

interface BugWorkspaceClientProps {
  reports: BugReportDto[];
  initialSelectedId: string | null;
  filterStatus?: string;
  filterSeverity?: string;
  githubIssueSync: BugGithubIssueSyncConfig;
}

export function BugWorkspaceClient({
  reports: initialReports,
  initialSelectedId,
  filterStatus,
  filterSeverity,
  githubIssueSync,
}: BugWorkspaceClientProps) {
  const [reports, setReports] = useState(initialReports);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? initialReports[0]?.id ?? null,
  );

  useEffect(() => {
    setReports(initialReports);
  }, [initialReports]);

  useEffect(() => {
    setSelectedId(initialSelectedId ?? initialReports[0]?.id ?? null);
  }, [initialSelectedId, initialReports]);

  const selected = useMemo(
    () => reports.find((report) => report.id === selectedId) ?? null,
    [reports, selectedId],
  );

  return (
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2" data-columns="2">
      <Card className="flex flex-col gap-4 p-4">
        <h2 className="text-base font-semibold tracking-tight">Bug-Meldungen ({reports.length})</h2>
        <BugReportForm filterStatus={filterStatus} filterSeverity={filterSeverity} />
        <BugReportList
          reports={reports}
          selectedId={selectedId}
          filterStatus={filterStatus}
          filterSeverity={filterSeverity}
          onSelect={setSelectedId}
        />
      </Card>

      <BugDetailPanel
        report={selected}
        filterStatus={filterStatus}
        filterSeverity={filterSeverity}
        githubIssueSync={githubIssueSync}
      />
    </div>
  );
}

function BugDetailPanel({
  report,
  filterStatus,
  filterSeverity,
  githubIssueSync,
}: {
  report: BugReportDto | null;
  filterStatus?: string;
  filterSeverity?: string;
  githubIssueSync: BugGithubIssueSyncConfig;
}) {
  if (!report) {
    return (
      <Card className="flex flex-col gap-4 p-4">
        <h2 className="text-base font-semibold tracking-tight">Details</h2>
        <p className="text-sm text-muted-foreground">Wähle links eine Bug-Meldung aus.</p>
      </Card>
    );
  }

  const createdAt = new Date(report.createdAt).toLocaleString("de-DE");
  const updatedAt = new Date(report.updatedAt).toLocaleString("de-DE");

  return (
    <Card className="flex flex-col gap-4 p-4">
      <h2 className="text-base font-semibold tracking-tight">Details</h2>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">{report.title}</h3>
          <span className="flex flex-wrap items-center gap-1.5">
            <BugSeverityBadge severity={report.severity} />
            <BugStatusBadge status={report.status} />
          </span>
        </div>

        {report.module ? (
          <p className="text-sm text-muted-foreground">
            Modul: <strong>{report.module}</strong>
          </p>
        ) : null}

        {report.githubIssueUrl ? (
          <p className="text-sm text-muted-foreground">
            GitHub:{" "}
            <Link href={report.githubIssueUrl} target="_blank" rel="noreferrer">
              Issue öffnen
            </Link>
          </p>
        ) : (
          <CreateBugGithubIssueButton reportId={report.id} githubIssueSync={githubIssueSync} />
        )}

        {report.description ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{report.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Keine Beschreibung.</p>
        )}

        {report.screenshotAssetId ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Screenshot:{" "}
              <Link href={`/api/assets/${report.screenshotAssetId}/file`} target="_blank">
                Asset anzeigen
              </Link>
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/assets/${report.screenshotAssetId}/file`}
              alt="Bug-Screenshot"
              className="block max-h-80 max-w-full rounded-[var(--radius)] border border-border"
            />
          </div>
        ) : null}

        <p className="text-sm text-muted-foreground">
          Erstellt: {createdAt}
          <br />
          Aktualisiert: {updatedAt}
        </p>
      </div>

      <form
        action={updateBugReportAction}
        className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4"
      >
        <input type="hidden" name="id" value={report.id} />
        {filterStatus ? <input type="hidden" name="filterStatus" value={filterStatus} /> : null}
        {filterSeverity ? (
          <input type="hidden" name="filterSeverity" value={filterSeverity} />
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bug-edit-title">Titel</Label>
          <Input id="bug-edit-title" name="title" defaultValue={report.title} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bug-edit-description">Beschreibung</Label>
          <Textarea id="bug-edit-description" name="description" rows={6} defaultValue={report.description} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bug-edit-severity">Schweregrad</Label>
          <Select name="severity" defaultValue={report.severity}>
            <SelectTrigger id="bug-edit-severity" aria-label="Schweregrad">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUG_SEVERITY_ORDER.map((severity) => (
                <SelectItem key={severity} value={severity}>
                  {BUG_REPORT_SEVERITY_LABELS[severity]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bug-edit-module">Modul / Bereich</Label>
          <Input id="bug-edit-module" name="module" defaultValue={report.module ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bug-edit-github">GitHub Issue</Label>
          <Input
            id="bug-edit-github"
            name="githubIssueUrl"
            type="url"
            defaultValue={report.githubIssueUrl ?? ""}
            placeholder="https://github.com/owner/repo/issues/123"
          />
        </div>
        <BugScreenshotUpload initialAssetId={report.screenshotAssetId} />
        <Button type="submit" variant="secondary" size="sm">
          Speichern
        </Button>
      </form>
    </Card>
  );
}

function CreateBugGithubIssueButton({
  reportId,
  githubIssueSync,
}: {
  reportId: string;
  githubIssueSync: BugGithubIssueSyncConfig;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!githubIssueSync.canCreate) {
    return null;
  }

  const ready = githubIssueSync.tokenConfigured && Boolean(githubIssueSync.githubRepo);
  const disabled = busy || !ready;

  const title = !githubIssueSync.tokenConfigured
    ? "GITHUB_TOKEN oder GITHUB_ISSUE_TOKEN fehlt."
    : !githubIssueSync.githubRepo
      ? "GITHUB_ISSUE_REPO fehlt (Format: owner/repo)."
      : undefined;

  async function createIssue() {
    if (disabled) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(studioApiUrl(`/api/bugs/${reportId}/github-issue`), {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as { githubIssueUrl?: string; error?: string };
      if (!response.ok || !payload.githubIssueUrl) {
        throw new Error(payload.error ?? "GitHub-Issue konnte nicht erstellt werden.");
      }
      router.refresh();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "GitHub-Issue konnte nicht erstellt werden.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => void createIssue()}
        disabled={disabled}
        title={title}
      >
        {busy ? "Erstellt GitHub-Issue…" : "Als GitHub-Issue erstellen"}
      </Button>
      {!ready ? (
        <p className="text-sm text-muted-foreground">
          GitHub-Sync nicht konfiguriert — setze{" "}
          <code>GITHUB_ISSUE_REPO=owner/repo</code> und einen Server-Token (
          <code>GITHUB_TOKEN</code> oder <code>GITHUB_ISSUE_TOKEN</code>).
        </p>
      ) : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
