export type DashboardWidgetColumn = 1 | 2 | 3;

export interface DashboardWidgetConfig {
  id: string;
  widgetType: string;
  order: number;
  column: DashboardWidgetColumn;
  visible: boolean;
}

export interface DashboardLayoutResult {
  pageKey: string;
  widgets: DashboardWidgetConfig[];
  isDefault: boolean;
}

export const STUDIO_TODAY_PAGE_KEY = "studio:today";
export const STUDIO_DASHBOARD_PAGE_KEY = "studio:dashboard";

export const STUDIO_TODAY_WIDGET_TYPES = [
  "system-ampel",
  "dnd-favorite",
  "capture-inbox",
  "projects",
  "contracts",
  "homelab",
  "agenda",
  "prioritized-mail",
  "household",
  "jobs-queue",
  "projects-by-domain",
] as const;

export type StudioTodayWidgetType = (typeof STUDIO_TODAY_WIDGET_TYPES)[number];

export const STUDIO_TODAY_WIDGET_LABELS: Record<StudioTodayWidgetType, string> = {
  "system-ampel": "System-Ampel",
  "dnd-favorite": "DnD / Welten",
  "capture-inbox": "Capture Inbox",
  projects: "Projekte",
  contracts: "Verträge & Ausgaben",
  homelab: "Hardware / Homelab",
  agenda: "Was steht heute an",
  "prioritized-mail": "Wichtige Mails",
  household: "Haushalt & Vorräte",
  "jobs-queue": "Automatisierung",
  "projects-by-domain": "Projekte nach Domäne",
};

export const STUDIO_DASHBOARD_WIDGET_TYPES = [
  "stats",
  "next-actions",
  "activity-log",
  "recent-pages",
  "worlds",
] as const;

export type StudioDashboardWidgetType = (typeof STUDIO_DASHBOARD_WIDGET_TYPES)[number];

export const STUDIO_WORLD_DASHBOARD_WIDGET_TYPES = [
  "next-session",
  "open-plots",
  "wiki-pages",
  "portal-sharing",
  "media-assets",
  "ai-brain",
  "recent-pages",
  // Weltuhr + jüngste Chronik: der welt-weite Rest des aufgelösten Radars.
  "world-clock",
] as const;

export type StudioWorldDashboardWidgetType = (typeof STUDIO_WORLD_DASHBOARD_WIDGET_TYPES)[number];

export const PORTAL_WORLD_WIDGET_TYPES = [
  "next-session",
  "last-recap",
  "open-quests",
  "known-npcs",
  "known-places",
  "new-handouts",
  "my-notes",
  "character-pages",
] as const;

export type PortalWorldWidgetType = (typeof PORTAL_WORLD_WIDGET_TYPES)[number];

export function portalWorldPageKey(worldSlug: string): string {
  return `portal:world:${worldSlug}`;
}

export function studioWorldDashboardPageKey(worldSlug: string): string {
  return `studio:world:${worldSlug}:dashboard`;
}

function widget(
  id: string,
  widgetType: string,
  order: number,
  column: DashboardWidgetColumn,
  visible = true,
): DashboardWidgetConfig {
  return { id, widgetType, order, column, visible };
}

export const DEFAULT_STUDIO_TODAY_LAYOUT: DashboardWidgetConfig[] = [
  widget("system-ampel", "system-ampel", 0, 1),
  widget("agenda", "agenda", 1, 1),
  widget("contracts", "contracts", 2, 1),
  widget("dnd-favorite", "dnd-favorite", 0, 2),
  widget("prioritized-mail", "prioritized-mail", 1, 2),
  widget("projects", "projects", 2, 2),
  widget("projects-by-domain", "projects-by-domain", 3, 2),
  widget("capture-inbox", "capture-inbox", 0, 3),
  widget("household", "household", 1, 3),
  widget("jobs-queue", "jobs-queue", 2, 3),
  widget("homelab", "homelab", 3, 3),
];

export const DEFAULT_STUDIO_DASHBOARD_LAYOUT: DashboardWidgetConfig[] = [
  widget("stats", "stats", 0, 1),
  widget("next-actions", "next-actions", 0, 2),
  widget("activity-log", "activity-log", 0, 3),
  widget("recent-pages", "recent-pages", 1, 2),
  widget("worlds", "worlds", 1, 3),
];

export const DEFAULT_STUDIO_WORLD_DASHBOARD_LAYOUT: DashboardWidgetConfig[] = [
  widget("next-session", "next-session", 0, 1),
  widget("open-plots", "open-plots", 0, 2),
  widget("recent-pages", "recent-pages", 0, 3),
  widget("world-clock", "world-clock", 1, 1),
  widget("wiki-pages", "wiki-pages", 2, 1, false),
  widget("portal-sharing", "portal-sharing", 1, 2, false),
  widget("media-assets", "media-assets", 1, 3, false),
  widget("ai-brain", "ai-brain", 2, 1, false),
];

export const DEFAULT_PORTAL_WORLD_LAYOUT: DashboardWidgetConfig[] = [
  widget("next-session", "next-session", 0, 1),
  widget("last-recap", "last-recap", 1, 1),
  widget("open-quests", "open-quests", 0, 2),
  widget("known-npcs", "known-npcs", 1, 2),
  widget("known-places", "known-places", 0, 3),
  widget("new-handouts", "new-handouts", 1, 3),
  widget("my-notes", "my-notes", 2, 1),
  widget("character-pages", "character-pages", 2, 2),
];

export function getDefaultDashboardLayout(pageKey: string): DashboardWidgetConfig[] {
  if (pageKey === STUDIO_TODAY_PAGE_KEY) {
    return DEFAULT_STUDIO_TODAY_LAYOUT.map((entry) => ({ ...entry }));
  }

  if (pageKey === STUDIO_DASHBOARD_PAGE_KEY) {
    return DEFAULT_STUDIO_DASHBOARD_LAYOUT.map((entry) => ({ ...entry }));
  }

  if (pageKey.startsWith("studio:world:") && pageKey.endsWith(":dashboard")) {
    return DEFAULT_STUDIO_WORLD_DASHBOARD_LAYOUT.map((entry) => ({ ...entry }));
  }

  if (pageKey.startsWith("portal:world:")) {
    return DEFAULT_PORTAL_WORLD_LAYOUT.map((entry) => ({ ...entry }));
  }

  return [];
}

/**
 * Neue Default-Widgets in ein gespeichertes Layout einmischen: Default-Widgets,
 * deren `widgetType` im Layout noch gar nicht vorkommt, werden angehängt. So
 * sehen Bestandsnutzer nach einem Update neue Widgets, ohne dass ihre Anordnung
 * verworfen wird. Absichtlich ausgeblendete Widgets bleiben ausgeblendet (ihr
 * Typ ist ja weiterhin vorhanden). Nicht-destruktiv — persistiert nichts.
 */
export function mergeMissingDefaultWidgets(
  pageKey: string,
  widgets: DashboardWidgetConfig[],
): DashboardWidgetConfig[] {
  const defaults = getDefaultDashboardLayout(pageKey);
  const presentTypes = new Set(widgets.map((entry) => entry.widgetType));
  const presentIds = new Set(widgets.map((entry) => entry.id));
  const merged = [...widgets];

  for (const addition of defaults) {
    if (presentTypes.has(addition.widgetType)) {
      continue;
    }
    const id = presentIds.has(addition.id) ? `${addition.id}-${addition.widgetType}` : addition.id;
    presentIds.add(id);
    merged.push({ ...addition, id });
  }

  return normalizeDashboardWidgets(merged);
}

function isWidgetColumn(value: unknown): value is DashboardWidgetColumn {
  return value === 1 || value === 2 || value === 3;
}

export function parseDashboardWidgets(raw: string): DashboardWidgetConfig[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    const widgets: DashboardWidgetConfig[] = [];
    for (const entry of parsed) {
      if (
        typeof entry !== "object" ||
        entry === null ||
        typeof (entry as DashboardWidgetConfig).id !== "string" ||
        typeof (entry as DashboardWidgetConfig).widgetType !== "string" ||
        typeof (entry as DashboardWidgetConfig).order !== "number" ||
        !Number.isFinite((entry as DashboardWidgetConfig).order) ||
        !isWidgetColumn((entry as DashboardWidgetConfig).column) ||
        typeof (entry as DashboardWidgetConfig).visible !== "boolean"
      ) {
        return null;
      }

      widgets.push({
        id: (entry as DashboardWidgetConfig).id,
        widgetType: (entry as DashboardWidgetConfig).widgetType,
        order: (entry as DashboardWidgetConfig).order,
        column: (entry as DashboardWidgetConfig).column,
        visible: (entry as DashboardWidgetConfig).visible,
      });
    }

    return widgets;
  } catch {
    return null;
  }
}

export function normalizeDashboardWidgets(widgets: DashboardWidgetConfig[]): DashboardWidgetConfig[] {
  const byColumn = new Map<DashboardWidgetColumn, DashboardWidgetConfig[]>();
  for (const column of [1, 2, 3] as const) {
    byColumn.set(column, []);
  }

  for (const widgetConfig of widgets) {
    const column = isWidgetColumn(widgetConfig.column) ? widgetConfig.column : 1;
    byColumn.get(column)!.push({ ...widgetConfig, column });
  }

  const normalized: DashboardWidgetConfig[] = [];
  for (const column of [1, 2, 3] as const) {
    const columnWidgets = byColumn
      .get(column)!
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
    columnWidgets.forEach((entry, index) => {
      normalized.push({ ...entry, column, order: index });
    });
  }

  return normalized;
}

export function validateDashboardWidgets(
  pageKey: string,
  widgets: DashboardWidgetConfig[],
): { ok: true; widgets: DashboardWidgetConfig[] } | { ok: false; error: string } {
  if (widgets.length === 0) {
    return { ok: false, error: "Mindestens ein Widget erforderlich." };
  }

  const allowedTypes = new Set<string>(
    pageKey === STUDIO_TODAY_PAGE_KEY
      ? STUDIO_TODAY_WIDGET_TYPES
      : pageKey === STUDIO_DASHBOARD_PAGE_KEY
        ? STUDIO_DASHBOARD_WIDGET_TYPES
        : pageKey.startsWith("studio:world:") && pageKey.endsWith(":dashboard")
          ? STUDIO_WORLD_DASHBOARD_WIDGET_TYPES
          : pageKey.startsWith("portal:world:")
            ? PORTAL_WORLD_WIDGET_TYPES
            : [],
  );

  if (allowedTypes.size === 0) {
    return { ok: false, error: "Unbekannter pageKey." };
  }

  const seenIds = new Set<string>();
  for (const entry of widgets) {
    if (!entry.id.trim() || !entry.widgetType.trim()) {
      return { ok: false, error: "Widget id und widgetType dürfen nicht leer sein." };
    }
    if (seenIds.has(entry.id)) {
      return { ok: false, error: `Doppelte Widget-ID: ${entry.id}` };
    }
    seenIds.add(entry.id);
    if (!allowedTypes.has(entry.widgetType)) {
      return { ok: false, error: `Unbekannter Widget-Typ: ${entry.widgetType}` };
    }
    if (!isWidgetColumn(entry.column)) {
      return { ok: false, error: `Ungültige Spalte für Widget ${entry.id}.` };
    }
  }

  return { ok: true, widgets: normalizeDashboardWidgets(widgets) };
}
