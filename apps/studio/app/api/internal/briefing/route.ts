import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { requirePrivateHealthAuth } from "@/src/lib/private-health-auth";
import { enqueueAndDispatch } from "@/src/lib/job-executor";

/**
 * Interner Trigger für das Morning Briefing — für den systemd-Timer
 * `uwe-briefing.timer`. Guard: `STUDIO_API_TOKEN` per Bearer (wie der private
 * Healthcheck), NICHT für Browser gedacht. Der Job läuft über
 * `enqueueAndDispatch` im laufenden Server-Prozess (dispatchJob ist in-process)
 * und wird dem ersten aktiven Owner/Admin zugeordnet (oder `UWE_BRIEFING_USER_ID`).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const authError = requirePrivateHealthAuth(request);
  if (authError) return authError;

  const userId = await resolveBriefingUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Kein aktiver Owner/Admin-Benutzer für das Briefing gefunden." },
      { status: 409 },
    );
  }

  const job = await enqueueAndDispatch({
    type: "briefing",
    title: "Morning Briefing (automatisch)",
    userId,
    payload: {},
  });

  return NextResponse.json({ jobId: job.id, status: job.status, userId });
}

async function resolveBriefingUserId(): Promise<string | null> {
  const configured = process.env.UWE_BRIEFING_USER_ID?.trim();
  if (configured) {
    const found = await prisma.user.findUnique({
      where: { id: configured },
      select: { id: true },
    });
    if (found) return found.id;
  }

  const fallback = await prisma.user.findFirst({
    where: { isOwner: true, status: "active" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return fallback?.id ?? null;
}
