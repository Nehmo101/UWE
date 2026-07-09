import { createHash } from "node:crypto";
import type { PrismaClient } from "./client";
import {
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  generateWebhookSecret,
  signWebhookPayload,
  verifyWebhookSignature,
} from "@uwe/auth/server";
import { assertWebhookUrlAllowed } from "./webhook-url-guard";
import { decryptSecret, encryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";
import { logAuditEvent } from "./audit-log-service";
import { parseStringArray } from "./json-utils";

function parseEventsJson(value: string): WebhookEvent[] {
  try {
    return parseStringArray(JSON.parse(value)) as WebhookEvent[];
  } catch {
    return [];
  }
}

export const WEBHOOK_EVENTS = [
  "backup.created",
  "import.completed",
  "import.failed",
  "ai.run.completed",
  "content.published",
  "webhook.test",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookEndpointView {
  id: string;
  name: string;
  url: string;
  secretPrefix: string;
  events: WebhookEvent[];
  isActive: boolean;
  lastTriggeredAt: Date | null;
  createdAt: Date;
}

export interface WebhookDeliveryView {
  id: string;
  endpointId: string;
  endpointName: string;
  event: string;
  statusCode: number | null;
  success: boolean;
  errorMessage: string | null;
  attemptCount: number;
  createdAt: Date;
  completedAt: Date | null;
}

export interface CreateWebhookInput {
  name: string;
  url: string;
  events: WebhookEvent[];
  createdById?: string | null;
}

export interface CreateWebhookResult {
  endpoint: WebhookEndpointView;
  /** Plaintext signing secret — shown once. */
  plaintextSecret: string;
}

export class WebhookService {
  private readonly encryptionSecret: string;

  constructor(private readonly db: PrismaClient) {
    this.encryptionSecret = resolveTokenEncryptionSecret();
  }

  async list(): Promise<WebhookEndpointView[]> {
    const endpoints = await this.db.webhookEndpoint.findMany({
      orderBy: { createdAt: "desc" },
    });
    return endpoints.map((endpoint) => this.toView(endpoint));
  }

  async listDeliveries(options: {
    endpointId?: string;
    failedOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ deliveries: WebhookDeliveryView[]; total: number }> {
    const where = {
      ...(options.endpointId ? { endpointId: options.endpointId } : {}),
      ...(options.failedOnly ? { success: false } : {}),
    };
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const [rows, total] = await Promise.all([
      this.db.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: { endpoint: { select: { name: true } } },
      }),
      this.db.webhookDelivery.count({ where }),
    ]);

    return {
      deliveries: rows.map((row) => ({
        id: row.id,
        endpointId: row.endpointId,
        endpointName: row.endpoint.name,
        event: row.event,
        statusCode: row.statusCode,
        success: row.success,
        errorMessage: row.errorMessage,
        attemptCount: row.attemptCount,
        createdAt: row.createdAt,
        completedAt: row.completedAt,
      })),
      total,
    };
  }

  async create(input: CreateWebhookInput): Promise<CreateWebhookResult> {
    await assertWebhookUrlAllowed(input.url);

    const plaintextSecret = generateWebhookSecret();
    const secretEncrypted = encryptSecret(plaintextSecret, this.encryptionSecret);
    const secretPrefix = plaintextSecret.slice(0, 10);

    const created = await this.db.webhookEndpoint.create({
      data: {
        name: input.name.trim(),
        url: input.url.trim(),
        secretEncrypted,
        secretPrefix,
        eventsJson: JSON.stringify(input.events),
        createdById: input.createdById ?? null,
      },
    });

    await logAuditEvent(this.db, {
      actorUserId: input.createdById ?? null,
      action: "webhook_created",
      targetType: "webhook_endpoint",
      targetId: created.id,
      metadata: { name: input.name, events: input.events },
    });

    return {
      endpoint: this.toView(created),
      plaintextSecret,
    };
  }

  async update(
    endpointId: string,
    input: Partial<Pick<CreateWebhookInput, "name" | "url" | "events">> & { isActive?: boolean },
    actorUserId?: string | null,
  ): Promise<WebhookEndpointView> {
    if (input.url) {
      await assertWebhookUrlAllowed(input.url);
    }

    const updated = await this.db.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.url ? { url: input.url.trim() } : {}),
        ...(input.events ? { eventsJson: JSON.stringify(input.events) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await logAuditEvent(this.db, {
      actorUserId: actorUserId ?? null,
      action: "webhook_updated",
      targetType: "webhook_endpoint",
      targetId: endpointId,
    });

    return this.toView(updated);
  }

  async delete(endpointId: string, actorUserId?: string | null): Promise<void> {
    await this.db.webhookEndpoint.delete({ where: { id: endpointId } });

    await logAuditEvent(this.db, {
      actorUserId: actorUserId ?? null,
      action: "webhook_deleted",
      targetType: "webhook_endpoint",
      targetId: endpointId,
    });
  }

  async deliver(event: WebhookEvent, payload: Record<string, unknown>): Promise<void> {
    const endpoints = await this.db.webhookEndpoint.findMany({
      where: { isActive: true },
    });

    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    const payloadHash = createHash("sha256").update(body).digest("hex").slice(0, 32);

    for (const endpoint of endpoints) {
      const events = parseEventsJson(endpoint.eventsJson);
      if (!events.includes(event) && event !== "webhook.test") {
        continue;
      }

      await this.deliverToEndpoint(endpoint, event, body, payloadHash);
    }
  }

  async retryDelivery(deliveryId: string, actorUserId?: string | null): Promise<void> {
    const delivery = await this.db.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: true },
    });
    if (!delivery) {
      throw new Error("Delivery nicht gefunden.");
    }
    if (delivery.success) {
      throw new Error("Nur fehlgeschlagene Deliveries können wiederholt werden.");
    }

    const event = delivery.event as WebhookEvent;
    const body = JSON.stringify({
      event,
      payload: {
        retry: true,
        retryOf: deliveryId,
        originalEvent: delivery.event,
      },
      timestamp: new Date().toISOString(),
    });
    const payloadHash = createHash("sha256").update(body).digest("hex").slice(0, 32);

    await this.deliverToEndpoint(delivery.endpoint, event, body, payloadHash, actorUserId);
  }

  private async deliverToEndpoint(
    endpoint: {
      id: string;
      url: string;
      secretEncrypted: string;
      eventsJson: string;
    },
    event: WebhookEvent,
    body: string,
    payloadHash: string,
    actorUserId?: string | null,
  ): Promise<void> {
    const delivery = await this.db.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        event,
        payloadHash,
      },
    });

    try {
      await assertWebhookUrlAllowed(endpoint.url);
      const secret = decryptSecret(endpoint.secretEncrypted, this.encryptionSecret);
      const timestamp = String(Date.now());
      const signature = signWebhookPayload(secret, timestamp, body);

      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [WEBHOOK_SIGNATURE_HEADER]: signature,
          [WEBHOOK_TIMESTAMP_HEADER]: timestamp,
          "X-UWE-Event": event,
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      const success = response.ok;
      await this.db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          success,
          statusCode: response.status,
          completedAt: new Date(),
          errorMessage: success ? null : `HTTP ${response.status}`,
        },
      });

      await this.db.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: {
          lastTriggeredAt: new Date(),
        },
      });

      await logAuditEvent(this.db, {
        actorUserId: actorUserId ?? null,
        action: success ? "webhook_delivered" : "webhook_failed",
        targetType: "webhook_delivery",
        targetId: delivery.id,
        metadata: { event, statusCode: response.status },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delivery failed";
      await this.db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          success: false,
          errorMessage: message.slice(0, 200),
          completedAt: new Date(),
        },
      });

      await logAuditEvent(this.db, {
        actorUserId: actorUserId ?? null,
        action: "webhook_failed",
        targetType: "webhook_delivery",
        targetId: delivery.id,
        metadata: { event, error: message.slice(0, 100) },
      });
    }
  }

  verifyInboundSignature(
    secret: string,
    timestamp: string,
    body: string,
    signature: string,
  ): boolean {
    return verifyWebhookSignature(secret, timestamp, body, signature);
  }

  private toView(endpoint: {
    id: string;
    name: string;
    url: string;
    secretPrefix: string;
    eventsJson: string;
    isActive: boolean;
    lastTriggeredAt: Date | null;
    createdAt: Date;
  }): WebhookEndpointView {
    return {
      id: endpoint.id,
      name: endpoint.name,
      url: endpoint.url,
      secretPrefix: endpoint.secretPrefix,
      events: parseEventsJson(endpoint.eventsJson),
      isActive: endpoint.isActive,
      lastTriggeredAt: endpoint.lastTriggeredAt,
      createdAt: endpoint.createdAt,
    };
  }
}

export function createWebhookService(db: PrismaClient): WebhookService {
  return new WebhookService(db);
}
