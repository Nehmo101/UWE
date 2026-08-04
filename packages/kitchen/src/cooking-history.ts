/**
 * Koch-Historie aus dem Wochenplan: wann wurde ein Rezept zuletzt gekocht bzw.
 * geplant, wie oft tauchte es auf. Kein eigenes Modell — abgeleitet aus
 * `MealPlanEntry` (date, recipeId, cooked). Grundlage für die Variations-Regel
 * des KI-Wochenvorschlags („lange nicht Gekochtes bevorzugen").
 */
import type { FamilyPrismaClient } from "@uwe/database/family-client";

/** Wie weit die Historie zurückschaut (in Wochen). */
export const HISTORY_LOOKBACK_WEEKS = 12;

export interface RecipeHistoryEntry {
  lastCookedAt: Date | null;
  lastPlannedAt: Date | null;
  timesPlanned: number;
}

/** Volle Tage zwischen `date` und `now`; Zukunft zählt als 0, `null` bleibt `null`. */
export function daysSince(date: Date | null, now: Date): number | null {
  if (!date) return null;
  const diff = now.getTime() - date.getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / (24 * 3600 * 1000));
}

/**
 * Liest die Plan-Einträge der letzten `lookbackWeeks` Wochen und aggregiert sie
 * je Rezept. `lastCookedAt` zählt nur abgehakte Einträge (`cooked`),
 * `lastPlannedAt` jeden Rezept-Eintrag — auch der reine Plan verhindert, dass
 * dasselbe Gericht zwei Wochen hintereinander vorgeschlagen wird.
 */
export async function getRecipeHistory(
  db: FamilyPrismaClient,
  options: { now?: Date; lookbackWeeks?: number } = {},
): Promise<Map<string, RecipeHistoryEntry>> {
  const now = options.now ?? new Date();
  const lookbackWeeks = options.lookbackWeeks ?? HISTORY_LOOKBACK_WEEKS;
  const from = new Date(now.getTime() - lookbackWeeks * 7 * 24 * 3600 * 1000);

  const entries = await db.mealPlanEntry.findMany({
    where: {
      entryType: "recipe",
      recipeId: { not: null },
      date: { gte: from, lt: now },
    },
    select: { recipeId: true, date: true, cooked: true },
  });

  const history = new Map<string, RecipeHistoryEntry>();
  for (const entry of entries) {
    if (!entry.recipeId) continue;
    const current = history.get(entry.recipeId) ?? {
      lastCookedAt: null,
      lastPlannedAt: null,
      timesPlanned: 0,
    };
    current.timesPlanned += 1;
    if (!current.lastPlannedAt || entry.date > current.lastPlannedAt) {
      current.lastPlannedAt = entry.date;
    }
    if (entry.cooked && (!current.lastCookedAt || entry.date > current.lastCookedAt)) {
      current.lastCookedAt = entry.date;
    }
    history.set(entry.recipeId, current);
  }
  return history;
}
