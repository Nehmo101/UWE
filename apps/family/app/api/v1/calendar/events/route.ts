import { NextResponse } from "next/server";
import { createCalendarService, prisma } from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import {
  attachMembersToEvents,
  createFamilyMemberService,
  expandAnniversaries,
  resolveEventEnd,
  resolveMemberColour,
  setEventMembers,
} from "@uwe/family-core";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";

/**
 * Termine lesen und anlegen.
 *
 * Der Zeitraum ist begrenzt (Standard: kommende 30 Tage), damit ein Aufruf
 * ohne Parameter nicht die ganze Historie zieht. Geburtstage kommen auf Wunsch
 * mit — sie sind keine gespeicherten Termine, sondern werden aufgespannt.
 */

export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 30;
const MAX_LIMIT = 500;

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(request: Request) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_read"] });
  if (denied) return denied;

  const url = new URL(request.url);
  const now = new Date();
  const from = parseDate(url.searchParams.get("from")) ?? now;
  const to =
    parseDate(url.searchParams.get("to")) ??
    new Date(now.getTime() + DEFAULT_DAYS * 24 * 60 * 60 * 1000);
  const memberId = url.searchParams.get("memberId") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, MAX_LIMIT);

  const calendar = createCalendarService(familyPrisma, prisma);
  const raw = await calendar.listEvents({ from, to, limit });
  const enriched = await attachMembersToEvents(familyPrisma, raw);

  const events = memberId
    ? enriched.filter((event) => event.members.some((m) => m.id === memberId))
    : enriched;

  const payload: Record<string, unknown> = {
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startAt: event.startAt,
      endAt: event.endAt,
      allDay: event.allDay,
      kind: event.kind,
      members: event.members,
    })),
  };

  if (url.searchParams.get("includeAnniversaries") === "true") {
    const members = await createFamilyMemberService(familyPrisma).listMembers();
    payload["anniversaries"] = expandAnniversaries(members, {
      from,
      to,
      colourOf: resolveMemberColour,
    })
      .filter((occurrence) => !memberId || occurrence.memberId === memberId)
      .map((occurrence) => ({
        title: occurrence.title,
        date: occurrence.date,
        memberId: occurrence.memberId,
        memberName: occurrence.memberName,
        kind: occurrence.kind,
      }));
  }

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_write"] });
  if (denied) return denied;

  let body: {
    title?: unknown;
    startAt?: unknown;
    endAt?: unknown;
    allDay?: unknown;
    location?: unknown;
    description?: unknown;
    memberIds?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Anfragekörper." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const startAt = typeof body.startAt === "string" ? new Date(body.startAt) : null;

  if (title === "" || !startAt || Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "title und startAt sind nötig." }, { status: 400 });
  }

  const endAt = typeof body.endAt === "string" ? new Date(body.endAt) : null;
  const allDay = body.allDay === true;
  const calendar = createCalendarService(familyPrisma, prisma);
  // Ohne lokalen Feed haette der Termin keine Heimat.
  const local = await calendar.ensureLocalFeed();

  const event = await calendar.createEvent({
    feedId: local.id,
    title,
    description: typeof body.description === "string" ? body.description : null,
    location: typeof body.location === "string" ? body.location : null,
    startAt,
    // Ohne `endAt` dauert ein Termin eine Stunde; ganztägig bleibt ohne Ende.
    endAt: resolveEventEnd(startAt, endAt, { allDay }),
    allDay,
    kind: "personal",
  });

  if (Array.isArray(body.memberIds)) {
    await setEventMembers(
      familyPrisma,
      event.id,
      body.memberIds.filter((id): id is string => typeof id === "string"),
    );
  }

  return NextResponse.json({ id: event.id, title: event.title }, { status: 201 });
}
