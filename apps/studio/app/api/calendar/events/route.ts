import { NextResponse } from "next/server";
import {
  createCalendarService,
  prisma,
} from "@uwe/database/server";
import { generateIcalCalendar } from "@uwe/calendar";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const worldId = url.searchParams.get("worldId") ?? undefined;
  const exportIcs = url.searchParams.get("export") === "ics";

  const calendar = createCalendarService(prisma);
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
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    location?: string;
    startAt?: string;
    endAt?: string;
    allDay?: boolean;
    kind?: string;
    worldId?: string;
    sessionId?: string;
  };

  if (!body.title?.trim() || !body.startAt) {
    return NextResponse.json({ error: "title und startAt sind erforderlich." }, { status: 400 });
  }

  const calendar = createCalendarService(prisma);
  const localFeed = await calendar.ensureLocalFeed();
  const event = await calendar.createEvent({
    feedId: localFeed.id,
    title: body.title,
    description: body.description ?? null,
    location: body.location ?? null,
    startAt: new Date(body.startAt),
    endAt: body.endAt ? new Date(body.endAt) : null,
    allDay: body.allDay ?? false,
    kind: (body.kind as "session" | "prep" | "personal" | "external" | "dnd") ?? "personal",
    worldId: body.worldId ?? null,
    sessionId: body.sessionId ?? null,
  });

  return NextResponse.json({ event }, { status: 201 });
}
