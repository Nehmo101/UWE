/**
 * Wochenplan-Domänenlogik. ISO-Wochen-Helfer sind pure Funktionen (testbar ohne
 * DB); der Service kapselt die Persistenz. Business-Logik lebt hier, nicht in der
 * Route (CLAUDE.md „Goldene Regel").
 */
import { jsonDbNull, toPrismaJsonValue } from "@uwe/database/server";
import type { FamilyPrismaClient as PrismaClient } from "@uwe/database/family-client";
import type { WeekSuggestionDraft } from "./ai-suggest";
import type { MealEntryType, MealPlanGoals, MealSlot } from "./kitchen-types";

/** ISO-8601-Woche eines Datums (Montag = Wochenstart, Woche 1 enthält den 4. Januar). */
export function isoWeekOf(date: Date): { isoYear: number; isoWeek: number } {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7; // Mo=0 … So=6
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // Donnerstag dieser Woche
  const isoYear = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const isoWeek =
    1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return { isoYear, isoWeek };
}

/** Die sieben Tage (Mo–So) einer ISO-Woche als UTC-Daten. */
export function datesOfIsoWeek(isoYear: number, isoWeek: number): Date[] {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (isoWeek - 1) * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + index);
    return day;
  });
}

export interface SetMealEntryInput {
  weekId: string;
  date: Date;
  slot: MealSlot;
  entryType?: MealEntryType;
  recipeId?: string | null;
  servings?: number | null;
  note?: string;
  sortIndex?: number;
}

const WEEK_INCLUDE = {
  entries: {
    orderBy: [{ date: "asc" as const }, { sortIndex: "asc" as const }],
    include: { recipe: { select: { id: true, title: true, servingsBase: true } } },
  },
};

export class MealPlanService {
  constructor(private readonly db: PrismaClient) {}

  async getOrCreateWeek(isoYear: number, isoWeek: number, householdFactor = 2.5) {
    const existing = await this.db.mealPlanWeek.findUnique({
      where: { isoYear_isoWeek: { isoYear, isoWeek } },
      include: WEEK_INCLUDE,
    });
    if (existing) return existing;
    return this.db.mealPlanWeek.create({
      data: { isoYear, isoWeek, householdFactor },
      include: WEEK_INCLUDE,
    });
  }

  async getWeek(isoYear: number, isoWeek: number) {
    return this.db.mealPlanWeek.findUnique({
      where: { isoYear_isoWeek: { isoYear, isoWeek } },
      include: WEEK_INCLUDE,
    });
  }

  async listWeeks() {
    return this.db.mealPlanWeek.findMany({
      orderBy: [{ isoYear: "desc" }, { isoWeek: "desc" }],
      select: { id: true, isoYear: true, isoWeek: true, householdFactor: true },
    });
  }

  async updateWeek(
    weekId: string,
    patch: { householdFactor?: number; goals?: MealPlanGoals | null; notes?: string },
  ) {
    return this.db.mealPlanWeek.update({
      where: { id: weekId },
      data: {
        householdFactor: patch.householdFactor,
        goals: patch.goals === undefined ? undefined : toPrismaJsonValue(patch.goals),
        notes: patch.notes,
      },
      include: WEEK_INCLUDE,
    });
  }

  async setEntry(input: SetMealEntryInput) {
    return this.db.mealPlanEntry.create({
      data: {
        weekId: input.weekId,
        date: input.date,
        slot: input.slot,
        entryType: input.entryType ?? "recipe",
        recipeId: input.recipeId ?? null,
        servings: input.servings ?? null,
        note: input.note ?? "",
        sortIndex: input.sortIndex ?? 0,
      },
    });
  }

  async removeEntry(entryId: string) {
    await this.db.mealPlanEntry.delete({ where: { id: entryId } });
  }

  /**
   * Persistiert (oder verwirft mit `null`) den KI-Wochenvorschlag-Entwurf für
   * eine Woche. Der Entwurf wird nie automatisch übernommen — der Owner
   * bestätigt einzelne Einträge über {@link setEntry}.
   */
  async setAiDraft(weekId: string, draft: WeekSuggestionDraft | null) {
    return this.db.mealPlanWeek.update({
      where: { id: weekId },
      data: { aiDraft: draft === null ? jsonDbNull : toPrismaJsonValue(draft) },
      include: WEEK_INCLUDE,
    });
  }

  async toggleCooked(entryId: string) {
    const entry = await this.db.mealPlanEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new Error("Eintrag nicht gefunden.");
    return this.db.mealPlanEntry.update({
      where: { id: entryId },
      data: { cooked: !entry.cooked },
    });
  }

  /**
   * Kopiert die Einträge einer Quellwoche in die Zielwoche (z. B. für feste
   * Routinen wie „Freitag Pizza"). Datums-Wochentag bleibt erhalten, das Datum
   * wird auf die Zielwoche verschoben.
   */
  async copyWeekEntries(
    sourceWeekId: string,
    targetIsoYear: number,
    targetIsoWeek: number,
    onlyRoutines = false,
  ) {
    const [source, targetWeek] = await Promise.all([
      this.db.mealPlanWeek.findUnique({
        where: { id: sourceWeekId },
        include: { entries: true },
      }),
      this.getOrCreateWeek(targetIsoYear, targetIsoWeek),
    ]);
    if (!source) throw new Error("Quellwoche nicht gefunden.");

    const targetDates = datesOfIsoWeek(targetIsoYear, targetIsoWeek);
    for (const entry of source.entries) {
      if (onlyRoutines && entry.entryType !== "routine") continue;
      const weekday = (new Date(entry.date).getUTCDay() + 6) % 7;
      await this.db.mealPlanEntry.create({
        data: {
          weekId: targetWeek.id,
          date: targetDates[weekday] ?? targetDates[0],
          slot: entry.slot,
          entryType: entry.entryType,
          recipeId: entry.recipeId,
          servings: entry.servings,
          note: entry.note,
          sortIndex: entry.sortIndex,
        },
      });
    }
    return this.getWeek(targetIsoYear, targetIsoWeek);
  }
}

export function createMealPlanService(db: PrismaClient): MealPlanService {
  return new MealPlanService(db);
}
