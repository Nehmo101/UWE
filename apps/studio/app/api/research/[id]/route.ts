import { NextResponse } from "next/server";
import { createResearchService, prisma } from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const service = createResearchService(prisma);
  const session = await service.get(id);
  if (!session) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({
    session: {
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const service = createResearchService(prisma);
  await service.cancel(id);
  return NextResponse.json({ ok: true });
}
