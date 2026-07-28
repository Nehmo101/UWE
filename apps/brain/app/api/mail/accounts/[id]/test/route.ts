import { NextResponse } from "next/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { brainPrisma } from "@uwe/database/brain-client";
import { requireBrainMailMutation } from "@/src/lib/mail-api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireBrainMailMutation(request);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const service = createMailPortalService(brainPrisma);
  const result = await service.testConnection(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
