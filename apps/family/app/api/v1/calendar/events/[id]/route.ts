import { NextResponse } from "next/server";
import { createCalendarService, prisma } from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import { resolveEventEnd, setEventMembers } from "@uwe/family-core";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";

/**
 * Einzelnen Termin ändern oder löschen.
 *
 * Nur Termine des lokalen Feeds sind beschreibbar: Einträge aus ICS-Abos oder
 * fremden CalDAV-Feeds würde der nächste Sync kommentarlos überschreiben —
 * statt stiller Datenverluste antwortet die Route dort mit 409.
 */

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type LoadedEvent = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createCalendarService>["getEvent"]>>
>;

function writableDenial(event: LoadedEvent): NextResponse | null {
  const isLocal = event.kind === "personal" && (!event.feed || event.feed.type === "local");
  if (isLocal) return null;
  return NextResponse.json(
    { error: "Nur lokale Termine sind änderbar — dieser stammt aus einem Abo." },
    { status: 409 },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
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

  const { id } = await context.params;
  const calendar = createCalendarService(familyPrisma, prisma);
  const existing = await calendar.getEvent(id);
  if (!existing) {
    return NextResponse.json({ error: "Termin nicht gefunden." }, { status: 404 });
  }
  const conflict = writableDenial(existing);
  if (conflict) return conflict;

  const title = typeof body.title === "string" ? body.title.trim() : undefined;
  if (title === "") {
    return NextResponse.json({ error: "title darf nicht leer sein." }, { status: 400 });
  }
  const startAt = typeof body.startAt === "string" ? new Date(body.startAt) : undefined;
  if (startAt && Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "startAt ist kein Datum." }, { status: 400 });
  }
  // `endAt: null` heisst „Ende entfernen" — dann greift wieder die Vorbelegung.
  const endAt =
    typeof body.endAt === "string"
      ? new Date(body.endAt)
      : body.endAt === null
        ? null
        : undefined;
  if (endAt && Number.isNaN(endAt.getTime())) {
    return NextResponse.json({ error: "endAt ist kein Datum." }, { status: 400 });
  }
  const allDay = typeof body.allDay === "boolean" ? body.allDay : undefined;

  const nextStart = startAt ?? existing.startAt;
  const nextAllDay = allDay ?? existing.allDay;
  const nextEnd = endAt === undefined ? existing.endAt : endAt;

  const event = await calendar.updateEvent(id, {
    ...(title !== undefined ? { title } : {}),
    ...(startAt !== undefined ? { startAt } : {}),
    // Ohne Ende dauert ein Termin eine Stunde; ganztägig bleibt ohne Ende —
    // dieselbe Vorbelegung wie beim Anlegen (`resolveEventEnd`).
    endAt: resolveEventEnd(nextStart, nextEnd, { allDay: nextAllDay }),
    ...(allDay !== undefined ? { allDay } : {}),
    ...(typeof body.location === "string" || body.location === null
      ? { location: (body.location as string | null) ?? null }
      : {}),
    ...(typeof body.description === "string" || body.description === null
      ? { description: (body.description as string | null) ?? null }
      : {}),
  });

  if (Array.isArray(body.memberIds)) {
    await setEventMembers(
      familyPrisma,
      event.id,
      body.memberIds.filter((memberId): memberId is string => typeof memberId === "string"),
    );
  }

  return NextResponse.json({ id: event.id, title: event.title });
}

export async function DELETE(request: Request, context: RouteContext) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_write"] });
  if (denied) return denied;

  const { id } = await context.params;
  const calendar = createCalendarService(familyPrisma, prisma);
  const existing = await calendar.getEvent(id);
  if (!existing) {
    return NextResponse.json({ error: "Termin nicht gefunden." }, { status: 404 });
  }
  const conflict = writableDenial(existing);
  if (conflict) return conflict;

  await calendar.deleteEvent(id);
  return NextResponse.json({ ok: true });
}
