import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { createMailPortalService } from "@uwe/mail/portal";
import { requireAdminMailMutation } from "@/src/lib/admin-mail-api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminMailMutation(request);
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const service = createMailPortalService(prisma);
  const result = await service.testConnection(id);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
