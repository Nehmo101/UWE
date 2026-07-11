import { Badge, type BadgeProps } from "@/src/components/ui";
import {
  BUG_REPORT_SEVERITY_LABELS,
  BUG_REPORT_STATUS_LABELS,
  type BugReportSeverity,
  type BugReportStatus,
} from "./bug-constants";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

export function bugStatusBadgeVariant(status: BugReportStatus): BadgeVariant {
  switch (status) {
    case "resolved":
      return "success";
    // TODO(design-kit): Kit-Badge hat keine eigene "draft"-Tonalität — "secondary" hält
    // "wont_fix" von "in_progress" (warning) unterscheidbar.
    case "wont_fix":
      return "secondary";
    case "in_progress":
      return "warning";
    default:
      return "danger";
  }
}

export function bugSeverityBadgeVariant(severity: BugReportSeverity): BadgeVariant {
  switch (severity) {
    case "critical":
      return "danger";
    case "high":
      return "warning";
    case "low":
      return "default";
    default:
      return "default";
  }
}

export function BugStatusBadge({ status }: { status: BugReportStatus }) {
  return <Badge variant={bugStatusBadgeVariant(status)}>{BUG_REPORT_STATUS_LABELS[status]}</Badge>;
}

export function BugSeverityBadge({ severity }: { severity: BugReportSeverity }) {
  return (
    <Badge variant={bugSeverityBadgeVariant(severity)}>{BUG_REPORT_SEVERITY_LABELS[severity]}</Badge>
  );
}

export { BUG_STATUS_ORDER, BUG_SEVERITY_ORDER } from "./bug-constants";
