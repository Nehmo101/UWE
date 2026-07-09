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
    <div className="uwe-v2-dashboard-grid" data-columns="2">
      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Bug-Meldungen ({reports.length})</h2>
        <BugReportForm filterStatus={filterStatus} filterSeverity={filterSeverity} />
        <BugReportList
          reports={reports}
          selectedId={selectedId}
          filterStatus={filterStatus}
          filterSeverity={filterSeverity}
          onSelect={setSelectedId}
        />
      </section>

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
      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Details</h2>
        <p className="uwe-dashboard-muted">Wähle links eine Bug-Meldung aus.</p>
      </section>
    );
  }

  const createdAt = new Date(report.createdAt).toLocaleString("de-DE");
  const updatedAt = new Date(report.updatedAt).toLocaleString("de-DE");

  return (
    <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
      <h2 className="uwe-v2-section-title">Details</h2>

      <div className="uwe-idea-detail">
        <div className="uwe-idea-detail-head">
          <h3 className="uwe-idea-detail-title">{report.title}</h3>
          <span className="uwe-bug-list-badges">
            <BugSeverityBadge severity={report.severity} />
            <BugStatusBadge status={report.status} />
          </span>
        </div>

        {report.module ? (
          <p className="uwe-dashboard-muted">
            Modul: <strong>{report.module}</strong>
          </p>
        ) : null}

        {report.githubIssueUrl ? (
          <p className="uwe-dashboard-muted">
            GitHub:{" "}
            <Link href={report.githubIssueUrl} target="_blank" rel="noreferrer">
              Issue öffnen
            </Link>
          </p>
        ) : (
          <CreateBugGithubIssueButton reportId={report.id} githubIssueSync={githubIssueSync} />
        )}

        {report.description ? (
          <p className="uwe-idea-detail-body">{report.description}</p>
        ) : (
          <p className="uwe-dashboard-muted">Keine Beschreibung.</p>
        )}

        {report.screenshotAssetId ? (
          <div className="uwe-bug-screenshot">
            <p className="uwe-dashboard-muted">
              Screenshot:{" "}
              <Link href={`/api/assets/${report.screenshotAssetId}/file`} target="_blank">
                Asset anzeigen
              </Link>
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/assets/${report.screenshotAssetId}/file`}
              alt="Bug-Screenshot"
              className="uwe-bug-screenshot-image"
            />
          </div>
        ) : null}

        <p className="uwe-dashboard-muted">
          Erstellt: {createdAt}
          <br />
          Aktualisiert: {updatedAt}
        </p>
      </div>

      <form action={updateBugReportAction} className="uwe-brain-create-form">
        <input type="hidden" name="id" value={report.id} />
        {filterStatus ? <input type="hidden" name="filterStatus" value={filterStatus} /> : null}
        {filterSeverity ? (
          <input type="hidden" name="filterSeverity" value={filterSeverity} />
        ) : null}
        <label>
          Titel
          <input name="title" defaultValue={report.title} required />
        </label>
        <label>
          Beschreibung
          <textarea name="description" rows={6} defaultValue={report.description} />
        </label>
        <label>
          Schweregrad
          <select name="severity" defaultValue={report.severity}>
            {BUG_SEVERITY_ORDER.map((severity) => (
              <option key={severity} value={severity}>
                {BUG_REPORT_SEVERITY_LABELS[severity]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Modul / Bereich
          <input name="module" defaultValue={report.module ?? ""} />
        </label>
        <label>
          GitHub Issue
          <input
            name="githubIssueUrl"
            type="url"
            defaultValue={report.githubIssueUrl ?? ""}
            placeholder="https://github.com/owner/repo/issues/123"
          />
        </label>
        <BugScreenshotUpload initialAssetId={report.screenshotAssetId} />
        <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
          Speichern
        </button>
      </form>
    </section>
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
    ? "GITHUB_TOKEN oder AGENT_JOBS_GITHUB_TOKEN fehlt."
    : !githubIssueSync.githubRepo
      ? "AGENT_JOBS_GITHUB_REPO fehlt (Format: owner/repo)."
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
    <div className="uwe-bug-github-sync">
      <button
        type="button"
        className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
        onClick={() => void createIssue()}
        disabled={disabled}
        title={title}
      >
        {busy ? "Erstellt GitHub-Issue…" : "Als GitHub-Issue erstellen"}
      </button>
      {!ready ? (
        <p className="uwe-hint">
          GitHub-Sync nicht konfiguriert — setze{" "}
          <code>AGENT_JOBS_GITHUB_REPO=owner/repo</code> und einen Server-Token (
          <code>GITHUB_TOKEN</code> oder <code>AGENT_JOBS_GITHUB_TOKEN</code>).{" "}
          <Link href="/admin/agent-jobs">Agent Jobs</Link>
        </p>
      ) : null}
      {error ? <p className="uwe-hint uwe-hint-error">{error}</p> : null}
    </div>
  );
}
