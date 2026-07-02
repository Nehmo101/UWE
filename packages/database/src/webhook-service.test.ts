import { describe, it, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createPrismaClient, type PrismaClient } from "./client";
import { createWebhookService } from "./webhook-service";
import { createTestDatabaseUrl } from "./test-helpers";

const originalFetch = globalThis.fetch;

describe("webhook-service", () => {
  let db: PrismaClient;

  before(() => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("creates an endpoint with a one-time plaintext secret", async () => {
    const service = createWebhookService(db);
    const result = await service.create({
      name: "CI Hook",
      url: "https://hooks.example.com/uwe",
      events: ["backup.created"],
    });

    assert.equal(result.endpoint.name, "CI Hook");
    assert.equal(result.endpoint.url, "https://hooks.example.com/uwe");
    assert.deepEqual(result.endpoint.events, ["backup.created"]);
    assert.equal(result.endpoint.isActive, true);
    assert.ok(result.plaintextSecret.length > 10);
    assert.equal(result.endpoint.secretPrefix, result.plaintextSecret.slice(0, 10));

    const listed = await service.list();
    assert.ok(listed.some((endpoint) => endpoint.id === result.endpoint.id));
  });

  it("rejects private or internal webhook URLs", async () => {
    const service = createWebhookService(db);

    await assert.rejects(
      service.create({
        name: "Local Hook",
        url: "http://localhost:3000/hook",
        events: ["backup.created"],
      }),
      /private oder interne/,
    );

    await assert.rejects(
      service.create({
        name: "LAN Hook",
        url: "http://192.168.1.10/hook",
        events: ["backup.created"],
      }),
      /private oder interne/,
    );
  });

  it("updates and deletes endpoints", async () => {
    const service = createWebhookService(db);
    const { endpoint } = await service.create({
      name: "Temp Hook",
      url: "https://hooks.example.com/temp",
      events: ["import.completed"],
    });

    const updated = await service.update(endpoint.id, {
      name: "Renamed Hook",
      isActive: false,
      events: ["import.failed"],
    });
    assert.equal(updated.name, "Renamed Hook");
    assert.equal(updated.isActive, false);
    assert.deepEqual(updated.events, ["import.failed"]);

    await service.delete(endpoint.id);
    const listed = await service.list();
    assert.equal(
      listed.some((entry) => entry.id === endpoint.id),
      false,
    );
  });

  it("delivers only to active endpoints subscribed to the event and records success", async () => {
    const service = createWebhookService(db);
    const subscribed = await service.create({
      name: "Subscribed",
      url: "https://hooks.example.com/subscribed",
      events: ["content.published"],
    });
    const other = await service.create({
      name: "Other Events",
      url: "https://hooks.example.com/other",
      events: ["backup.created"],
    });

    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        headers: (init?.headers ?? {}) as Record<string, string>,
      });
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    await service.deliver("content.published", { pageId: "p1" });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "https://hooks.example.com/subscribed");
    assert.equal(calls[0]!.headers["X-UWE-Event"], "content.published");

    const deliveries = await db.webhookDelivery.findMany({
      where: { endpointId: subscribed.endpoint.id },
    });
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0]!.success, true);
    assert.equal(deliveries[0]!.statusCode, 200);

    const skipped = await db.webhookDelivery.findMany({
      where: { endpointId: other.endpoint.id },
    });
    assert.equal(skipped.length, 0);
  });

  it("records a failed delivery when the endpoint is unreachable", async () => {
    const service = createWebhookService(db);
    const { endpoint } = await service.create({
      name: "Failing Hook",
      url: "https://hooks.example.com/failing",
      events: ["ai.run.completed"],
    });

    globalThis.fetch = (async () => {
      throw new Error("connection refused");
    }) as typeof fetch;

    await service.deliver("ai.run.completed", { runId: "r1" });

    const deliveries = await db.webhookDelivery.findMany({
      where: { endpointId: endpoint.id },
    });
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0]!.success, false);
    assert.match(deliveries[0]!.errorMessage ?? "", /connection refused/);
  });
});
