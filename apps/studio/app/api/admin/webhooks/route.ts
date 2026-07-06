import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  WEBHOOK_EVENTS,
  createWebhookService,
  prisma,
  type WebhookEvent,
} from "@uwe/database/server";
import { requireAdminApiAuth } from "@uwe/security";
import { resolveStudioApiAuthContext } from "@/src/lib/studio-admin-auth";
import { requireAdminAccess } from "@/src/lib/auth";

export async function GET(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["webhooks_manage"],
  });
  if (authError) return authError;

  const service = createWebhookService(prisma);
  const endpoints = await service.list();

  return NextResponse.json({
    endpoints,
    availableEvents: WEBHOOK_EVENTS,
  });
}

export async function POST(request: Request) {
  const context = await resolveStudioApiAuthContext(request);
  const authError = requireAdminApiAuth(request, context, {
    rateLimit: "setup",
    requiredScopes: ["webhooks_manage"],
  });
  if (authError) return authError;

  const user = context.user ?? (await requireAdminAccess());
  const body = (await request.json()) as {
    name?: string;
    url?: string;
    events?: WebhookEvent[];
  };

  if (!body.name?.trim() || !body.url?.trim()) {
    return jsonError("Name und URL sind erforderlich.", 400);
  }

  const events = (body.events ?? []).filter((event): event is WebhookEvent =>
    (WEBHOOK_EVENTS as readonly string[]).includes(event),
  );

  if (events.length === 0) {
    return jsonError("Mindestens ein Event erforderlich.", 400);
  }

  try {
    const service = createWebhookService(prisma);
    const created = await service.create({
      name: body.name.trim(),
      url: body.url.trim(),
      events,
      createdById: user.id,
    });

    return NextResponse.json({
      endpoint: created.endpoint,
      plaintextSecret: created.plaintextSecret,
      warning: "Webhook-Secret wird nur einmal angezeigt.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook konnte nicht erstellt werden.";
    return jsonError(message, 400);
  }
}
