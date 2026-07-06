import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createInferenceEndpointService, prisma } from "@uwe/database/server";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const { id } = await context.params;
  const service = createInferenceEndpointService(prisma);
  const deleted = await service.delete(id);
  if (!deleted) {
    return jsonError("Endpoint nicht gefunden.", 404);
  }
  return NextResponse.json({ ok: true });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const { id } = await context.params;
  const service = createInferenceEndpointService(prisma);
  const result = await service.probe(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
