import { NextResponse } from "next/server";
import { createInferenceEndpointService, prisma } from "@uwe/database/server";
import { requireStudioApiAuth } from "@/src/lib/studio-api-auth";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const service = createInferenceEndpointService(prisma);
  const deleted = await service.delete(id);
  if (!deleted) {
    return NextResponse.json({ error: "Endpoint nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authError = requireStudioApiAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const service = createInferenceEndpointService(prisma);
  const result = await service.probe(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
