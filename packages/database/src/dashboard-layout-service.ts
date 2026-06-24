import type { PrismaClient } from "./client";
import { createPrismaClient } from "./client";
import {
  getDefaultDashboardLayout,
  normalizeDashboardWidgets,
  parseDashboardWidgets,
  validateDashboardWidgets,
  type DashboardLayoutResult,
  type DashboardWidgetConfig,
} from "./dashboard-layout-types";

export {
  DEFAULT_PORTAL_WORLD_LAYOUT,
  DEFAULT_STUDIO_TODAY_LAYOUT,
  getDefaultDashboardLayout,
  normalizeDashboardWidgets,
  parseDashboardWidgets,
  portalWorldPageKey,
  STUDIO_TODAY_PAGE_KEY,
  STUDIO_TODAY_WIDGET_TYPES,
  PORTAL_WORLD_WIDGET_TYPES,
  validateDashboardWidgets,
  type DashboardLayoutResult,
  type DashboardWidgetColumn,
  type DashboardWidgetConfig,
  type PortalWorldWidgetType,
  type StudioTodayWidgetType,
} from "./dashboard-layout-types";

export function createDashboardLayoutService(db: PrismaClient = createPrismaClient()) {
  return {
    async getDashboardLayout(userId: string, pageKey: string): Promise<DashboardLayoutResult> {
      const row = await db.dashboardLayout.findUnique({
        where: { userId_pageKey: { userId, pageKey } },
      });

      if (!row) {
        return {
          pageKey,
          widgets: getDefaultDashboardLayout(pageKey),
          isDefault: true,
        };
      }

      const parsed = parseDashboardWidgets(row.widgets);
      if (!parsed) {
        return {
          pageKey,
          widgets: getDefaultDashboardLayout(pageKey),
          isDefault: true,
        };
      }

      return {
        pageKey,
        widgets: normalizeDashboardWidgets(parsed),
        isDefault: false,
      };
    },

    async saveDashboardLayout(
      userId: string,
      pageKey: string,
      widgets: DashboardWidgetConfig[],
    ): Promise<DashboardLayoutResult> {
      const validation = validateDashboardWidgets(pageKey, widgets);
      if (!validation.ok) {
        throw new Error(validation.error);
      }

      const payload = JSON.stringify(validation.widgets);
      await db.dashboardLayout.upsert({
        where: { userId_pageKey: { userId, pageKey } },
        create: {
          userId,
          pageKey,
          widgets: payload,
        },
        update: {
          widgets: payload,
        },
      });

      return {
        pageKey,
        widgets: validation.widgets,
        isDefault: false,
      };
    },
  };
}

export type DashboardLayoutService = ReturnType<typeof createDashboardLayoutService>;
