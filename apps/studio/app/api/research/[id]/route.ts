import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createResearchService, prisma } from "@uwe/database/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const { id } = await context.params;
  const service = createResearchService(prisma);
  const session = await service.get(id);
  if (!session) {
    return jsonError("Nicht gefunden.", 404);
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
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const { id } = await context.params;
  const service = createResearchService(prisma);
  await service.cancel(id);
  return NextResponse.json({ ok: true });
}
