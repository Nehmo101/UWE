import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDetailedHealthPayload,
  evaluatePublicHealth,
} from "./health-endpoints";
import { UWE_PRODUCT_NAME, UWE_VERSION } from "./version";
import type { PrismaClient } from "./client";

function createMockDb(healthy = true): PrismaClient {
  return {
    $queryRawUnsafe: async () => {
      if (!healthy) {
        throw new Error("db offline");
      }
      return [{ 1: 1 }];
    },
    $queryRaw: async () => [{ count: 0 }],
    world: { count: async () => 0 },
    page: { count: async () => 0 },
    systemSetting: { findMany: async () => [] },
    seedHistory: { findUnique: async () => null },
    _migration: { findMany: async () => [] },
  } as unknown as PrismaClient;
}

describe("health endpoints", () => {
  it("public health returns only ok or degraded", async () => {
    const ok = await evaluatePublicHealth(createMockDb(true));
    assert.equal(ok.ok, true);
    assert.equal(ok.body, "ok");

    const degraded = await evaluatePublicHealth(createMockDb(false));
    assert.equal(degraded.ok, false);
    assert.equal(degraded.body, "degraded");
  });

  it("detailed health includes operational fields without secrets", async () => {
    const { payload } = await buildDetailedHealthPayload(createMockDb(true), {
      appName: "UWE Studio",
      rateLimiterMode: "test",
    });

    assert.equal(payload.app.name, "UWE Studio");
    assert.equal(payload.app.product, UWE_PRODUCT_NAME);
    assert.match(payload.app.version, /^\d+\.\d+\.\d+$/);
    assert.ok(payload.checks.database);
    assert.ok(payload.checks.storage);
    assert.ok(payload.trust);
    assert.equal(typeof payload.trust?.studioApiTokenConfigured, "boolean");
    assert.equal(typeof payload.trust?.authSecretConfigured, "boolean");
    assert.ok(!JSON.stringify(payload).includes("AUTH_SECRET"));
    assert.ok(!JSON.stringify(payload).includes("STUDIO_API_TOKEN"));
  });
});
