export type BugReportStatus = "open" | "in_progress" | "resolved" | "wont_fix";
export type BugReportSeverity = "low" | "medium" | "high" | "critical";

export const BUG_REPORT_STATUS_LABELS: Record<BugReportStatus, string> = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  resolved: "Behoben",
  wont_fix: "Wird nicht behoben",
};

export const BUG_REPORT_SEVERITY_LABELS: Record<BugReportSeverity, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  critical: "Kritisch",
};

export const BUG_STATUS_ORDER: BugReportStatus[] = ["open", "in_progress", "resolved", "wont_fix"];

export const BUG_SEVERITY_ORDER: BugReportSeverity[] = ["low", "medium", "high", "critical"];
