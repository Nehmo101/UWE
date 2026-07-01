"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  createdAt: string;
  updatedAt: string;
}

interface BugWorkspaceClientProps {
  reports: BugReportDto[];
  initialSelectedId: string | null;
  filterStatus?: string;
  filterSeverity?: string;
}

export function BugWorkspaceClient({
  reports: initialReports,
  initialSelectedId,
  filterStatus,
  filterSeverity,
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
      />
    </div>
  );
}

function BugDetailPanel({
  report,
  filterStatus,
  filterSeverity,
}: {
  report: BugReportDto | null;
  filterStatus?: string;
  filterSeverity?: string;
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
        <BugScreenshotUpload initialAssetId={report.screenshotAssetId} />
        <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
          Speichern
        </button>
      </form>
    </section>
  );
}
