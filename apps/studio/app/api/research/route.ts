import { NextResponse } from "next/server";
import { createResearchService, prisma } from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const worldId = searchParams.get("worldId") ?? undefined;
  const service = createResearchService(prisma);
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
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  let body: { query?: string; worldId?: string; contextMode?: "dnd_brain" | "life_brain" | "open_web" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  if (!body.query?.trim()) {
    return NextResponse.json({ error: "query ist erforderlich." }, { status: 400 });
  }

  try {
    const service = createResearchService(prisma);
    const session = await service.start({
      query: body.query,
      worldId: body.worldId,
      contextMode: body.contextMode,
    });
    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        query: session.query,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Start fehlgeschlagen." },
      { status: 400 },
    );
  }
}
