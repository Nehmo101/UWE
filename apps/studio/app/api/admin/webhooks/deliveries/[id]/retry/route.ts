import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { createWebhookService, prisma } from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";
import { requireAdminAccess } from "@/src/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const authContext = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, authContext, {
    rateLimit: "setup",
    requiredScopes: ["webhooks_manage"],
  });
  if (authError) return authError;

  const user = authContext.user ?? (await requireAdminAccess());
  const { id } = await context.params;

  try {
    const service = createWebhookService(prisma);
    await service.retryDelivery(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Retry fehlgeschlagen.";
    return jsonError(message, 400);
  }
}
