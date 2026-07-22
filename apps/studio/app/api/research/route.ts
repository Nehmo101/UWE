import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createJobService, createResearchService, prisma } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { dispatchJob } from "@/src/lib/job-executor";
import { getCurrentAuthUser } from "@/src/lib/auth";

export async function GET(request: Request) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const worldId = searchParams.get("worldId") ?? undefined;
  const service = createResearchService(brainPrisma);
  const sessions = await service.list(worldId);
  return NextResponse.json({
    sessions: sessions.map((session) => ({
      id: session.id,
      query: session.query,
      status: session.status,
      contextMode: session.contextMode,
      sourceCount: session.sources.length,
      createdAt: session.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const authError = await guardStudioApiMutation(request);
  if (authError) return authError;

  let body: { query?: string; worldId?: string; contextMode?: "dnd_brain" | "life_brain" | "open_web" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError("Ungültiger JSON-Body.", 400);
  }

  if (!body.query?.trim()) {
    return jsonError("query ist erforderlich.", 400);
  }

  try {
    const service = createResearchService(brainPrisma);
    const session = await service.start({
      query: body.query,
      worldId: body.worldId,
      contextMode: body.contextMode,
    });

    const actor = await getCurrentAuthUser();
    const jobs = createJobService(prisma);
    const job = await jobs.enqueue({
      type: "research",
      title: `Research — ${session.query.slice(0, 60)}`,
      worldId: body.worldId ?? null,
      userId: actor?.id ?? null,
      payload: { sessionId: session.id },
      relatedType: "research_session",
      relatedId: session.id,
    });
    void dispatchJob(job.id);

    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        query: session.query,
      },
      jobId: job.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Start fehlgeschlagen." },
      { status: 400 },
    );
  }
}
