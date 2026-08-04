import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { familyPrisma } from "@uwe/database/family-client";
import {
  createCalendarService,
  prisma,
} from "@uwe/database/server";
import { generateIcalCalendar } from "@uwe/calendar";
import { idSchema, nonEmptyString, optionalString, parseBody } from "@uwe/security";
import { z } from "zod";

const calendarEventCreateSchema = z.object({
  title: nonEmptyString.max(500),
  description: optionalString,
  location: optionalString,
  startAt: nonEmptyString.max(100),
  endAt: optionalString,
  allDay: z.boolean().optional(),
  kind: z.enum(["session", "prep", "personal", "external", "dnd"]).optional(),
  worldId: idSchema.optional().nullable(),
  sessionId: idSchema.optional().nullable(),
});

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const worldId = url.searchParams.get("worldId") ?? undefined;
  const exportIcs = url.searchParams.get("export") === "ics";

  const calendar = createCalendarService(familyPrisma, prisma);
  const events = await calendar.listEvents({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    worldId,
  });

  if (exportIcs) {
    const ics = generateIcalCalendar(
      events.map((e) => ({
        uid: e.externalUid ?? e.id,
        title: e.title,
        description: e.description,
        location: e.location,
        startAt: e.startAt,
        endAt: e.endAt,
        allDay: e.allDay,
      })),
    );
    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="uwe-calendar.ics"',
      },
    });
  }

  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsed = await parseBody(request, calendarEventCreateSchema);
  if (!parsed.success) return parsed.response;

  const body = parsed.data;
  const calendar = createCalendarService(familyPrisma, prisma);
  const localFeed = await calendar.ensureLocalFeed();
  const event = await calendar.createEvent({
    feedId: localFeed.id,
    title: body.title,
    description: body.description ?? null,
    location: body.location ?? null,
    startAt: new Date(body.startAt),
    endAt: body.endAt ? new Date(body.endAt) : null,
    allDay: body.allDay ?? false,
    kind: body.kind ?? "personal",
    worldId: body.worldId ?? null,
    sessionId: body.sessionId ?? null,
  });

  return NextResponse.json({ event }, { status: 201 });
}
