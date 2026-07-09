import type { Prisma } from "./generated/prisma/client";

export interface WorldCalendarHoliday {
  name: string;
  /** 1-based month index. */
  month: number;
  day: number;
  notes?: string;
}

export interface WorldCalendarSettings {
  holidays: WorldCalendarHoliday[];
}

export function parseWorldCalendarSettings(value: unknown): WorldCalendarSettings {
  if (!value || typeof value !== "object") {
    return { holidays: [] };
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.holidays)) {
    return { holidays: [] };
  }
  const holidays: WorldCalendarHoliday[] = [];
  for (const entry of record.holidays) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const month = typeof row.month === "number" ? row.month : Number(row.month);
    const day = typeof row.day === "number" ? row.day : Number(row.day);
    const notes = typeof row.notes === "string" ? row.notes.trim() : undefined;
    if (!name || !Number.isFinite(month) || !Number.isFinite(day)) continue;
    holidays.push({
      name,
      month: Math.floor(month),
      day: Math.floor(day),
      ...(notes ? { notes } : {}),
    });
  }
  return { holidays };
}

export function parseHolidayRows(formData: FormData): WorldCalendarHoliday[] {
  const count = Number(formData.get("holidayCount") || 0);
  const holidays: WorldCalendarHoliday[] = [];
  for (let index = 0; index < count; index += 1) {
    const name = String(formData.get(`holiday_${index}_name`) || "").trim();
    const month = Number(formData.get(`holiday_${index}_month`));
    const day = Number(formData.get(`holiday_${index}_day`));
    const notes = String(formData.get(`holiday_${index}_notes`) || "").trim();
    if (!name || !Number.isFinite(month) || !Number.isFinite(day)) continue;
    holidays.push({
      name,
      month: Math.floor(month),
      day: Math.floor(day),
      notes: notes || undefined,
    });
  }
  return holidays;
}

export function serializeWorldCalendarSettings(settings: WorldCalendarSettings): Prisma.InputJsonValue {
  return { holidays: settings.holidays } as unknown as Prisma.InputJsonValue;
}
