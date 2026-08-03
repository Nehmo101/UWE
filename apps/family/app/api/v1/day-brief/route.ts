import { NextResponse } from "next/server";
import { createCalendarService, prisma } from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import { FAMILY_DAY_BRIEF_MAX_DAYS, loadFamilyDayBrief } from "@uwe/family-core";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";

/**
 * Tagesstand des Haushalts in einem Aufruf — für ein Küchen-Tablet oder ein
 * Wand-Display.
 *
 * Bewusst ein einziger Endpunkt: eine Anzeige soll nicht fünf Abrufe
 * zusammenstückeln müssen, nur um zu zeigen, was heute ansteht. Was hier
 * herauskommt, ist dasselbe, was `/briefing` im Browser zeigt — nur auf heute
 * (und optional morgen) zugeschnitten und um Essensplan, Einkaufsliste und
 * Wartungsaufgaben ergänzt.
 *
 * Zugang wie überall in Family: Häkchen `Family` oder ein API-Token mit
 * `family_read` (Studio → Admin → API-Tokens). Es gibt bewusst keinen
 * tokenlosen Weg — ein Tagesplan verrät, wer wann nicht zu Hause ist.
 */

export const dynamic = "force-dynamic";

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(request: Request) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_read"] });
  if (denied) return denied;

  const url = new URL(request.url);
  const days = Math.min(
    Math.max(Number(url.searchParams.get("days")) || FAMILY_DAY_BRIEF_MAX_DAYS, 1),
    FAMILY_DAY_BRIEF_MAX_DAYS,
  );
  const at = parseDate(url.searchParams.get("at")) ?? new Date();

  const brief = await loadFamilyDayBrief({
    familyDb: familyPrisma,
    calendar: createCalendarService(familyPrisma, prisma),
    at,
    days,
  });

  // Kein Zwischenspeicher: Ein Tablet, das den Stand von gestern zeigt, ist
  // schlimmer als eines, das kurz leer bleibt.
  return NextResponse.json(brief, {
    headers: { "Cache-Control": "no-store" },
  });
}
