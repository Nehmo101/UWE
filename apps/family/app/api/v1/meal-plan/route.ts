import { NextResponse } from "next/server";
import { familyPrisma } from "@uwe/database/family-client";
import { createMealPlanService, datesOfIsoWeek, isoWeekOf } from "@uwe/kitchen";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";

/**
 * Wochen-Essensplan lesen — die ganze ISO-Woche, nicht nur heute/morgen wie im
 * Tagesstand. Eine Woche ohne Plan antwortet mit leeren `entries`, nicht 404:
 * „nichts geplant" ist für einen Anzeige-Client kein Fehlerfall.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_read"] });
  if (denied) return denied;

  const url = new URL(request.url);
  const current = isoWeekOf(new Date());
  const yearParam = Number(url.searchParams.get("year"));
  const weekParam = Number(url.searchParams.get("week"));
  const isoYear =
    Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2200
      ? yearParam
      : current.isoYear;
  const isoWeek =
    Number.isInteger(weekParam) && weekParam >= 1 && weekParam <= 53 ? weekParam : current.isoWeek;

  const week = await createMealPlanService(familyPrisma).getWeek(isoYear, isoWeek);
  const days = datesOfIsoWeek(isoYear, isoWeek).map((day) => day.toISOString().slice(0, 10));

  return NextResponse.json({
    isoYear,
    isoWeek,
    days,
    entries: (week?.entries ?? []).map((entry) => ({
      id: entry.id,
      date: entry.date,
      slot: entry.slot,
      entryType: entry.entryType,
      note: entry.note,
      servings: entry.servings,
      cooked: entry.cooked,
      recipe: entry.recipe
        ? {
            id: entry.recipe.id,
            title: entry.recipe.title,
            servingsBase: entry.recipe.servingsBase,
          }
        : null,
    })),
  });
}
