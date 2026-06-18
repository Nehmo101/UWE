import { NextResponse } from "next/server";
import { createWebhookService, prisma, type WebhookEvent } from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";
import { requireAdminAccess } from "@/src/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const authContext = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, authContext, {
    rateLimit: "setup",
    requiredScopes: ["webhooks_manage"],
  });
  if (authError) return authError;

  const user = authContext.user ?? (await requireAdminAccess());
  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    url?: string;
    events?: WebhookEvent[];
    isActive?: boolean;
  };

  try {
    const service = createWebhookService(prisma);
    const updated = await service.update(id, body, user.id);
    return NextResponse.json({ endpoint: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authContext = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, authContext, {
    rateLimit: "setup",
    requiredScopes: ["webhooks_manage"],
  });
  if (authError) return authError;

  const user = authContext.user ?? (await requireAdminAccess());
  const { id } = await context.params;
  const service = createWebhookService(prisma);
  await service.delete(id, user.id);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, context: RouteContext) {
  const authContext = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, authContext, {
    rateLimit: "setup",
    requiredScopes: ["webhooks_manage"],
  });
  if (authError) return authError;

  const { id } = await context.params;
  const service = createWebhookService(prisma);
  await service.deliver("webhook.test", { endpointId: id, test: true });
  return NextResponse.json({ ok: true });
}
