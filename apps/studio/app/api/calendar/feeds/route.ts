import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  createCalendarService,
  createJobService,
  prisma,
  resolveCalendarConfig,
} from "@uwe/database/server";
import { nonEmptyString, optionalString, parseBody } from "@uwe/security";
import { dispatchJob } from "@/src/lib/job-executor";
import { z } from "zod";

const calendarFeedCreateSchema = z.object({
  name: nonEmptyString.max(200),
  type: z.enum(["local", "caldav", "ical_url", "familywall"]),
  url: optionalString,
  caldavUrl: optionalString,
  username: optionalString,
  enabled: z.boolean().optional(),
  sync: z.boolean().optional(),
});

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const calendar = createCalendarService(prisma);
  const feeds = await calendar.listFeeds(true);
  return NextResponse.json({ feeds });
}

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request);
  if (authError) return authError;

  const calConfig = resolveCalendarConfig();
  if (!calConfig.enabled) {
    return jsonError("Kalender ist deaktiviert.", 403);
  }

  const parsed = await parseBody(request, calendarFeedCreateSchema);
  if (!parsed.success) return parsed.response;

  const body = parsed.data;
  if (body.type === "caldav" && !calConfig.caldavEnabled) {
    return NextResponse.json(
      { error: "CalDAV ist deaktiviert. Setze CALENDAR_CALDAV_ENABLED=true." },
      { status: 403 },
    );
  }
  if (body.type === "familywall" && !calConfig.familywallEnabled) {
    return jsonError("FamilyWall-Feeds sind deaktiviert.", 403);
  }

  const calendar = createCalendarService(prisma);
  const feed = await calendar.createFeed({
    name: body.name,
    type: body.type,
    url: body.url ?? null,
    caldavUrl: body.caldavUrl ?? null,
    username: body.username ?? null,
    enabled: body.enabled ?? true,
    direction: body.type === "local" ? "read_write" : "read_only",
  });

  if (body.sync && body.type !== "local") {
    const jobs = createJobService(prisma);
    const job = await jobs.enqueue({
      type: "calendar_sync",
      title: `Kalender-Sync: ${feed.name}`,
      payload: { feedId: feed.id },
    });
    void dispatchJob(job.id);
  }

  return NextResponse.json({ feed }, { status: 201 });
}
