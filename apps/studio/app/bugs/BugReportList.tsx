"use client";

import {
  deleteBugReportAction,
  updateBugReportSeverityAction,
  updateBugReportStatusAction,
} from "../bug-actions";
import {
  BugSeverityBadge,
  BugStatusBadge,
  BUG_SEVERITY_ORDER,
  BUG_STATUS_ORDER,
} from "./bug-badges";
import {
  BUG_REPORT_SEVERITY_LABELS,
  BUG_REPORT_STATUS_LABELS,
} from "./bug-constants";
import type { BugReportDto } from "./BugWorkspaceClient";

interface BugReportListProps {
  reports: BugReportDto[];
  selectedId: string | null;
  filterStatus?: string;
  filterSeverity?: string;
  onSelect: (id: string) => void;
}

export function BugReportList({
  reports,
  selectedId,
  filterStatus,
  filterSeverity,
  onSelect,
}: BugReportListProps) {
  return (
    <>
      <form method="get" action="/bugs" className="uwe-brain-create-form uwe-bug-filter-form">
        <label>
          Status
          <select name="status" defaultValue={filterStatus ?? ""}>
            <option value="">Alle</option>
            {BUG_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {BUG_REPORT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Schweregrad
          <select name="severity" defaultValue={filterSeverity ?? ""}>
            <option value="">Alle</option>
            {BUG_SEVERITY_ORDER.map((severity) => (
              <option key={severity} value={severity}>
                {BUG_REPORT_SEVERITY_LABELS[severity]}
              </option>
            ))}
          </select>
        </label>
        <div className="uwe-inline-actions">
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm">
            Filtern
          </button>
          {(filterStatus || filterSeverity) && (
            <a href="/bugs" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm">
              Zurücksetzen
            </a>
          )}
        </div>
      </form>

      {reports.length === 0 ? (
        <p className="uwe-dashboard-muted">Keine Bug-Meldungen für die aktuelle Filterung.</p>
      ) : (
        <ul className="uwe-idea-list">
          {reports.map((report) => (
            <li
              key={report.id}
              className={`uwe-idea-list-item${report.id === selectedId ? " is-active" : ""}`}
            >
              <button
                type="button"
                className="uwe-idea-list-select"
                aria-pressed={report.id === selectedId}
                onClick={() => onSelect(report.id)}
              >
                <span className="uwe-idea-list-title">{report.title}</span>
                <span className="uwe-bug-list-badges">
                  <BugSeverityBadge severity={report.severity} />
                  <BugStatusBadge status={report.status} />
                </span>
              </button>
              {report.module ? (
                <p className="uwe-dashboard-muted uwe-bug-list-module">{report.module}</p>
              ) : null}
              <div className="uwe-idea-list-actions">
                <form action={updateBugReportStatusAction} className="uwe-idea-status-form">
                  <input type="hidden" name="id" value={report.id} />
                  {filterStatus ? (
                    <input type="hidden" name="filterStatus" value={filterStatus} />
                  ) : null}
                  {filterSeverity ? (
                    <input type="hidden" name="filterSeverity" value={filterSeverity} />
                  ) : null}
                  <select name="status" defaultValue={report.status} aria-label="Status">
                    {BUG_STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>
                        {BUG_REPORT_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm">
                    Status
                  </button>
                </form>
                <form action={updateBugReportSeverityAction} className="uwe-idea-status-form">
                  <input type="hidden" name="id" value={report.id} />
                  {filterStatus ? (
                    <input type="hidden" name="filterStatus" value={filterStatus} />
                  ) : null}
                  {filterSeverity ? (
                    <input type="hidden" name="filterSeverity" value={filterSeverity} />
                  ) : null}
                  <select name="severity" defaultValue={report.severity} aria-label="Schweregrad">
                    {BUG_SEVERITY_ORDER.map((severity) => (
                      <option key={severity} value={severity}>
                        {BUG_REPORT_SEVERITY_LABELS[severity]}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm">
                    Schwere
                  </button>
                </form>
                <form action={deleteBugReportAction}>
                  <input type="hidden" name="id" value={report.id} />
                  {filterStatus ? (
                    <input type="hidden" name="filterStatus" value={filterStatus} />
                  ) : null}
                  {filterSeverity ? (
                    <input type="hidden" name="filterSeverity" value={filterSeverity} />
                  ) : null}
                  <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm">
                    Löschen
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
