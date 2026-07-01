import {
  BUG_REPORT_SEVERITY_LABELS,
  BUG_REPORT_STATUS_LABELS,
  type BugReportSeverity,
  type BugReportStatus,
} from "./bug-constants";

export function bugStatusBadgeClass(status: BugReportStatus): string {
  switch (status) {
    case "resolved":
      return "uwe-badge uwe-badge-success";
    case "wont_fix":
      return "uwe-badge uwe-badge-draft";
    case "in_progress":
      return "uwe-badge uwe-badge-warning";
    default:
      return "uwe-badge uwe-badge-danger";
  }
}

export function bugSeverityBadgeClass(severity: BugReportSeverity): string {
  switch (severity) {
    case "critical":
      return "uwe-badge uwe-badge-danger";
    case "high":
      return "uwe-badge uwe-badge-warning";
    case "low":
      return "uwe-badge uwe-badge-type";
    default:
      return "uwe-badge";
  }
}

export function BugStatusBadge({ status }: { status: BugReportStatus }) {
  return (
    <span className={bugStatusBadgeClass(status)}>{BUG_REPORT_STATUS_LABELS[status]}</span>
  );
}

export function BugSeverityBadge({ severity }: { severity: BugReportSeverity }) {
  return (
    <span className={bugSeverityBadgeClass(severity)}>
      {BUG_REPORT_SEVERITY_LABELS[severity]}
    </span>
  );
}

export { BUG_STATUS_ORDER, BUG_SEVERITY_ORDER } from "./bug-constants";
