"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  advanceInGameDate,
  prisma,
  createWorldCalendarService,
  getAppRepository,
  parseInGameDate,
  parseWorldCalendarMonths,
  type WorldCalendarMonth,
} from "@uwe/database/server";
import {
  parseHolidayRows,
  serializeWorldCalendarSettings,
} from "@uwe/database/world-calendar-settings";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

function parseMonthRows(formData: FormData): WorldCalendarMonth[] {
  const count = Number(formData.get("monthCount") || 0);
  const months: WorldCalendarMonth[] = [];

  for (let index = 0; index < count; index += 1) {
    const key = String(formData.get(`month_${index}_key`) || "").trim();
    const name = String(formData.get(`month_${index}_name`) || "").trim();
    const daysInMonth = Number(formData.get(`month_${index}_days`) || 30);
    if (!key || !name || !Number.isFinite(daysInMonth) || daysInMonth < 1) {
      continue;
    }
    months.push({ key, name, daysInMonth: Math.floor(daysInMonth) });
  }

  if (months.length === 0) {
    throw new Error("Mindestens ein Monat ist erforderlich.");
  }

  return months;
}

function parseDayNameRows(formData: FormData): string[] | undefined {
  const count = Number(formData.get("dayNameCount") || 0);
  const names: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const name = String(formData.get(`dayName_${index}`) || "").trim();
    if (name) {
      names.push(name);
    }
  }

  return names.length > 0 ? names : undefined;
}

export async function updateWorldCalendarAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug"));
  const name = String(formData.get("name") || "").trim() || "Weltkalender";
  const epochLabel = String(formData.get("epochLabel") || "").trim() || null;
  const daysPerWeek = Number(formData.get("daysPerWeek") || 7);
  const year = Number(formData.get("currentYear"));
  const month = Number(formData.get("currentMonth"));
  const day = Number(formData.get("currentDay"));

  if (!Number.isFinite(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 14) {
    throw new Error("Tage pro Woche müssen zwischen 1 und 14 liegen.");
  }
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error("Aktuelles In-Game-Datum ist ungültig.");
  }

  await requireStudioWorldEdit(worldSlug);

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    throw new Error("Welt nicht gefunden.");
  }

  const calendars = createWorldCalendarService(prisma);
  const holidays = parseHolidayRows(formData);

  await calendars.upsertForWorld({
    worldId: world.id,
    name,
    epochLabel,
    daysPerWeek: Math.floor(daysPerWeek),
    months: parseMonthRows(formData),
    dayNames: parseDayNameRows(formData),
    currentDate: {
      year: Math.floor(year),
      month: Math.floor(month),
      day: Math.floor(day),
    },
    settings: serializeWorldCalendarSettings({ holidays }),
  });

  revalidatePath(`/worlds/${worldSlug}/calendar`);
  redirect(`/worlds/${worldSlug}/calendar?saved=1`);
}

export async function advanceWorldCalendarAction(formData: FormData) {
  await requireStudioActionAuth();

  const worldSlug = String(formData.get("worldSlug"));
  const advanceDays = Number(formData.get("advanceDays"));
  // Optionaler Rücksprung in den Session-Abschluss-Flow — validiert, kein freies Ziel.
  const returnTo = String(formData.get("returnTo") || "");
  const campaignSlug = String(formData.get("campaignSlug") || "");
  const sessionId = String(formData.get("sessionId") || "");

  if (!Number.isFinite(advanceDays) || advanceDays < 1 || advanceDays > 365) {
    throw new Error("Vorlauf muss zwischen 1 und 365 Tagen liegen.");
  }

  await requireStudioWorldEdit(worldSlug);

  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    throw new Error("Welt nicht gefunden.");
  }

  const calendars = createWorldCalendarService(prisma);
  let calendar = await calendars.getByWorldId(world.id);
  if (!calendar) {
    calendar = await calendars.upsertForWorld({ worldId: world.id });
  }

  const months = parseWorldCalendarMonths(calendar.months);
  const current = parseInGameDate(calendar.currentDate);
  const next = advanceInGameDate(current, Math.floor(advanceDays), months);

  await calendars.upsertForWorld({
    worldId: world.id,
    currentDate: next,
  });

  revalidatePath(`/worlds/${worldSlug}/calendar`);
  revalidatePath(`/worlds/${worldSlug}/chronicle`);

  if (returnTo === "abschluss" && campaignSlug) {
    const abschlussPath = `/worlds/${worldSlug}/kampagnen/${campaignSlug}/abschluss`;
    revalidatePath(abschlussPath);
    redirect(
      sessionId
        ? `${abschlussPath}?session=${encodeURIComponent(sessionId)}&clock=1`
        : `${abschlussPath}?clock=1`,
    );
  }
  redirect(`/worlds/${worldSlug}/calendar?saved=1`);
}
