import type { DashboardWidgetConfig } from "@uwe/database/dashboard-layout";
import type { TodayDashboardData } from "@/src/lib/today-dashboard";

export function isTodayDashboardAllClear(
  data: TodayDashboardData,
  widgets: DashboardWidgetConfig[],
): boolean {
  const visible = new Set(
    widgets.filter((widget) => widget.visible).map((widget) => widget.widgetType),
  );

  if (visible.has("capture-inbox") && data.lifeAdmin.inboxCaptureCount > 0) return false;
  if (visible.has("agenda") && data.calendarToday.length > 0) return false;
  if (visible.has("contracts") && data.lifeAdmin.contractAlerts.length > 0) return false;
  if (visible.has("household") && (data.household.overdueCount > 0 || data.household.soonCount > 0)) {
    return false;
  }
  if (visible.has("prioritized-mail") && data.prioritizedMail.actionableCount > 0) return false;
  if (visible.has("homelab") && data.homelab.alerts.criticalCount > 0) return false;
  if (visible.has("jobs-queue") && data.jobs.failedCount > 0) return false;
  if (data.mailSummary.recentFailed > 0) return false;

  return true;
}
