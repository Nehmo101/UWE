import {
  createWebhookService,
  type PrismaClient,
  type WebhookEvent,
} from "@uwe/database/server";

/**
 * Webhook endpoints from the Command Center — replaces Studio `/admin/webhooks`
 * (Abschnitt D). The signing secret is returned once, on creation, exactly as
 * the Studio page did.
 */

export async function listWebhooks(db: PrismaClient): Promise<unknown> {
  const service = createWebhookService(db);
  const endpoints = await service.list();
  const deliveries = await service.listDeliveries({ limit: 25 });
  return { endpoints, deliveries };
}

export interface CreateWebhookBody {
  name?: string;
  url?: string;
  events?: unknown;
}

export async function createWebhook(
  db: PrismaClient,
  body: CreateWebhookBody,
): Promise<unknown> {
  const name = body.name?.trim();
  const url = body.url?.trim();
  if (!name) throw new Error("Name ist erforderlich.");
  if (!url) throw new Error("URL ist erforderlich.");
  if (!Array.isArray(body.events) || body.events.length === 0) {
    throw new Error("Mindestens ein Event ist erforderlich.");
  }

  // The service validates the URL against the SSRF allowlist itself.
  return createWebhookService(db).create({
    name,
    url,
    events: body.events.map(String) as WebhookEvent[],
  });
}

export async function deleteWebhook(
  db: PrismaClient,
  body: { id?: string },
): Promise<unknown> {
  if (!body.id) throw new Error("Webhook-ID ist erforderlich.");
  await createWebhookService(db).delete(body.id);
  return { deletedId: body.id };
}
