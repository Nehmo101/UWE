import { NextResponse } from "next/server";
import {
  createCalendarService,
  createJobService,
  prisma,
} from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";
import { dispatchJob } from "@/src/lib/job-executor";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const calendar = createCalendarService(prisma);
  const feeds = await calendar.listFeeds(true);
  return NextResponse.json({ feeds });
}

export async function POST(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const body = (await request.json()) as {
    name?: string;
    type?: "local" | "caldav" | "ical_url" | "familywall";
    url?: string;
    caldavUrl?: string;
    username?: string;
    enabled?: boolean;
    sync?: boolean;
  };

  if (!body.name?.trim() || !body.type) {
    return NextResponse.json({ error: "name und type sind erforderlich." }, { status: 400 });
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
