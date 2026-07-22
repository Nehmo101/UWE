import type { PrismaClient } from "./client";
import type { BrainPrismaClient } from "./brain-client";
import type { CalendarEvent, CalendarEventKind, CalendarFeed } from "./generated/prisma-brain/client";
import { buildContractAlerts } from "./contract-expense-utils";
import { createCalendarService } from "./calendar-service";

export type CalendarItemSource =
  | "calendar_event"
  | "session_prep"
  | "contract"
  | "workshop"
  | "hardware"
  | "backup"
  | "personal_project"
  | "maintenance_task";

export type CalendarItemUrgency = "today" | "upcoming" | "overdue";

export interface AggregatedCalendarItem {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  source: CalendarItemSource;
  kind: CalendarEventKind | "contract" | "maintenance" | "backup" | "workshop_deadline";
  moduleLabel: string;
  href: string | null;
  urgency: CalendarItemUrgency;
}

export type CalendarEventWithFeed = CalendarEvent & {
  feed?: Pick<CalendarFeed, "name" | "type"> | null;
};

export interface CalendarAggregationInput {
  events: CalendarEventWithFeed[];
  contractAlerts: ReturnType<typeof buildContractAlerts>;
  workshops: Array<{ id: string; title: string; metadata: unknown; nextActionDate?: Date | null }>;
  hardware: Array<{ id: string; name: string; metadata: unknown }>;
  personalProjects: Array<{ id: string; name: string; metadata: unknown; nextActionDate?: Date | null }>;
  maintenanceTasks?: Array<{
    id: string;
    title: string;
    nextDueAt: Date | null;
    category?: string | null;
  }>;
  sessions: Array<{
    id: string;
    title: string;
    sessionNumber: number;
    date: Date | null;
    status: string;
    worldSlug?: string | null;
  }>;
  lastBackupAt: Date | null;
  now?: Date;
  horizonDays?: number;
}

const MS_PER_DAY = 86_400_000;
export const BACKUP_CHECK_INTERVAL_DAYS = 7;
export const SESSION_PREP_LEAD_DAYS = 3;

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function endOfWeek(date: Date): Date {
  const copy = startOfDay(date);
  const day = copy.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  copy.setDate(copy.getDate() + daysUntilSunday);
  return endOfDay(copy);
}

export function readMetadataDate(metadata: unknown, keys: string[]): Date | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  for (const key of keys) {
    const raw = (metadata as Record<string, unknown>)[key];
    if (typeof raw === "string" || typeof raw === "number") {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  return null;
}

export function classifyUrgency(
  date: Date,
  now: Date = new Date(),
): CalendarItemUrgency {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  if (date.getTime() < todayStart.getTime()) {
    return "overdue";
  }
  if (date.getTime() <= todayEnd.getTime()) {
    return "today";
  }
  return "upcoming";
}

export function isWithinHorizon(
  date: Date,
  now: Date,
  horizonDays: number,
): boolean {
  const horizonEnd = endOfDay(new Date(now.getTime() + horizonDays * MS_PER_DAY));
  return date.getTime() <= horizonEnd.getTime();
}

function calendarEventKindLabel(kind: CalendarEventKind): string {
  const labels: Record<CalendarEventKind, string> = {
    session: "DnD-Session",
    prep: "Vorbereitung",
    personal: "Persönlich",
    external: "Extern",
    dnd: "DnD",
  };
  return labels[kind];
}

function calendarEventHref(event: CalendarEvent): string | null {
  if (event.sessionId && event.worldId) {
    return `/worlds?session=${event.sessionId}`;
  }
  return "/calendar";
}

function calendarEventModuleLabel(event: CalendarEventWithFeed): string {
  if (event.feed && event.feed.type !== "local") {
    return event.feed.name;
  }
  return calendarEventKindLabel(event.kind);
}

export function aggregateCalendarItems(
  input: CalendarAggregationInput,
): AggregatedCalendarItem[] {
  const now = input.now ?? new Date();
  const horizonDays = input.horizonDays ?? 14;
  const items: AggregatedCalendarItem[] = [];
  const seenSessionIds = new Set<string>();

  for (const event of input.events) {
    const horizonEnd = endOfDay(new Date(now.getTime() + horizonDays * MS_PER_DAY));
    if (event.startAt.getTime() > horizonEnd.getTime()) {
      continue;
    }

    if (event.sessionId) {
      seenSessionIds.add(event.sessionId);
    }

    items.push({
      id: `event:${event.id}`,
      title: event.title,
      startAt: event.startAt,
      endAt: event.endAt,
      allDay: event.allDay,
      source: "calendar_event",
      kind: event.kind,
      moduleLabel: calendarEventModuleLabel(event),
      href: calendarEventHref(event),
      urgency: classifyUrgency(event.startAt, now),
    });
  }

  for (const session of input.sessions) {
    if (!session.date || seenSessionIds.has(session.id)) {
      continue;
    }
    if (!isWithinHorizon(session.date, now, horizonDays)) {
      continue;
    }

    items.push({
      id: `session:${session.id}`,
      title: `Session ${session.sessionNumber}: ${session.title}`,
      startAt: session.date,
      endAt: null,
      allDay: false,
      source: "calendar_event",
      kind: "session",
      moduleLabel: "DnD-Session",
      href: session.worldSlug
        ? `/worlds/${session.worldSlug}/sessions/${session.id}`
        : null,
      urgency: classifyUrgency(session.date, now),
    });

    if (session.status === "planned" || session.status === "prepared") {
      const prepDate = new Date(session.date.getTime() - SESSION_PREP_LEAD_DAYS * MS_PER_DAY);
      if (isWithinHorizon(prepDate, now, horizonDays)) {
        items.push({
          id: `prep:${session.id}`,
          title: `Vorbereitung Session ${session.sessionNumber}`,
          startAt: prepDate,
          endAt: null,
          allDay: true,
          source: "session_prep",
          kind: "prep",
          moduleLabel: "Vorbereitung",
          href: session.worldSlug
            ? `/worlds/${session.worldSlug}/sessions/${session.id}`
            : null,
          urgency: classifyUrgency(prepDate, now),
        });
      }
    }
  }

  for (const alert of input.contractAlerts) {
    if (!alert.dueDate) {
      continue;
    }
    if (!isWithinHorizon(alert.dueDate, now, horizonDays)) {
      continue;
    }

    items.push({
      id: `contract:${alert.contractId}:${alert.kind}`,
      title: `${alert.name}: ${alert.message}`,
      startAt: alert.dueDate,
      endAt: null,
      allDay: true,
      source: "contract",
      kind: "contract",
      moduleLabel: "Vertrag",
      href: "/contracts",
      urgency: classifyUrgency(alert.dueDate, now),
    });
  }

  for (const workshop of input.workshops) {
    const dueDate =
      workshop.nextActionDate ??
      readMetadataDate(workshop.metadata, ["dueDate", "deadline", "due_at"]);
    if (!dueDate || !isWithinHorizon(dueDate, now, horizonDays)) {
      continue;
    }

    items.push({
      id: `workshop:${workshop.id}`,
      title: `Werkstatt: ${workshop.title}`,
      startAt: dueDate,
      endAt: null,
      allDay: true,
      source: "workshop",
      kind: "workshop_deadline",
      moduleLabel: "Werkstatt",
      href: `/workshop/${workshop.id}`,
      urgency: classifyUrgency(dueDate, now),
    });
  }

  for (const device of input.hardware) {
    const maintenanceDue = readMetadataDate(device.metadata, [
      "maintenanceDueAt",
      "maintenanceDue",
      "nextMaintenanceAt",
    ]);
    if (!maintenanceDue || !isWithinHorizon(maintenanceDue, now, horizonDays)) {
      continue;
    }

    items.push({
      id: `hardware:${device.id}`,
      title: `Wartung: ${device.name}`,
      startAt: maintenanceDue,
      endAt: null,
      allDay: true,
      source: "hardware",
      kind: "maintenance",
      moduleLabel: "Hardware",
      href: "/hardware",
      urgency: classifyUrgency(maintenanceDue, now),
    });
  }

  for (const project of input.personalProjects) {
    const dueDate =
      project.nextActionDate ?? readMetadataDate(project.metadata, ["dueDate", "deadline"]);
    if (!dueDate || !isWithinHorizon(dueDate, now, horizonDays)) {
      continue;
    }

    items.push({
      id: `project:${project.id}`,
      title: project.name,
      startAt: dueDate,
      endAt: null,
      allDay: true,
      source: "personal_project",
      kind: "personal",
      moduleLabel: "Projekt",
      href: `/projects/${project.id}`,
      urgency: classifyUrgency(dueDate, now),
    });
  }

  for (const task of input.maintenanceTasks ?? []) {
    if (!task.nextDueAt || !isWithinHorizon(task.nextDueAt, now, horizonDays)) {
      continue;
    }

    const category = task.category?.trim();
    items.push({
      id: `maintenance:${task.id}`,
      title: task.title,
      startAt: task.nextDueAt,
      endAt: null,
      allDay: true,
      source: "maintenance_task",
      kind: "maintenance",
      moduleLabel: category ? `Haushalt · ${category}` : "Haushalt",
      href: "/household",
      urgency: classifyUrgency(task.nextDueAt, now),
    });
  }

  const needsBackupCheck =
    !input.lastBackupAt ||
    now.getTime() - input.lastBackupAt.getTime() > BACKUP_CHECK_INTERVAL_DAYS * MS_PER_DAY;

  if (needsBackupCheck) {
    const backupDueAt = input.lastBackupAt
      ? new Date(input.lastBackupAt.getTime() + BACKUP_CHECK_INTERVAL_DAYS * MS_PER_DAY)
      : now;

    items.push({
      id: "backup:check",
      title: input.lastBackupAt
        ? "Backup-Prüfung fällig"
        : "Erstes Backup anlegen",
      startAt: backupDueAt,
      endAt: null,
      allDay: true,
      source: "backup",
      kind: "backup",
      moduleLabel: "Backup",
      href: "/backup",
      urgency: classifyUrgency(backupDueAt, now),
    });
  }

  return items.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

export function splitCalendarItemsByDay(
  items: AggregatedCalendarItem[],
  now: Date = new Date(),
): { today: AggregatedCalendarItem[]; thisWeek: AggregatedCalendarItem[] } {
  const todayEnd = endOfDay(now);
  const weekEnd = endOfWeek(now);

  const today = items.filter(
    (item) => item.urgency === "today" || item.urgency === "overdue",
  );

  const thisWeek = items.filter(
    (item) =>
      item.startAt.getTime() > todayEnd.getTime() &&
      item.startAt.getTime() <= weekEnd.getTime(),
  );

  return { today, thisWeek };
}

export interface CalendarAggregationOptions {
  worldId?: string;
  worldSlug?: string;
  horizonDays?: number;
  now?: Date;
}

export class CalendarAggregationService {
  constructor(
    private readonly brainDb: BrainPrismaClient,
    private readonly db: PrismaClient,
  ) {}

  async getAggregatedItems(
    options: CalendarAggregationOptions = {},
  ): Promise<AggregatedCalendarItem[]> {
    const now = options.now ?? new Date();
    const horizonDays = options.horizonDays ?? 14;
    const from = startOfDay(now);
    const to = endOfDay(new Date(now.getTime() + horizonDays * MS_PER_DAY));

    const calendar = createCalendarService(this.brainDb, this.db);

    const [
      events,
      contracts,
      workshops,
      hardware,
      personalProjects,
      sessions,
      lastBackup,
      maintenanceTasks,
    ] = await Promise.all([
      calendar.listEventsForAggregation({
        worldId: options.worldId,
        from,
        to,
      }),
      this.brainDb.contractExpense.findMany({
        where: { status: { in: ["active", "review"] } },
      }),
      this.brainDb.workshopProject.findMany({
        where: { status: { in: ["planned", "in_progress", "material_missing"] } },
        select: { id: true, title: true, metadata: true, nextActionDate: true },
      }),
      this.brainDb.hardwareDevice.findMany({
        where: { status: { in: ["active", "planned", "offline"] } },
        select: { id: true, name: true, metadata: true },
      }),
      this.brainDb.personalProject.findMany({
        where: { status: { in: ["planned", "active", "blocked"] } },
        select: { id: true, name: true, metadata: true, nextActionDate: true },
      }),
      options.worldId
        ? this.db.gameSession.findMany({
            where: {
              worldId: options.worldId,
              date: { not: null },
              status: { in: ["planned", "prepared"] },
            },
            select: {
              id: true,
              title: true,
              sessionNumber: true,
              date: true,
              status: true,
              world: { select: { slug: true } },
            },
          })
        : Promise.resolve([]),
      this.db.activityLog.findFirst({
        where: { action: "backup_created" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      this.brainDb.maintenanceTask.findMany({
        where: { nextDueAt: { not: null, lte: to } },
        select: { id: true, title: true, nextDueAt: true, category: true },
      }),
    ]);

    return aggregateCalendarItems({
      events,
      contractAlerts: buildContractAlerts(contracts, now, horizonDays),
      workshops,
      hardware,
      personalProjects,
      sessions: sessions.map((session) => ({
        id: session.id,
        title: session.title,
        sessionNumber: session.sessionNumber,
        date: session.date,
        status: session.status,
        worldSlug: session.world?.slug ?? options.worldSlug ?? null,
      })),
      lastBackupAt: lastBackup?.createdAt ?? null,
      maintenanceTasks,
      now,
      horizonDays,
    });
  }

  async getTodaySummary(options: CalendarAggregationOptions = {}) {
    const items = await this.getAggregatedItems(options);
    return splitCalendarItemsByDay(items, options.now);
  }
}

export function createCalendarAggregationService(
  brainDb: BrainPrismaClient,
  db: PrismaClient,
): CalendarAggregationService {
  return new CalendarAggregationService(brainDb, db);
}
