import type { Prisma, PrismaClient } from "./generated/prisma/client";

export interface InGameDate {
  year: number;
  month: number;
  day: number;
}

export interface WorldCalendarMonth {
  key: string;
  name: string;
  daysInMonth: number;
}

export const DEFAULT_WORLD_CALENDAR_MONTHS: WorldCalendarMonth[] = [
  { key: "spring", name: "Frühling", daysInMonth: 30 },
  { key: "summer", name: "Sommer", daysInMonth: 30 },
  { key: "autumn", name: "Herbst", daysInMonth: 30 },
  { key: "winter", name: "Winter", daysInMonth: 30 },
];

export const DEFAULT_IN_GAME_DATE: InGameDate = { year: 1, month: 1, day: 1 };

export interface UpsertWorldCalendarInput {
  worldId: string;
  name?: string;
  months?: WorldCalendarMonth[];
  daysPerWeek?: number;
  dayNames?: string[];
  currentDate?: InGameDate;
  epochLabel?: string | null;
  settings?: Prisma.InputJsonValue;
}

export class WorldCalendarService {
  constructor(private readonly db: PrismaClient) {}

  async getByWorldId(worldId: string) {
    return this.db.worldCalendar.findUnique({ where: { worldId } });
  }

  async upsertForWorld(input: UpsertWorldCalendarInput) {
    const months = input.months ?? DEFAULT_WORLD_CALENDAR_MONTHS;
    const currentDate = input.currentDate ?? DEFAULT_IN_GAME_DATE;

    return this.db.worldCalendar.upsert({
      where: { worldId: input.worldId },
      create: {
        worldId: input.worldId,
        name: input.name ?? "Weltkalender",
        months: months as unknown as Prisma.InputJsonValue,
        daysPerWeek: input.daysPerWeek ?? 7,
        dayNames: input.dayNames
          ? (input.dayNames as unknown as Prisma.InputJsonValue)
          : undefined,
        currentDate: currentDate as unknown as Prisma.InputJsonValue,
        epochLabel: input.epochLabel ?? null,
        settings: input.settings,
      },
      update: {
        name: input.name,
        months: input.months
          ? (input.months as unknown as Prisma.InputJsonValue)
          : undefined,
        daysPerWeek: input.daysPerWeek,
        dayNames: input.dayNames
          ? (input.dayNames as unknown as Prisma.InputJsonValue)
          : undefined,
        currentDate: input.currentDate
          ? (input.currentDate as unknown as Prisma.InputJsonValue)
          : undefined,
        epochLabel: input.epochLabel,
        settings: input.settings,
      },
    });
  }
}

export function createWorldCalendarService(db: PrismaClient): WorldCalendarService {
  return new WorldCalendarService(db);
}

export function formatInGameDate(date: InGameDate, months: WorldCalendarMonth[]): string {
  const month = months[date.month - 1];
  const monthName = month?.name ?? `Monat ${date.month}`;
  return `${date.day}. ${monthName} ${date.year}`;
}

export function parseInGameDate(value: unknown): InGameDate {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_IN_GAME_DATE;
  }
  const record = value as Record<string, unknown>;
  const year = typeof record.year === "number" ? record.year : DEFAULT_IN_GAME_DATE.year;
  const month = typeof record.month === "number" ? record.month : DEFAULT_IN_GAME_DATE.month;
  const day = typeof record.day === "number" ? record.day : DEFAULT_IN_GAME_DATE.day;
  return { year, month, day };
}

export function parseWorldCalendarMonths(value: unknown): WorldCalendarMonth[] {
  if (!Array.isArray(value)) {
    return DEFAULT_WORLD_CALENDAR_MONTHS;
  }
  const months = value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) return null;
      const record = entry as Record<string, unknown>;
      const key = typeof record.key === "string" ? record.key : "";
      const name = typeof record.name === "string" ? record.name : "";
      const daysInMonth =
        typeof record.daysInMonth === "number" ? record.daysInMonth : 30;
      if (!key || !name) return null;
      return { key, name, daysInMonth };
    })
    .filter((entry): entry is WorldCalendarMonth => entry !== null);
  return months.length > 0 ? months : DEFAULT_WORLD_CALENDAR_MONTHS;
}

export function parseDayNames(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const names = value.filter((entry): entry is string => typeof entry === "string");
  return names.length > 0 ? names : null;
}
