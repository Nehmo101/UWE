import { prisma, type PrismaClient } from "./client";
import { brainPrisma, type BrainPrismaClient } from "./brain-client";

/**
 * Haushalts-Cockpit: wiederkehrende Wartungs-/Haushaltsaufgaben (Müll, Rauchmelder,
 * Auto, Heizung, Filter, Geräte …). Reminder sind ABGELEITET aus `nextDueAt` —
 * kein eigenes Notification-System. Business-Logik lebt hier, die Studio-Seite ist dünn.
 */

/** Muss zu `MaintenanceInterval` im Prisma-Schema passen. */
export type MaintenanceInterval =
  | "once"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export const MAINTENANCE_INTERVALS: readonly MaintenanceInterval[] = [
  "once",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
] as const;

export const MAINTENANCE_INTERVAL_LABELS: Record<MaintenanceInterval, string> = {
  once: "Einmalig",
  weekly: "Wöchentlich",
  biweekly: "Zweiwöchentlich",
  monthly: "Monatlich",
  quarterly: "Vierteljährlich",
  yearly: "Jährlich",
};

/** Fälligkeits-Klasse einer Aufgabe relativ zu `now`. */
export type DueClass = "overdue" | "soon" | "later" | "none";

/** Standard-Fenster (Tage), ab dem eine Aufgabe als „bald fällig" gilt. */
export const DEFAULT_SOON_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Nächste Fälligkeit rein aus Intervall + Startdatum berechnen.
 * Pure (kein `new Date()`), damit testbar. `once` hat keine Wiederkehr → null.
 */
export function computeNextDue(interval: MaintenanceInterval, from: Date): Date | null {
  switch (interval) {
    case "once":
      return null;
    case "weekly":
      return new Date(from.getTime() + 7 * DAY_MS);
    case "biweekly":
      return new Date(from.getTime() + 14 * DAY_MS);
    case "monthly":
      return addMonths(from, 1);
    case "quarterly":
      return addMonths(from, 3);
    case "yearly":
      return addMonths(from, 12);
    default: {
      const exhaustive: never = interval;
      return exhaustive;
    }
  }
}

/** Monate addieren, ohne über kürzere Folgemonate zu „überlaufen" (31. Jan + 1M → 28./29. Feb). */
// UTC arithmetic so advancing across a DST boundary (e.g. Jan→Apr in Europe)
// preserves the UTC time-of-day instead of drifting an hour with the offset.
function addMonths(from: Date, months: number): Date {
  const result = new Date(from.getTime());
  const targetMonth = result.getUTCMonth() + months;
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(targetMonth);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/** Fälligkeit klassifizieren — pure, für Ampel-Anzeige und Unit-Tests. */
export function classifyDue(
  nextDueAt: Date | null | undefined,
  now: Date,
  soonDays: number = DEFAULT_SOON_DAYS,
): DueClass {
  if (!nextDueAt) return "none";
  const diffMs = nextDueAt.getTime() - now.getTime();
  if (diffMs < 0) return "overdue";
  if (diffMs <= soonDays * DAY_MS) return "soon";
  return "later";
}

export interface MaintenanceTaskInput {
  title: string;
  category?: string;
  interval?: MaintenanceInterval;
  nextDueAt?: Date | null;
  notes?: string;
}

export type MaintenanceTaskPatch = Partial<MaintenanceTaskInput> & {
  lastDoneAt?: Date | null;
};

export interface MaintenanceTaskRecord {
  id: string;
  title: string;
  category: string;
  interval: MaintenanceInterval;
  lastDoneAt: Date | null;
  nextDueAt: Date | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpcomingMaintenanceTask extends MaintenanceTaskRecord {
  dueClass: DueClass;
  overdue: boolean;
}

/** nextDueAt aufsteigend, `null` (ohne Fälligkeit) ans Ende. */
function byNextDue(a: MaintenanceTaskRecord, b: MaintenanceTaskRecord): number {
  if (a.nextDueAt && b.nextDueAt) return a.nextDueAt.getTime() - b.nextDueAt.getTime();
  if (a.nextDueAt) return -1;
  if (b.nextDueAt) return 1;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export class MaintenanceService {
  constructor(private readonly db: BrainPrismaClient) {}

  /** Alle Aufgaben, sortiert nach Fälligkeit (ohne Fälligkeit zuletzt). */
  async list(): Promise<MaintenanceTaskRecord[]> {
    const rows = await this.db.maintenanceTask.findMany();
    return (rows as MaintenanceTaskRecord[]).slice().sort(byNextDue);
  }

  async create(input: MaintenanceTaskInput): Promise<MaintenanceTaskRecord> {
    const row = await this.db.maintenanceTask.create({
      data: {
        title: input.title.trim(),
        category: input.category?.trim() ?? "",
        interval: input.interval ?? "yearly",
        nextDueAt: input.nextDueAt ?? null,
        notes: input.notes ?? "",
      },
    });
    return row as MaintenanceTaskRecord;
  }

  async update(id: string, patch: MaintenanceTaskPatch): Promise<MaintenanceTaskRecord> {
    const row = await this.db.maintenanceTask.update({
      where: { id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        ...(patch.category !== undefined ? { category: patch.category.trim() } : {}),
        ...(patch.interval !== undefined ? { interval: patch.interval } : {}),
        ...(patch.nextDueAt !== undefined ? { nextDueAt: patch.nextDueAt } : {}),
        ...(patch.lastDoneAt !== undefined ? { lastDoneAt: patch.lastDoneAt } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      },
    });
    return row as MaintenanceTaskRecord;
  }

  async remove(id: string): Promise<void> {
    await this.db.maintenanceTask.delete({ where: { id } });
  }

  /**
   * Aufgabe als erledigt markieren: `lastDoneAt = now`, `nextDueAt` neu aus dem
   * Intervall abgeleitet (bei `once` → null, also keine Wiederkehr).
   */
  async markDone(id: string, now: Date = new Date()): Promise<MaintenanceTaskRecord> {
    const existing = await this.db.maintenanceTask.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Wartungsaufgabe ${id} nicht gefunden`);
    }
    const interval = existing.interval as MaintenanceInterval;
    const row = await this.db.maintenanceTask.update({
      where: { id },
      data: {
        lastDoneAt: now,
        nextDueAt: computeNextDue(interval, now),
      },
    });
    return row as MaintenanceTaskRecord;
  }

  /**
   * Fällige/bald fällige Aufgaben: `nextDueAt <= now + withinDays`.
   * Überfällige zuerst, dann nach Fälligkeit; jede mit `dueClass` + `overdue`-Flag.
   */
  async getUpcoming(
    withinDays: number = DEFAULT_SOON_DAYS,
    now: Date = new Date(),
  ): Promise<UpcomingMaintenanceTask[]> {
    const horizon = new Date(now.getTime() + withinDays * DAY_MS);
    const rows = await this.db.maintenanceTask.findMany({
      where: { nextDueAt: { not: null, lte: horizon } },
    });
    return (rows as MaintenanceTaskRecord[])
      .slice()
      .sort(byNextDue)
      .map((task) => {
        const dueClass = classifyDue(task.nextDueAt, now, withinDays);
        return { ...task, dueClass, overdue: dueClass === "overdue" };
      });
  }
}

export function createMaintenanceService(
  brainDb: BrainPrismaClient = brainPrisma,
  _coreDb: PrismaClient = prisma,
): MaintenanceService {
  return new MaintenanceService(brainDb);
}
