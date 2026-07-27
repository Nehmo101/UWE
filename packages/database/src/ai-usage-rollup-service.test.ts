import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import {
  buildAiUsageContractName,
  createAiUsageRollupService,
  resolveAiUsagePeriodBounds,
  usdToEuroCents,
} from "./ai-usage-rollup-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("ai usage rollup service", () => {
  let db: PrismaClient;
  let service: ReturnType<typeof createAiUsageRollupService>;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
    service = createAiUsageRollupService(db);
  });

  it("resolves current month bounds", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const bounds = resolveAiUsagePeriodBounds("current_month", now);
    assert.equal(bounds.periodLabel, "2026-06");
    assert.equal(bounds.since.toISOString(), "2026-06-01T00:00:00.000Z");
    assert.equal(bounds.until.toISOString(), "2026-07-01T00:00:00.000Z");
  });

  it("aggregates usage by feature and user", async () => {
    const user = await db.user.create({
      data: {
        displayName: "Rollup Tester",
        email: "rollup@test.local",
        passwordHash: "test",
        portalAccess: true,
        studioAccess: true,
      },
    });

    const monthStart = new Date("2026-06-01T00:00:00.000Z");
    await db.aiUsageLog.createMany({
      data: [
        {
          userId: user.id,
          feature: "dnd_generator",
          provider: "openai",
          model: "gpt-4o-mini",
          route: "cloud",
          inputTokens: 100,
          outputTokens: 50,
          estimatedCostUsd: 0.01,
          success: true,
          createdAt: new Date("2026-06-10T10:00:00.000Z"),
        },
        {
          userId: user.id,
          feature: "general_chat",
          provider: "openai",
          model: "gpt-4o-mini",
          route: "cloud",
          inputTokens: 200,
          outputTokens: 80,
          estimatedCostUsd: 0.02,
          success: true,
          createdAt: new Date("2026-06-12T10:00:00.000Z"),
        },
        {
          userId: user.id,
          feature: "general_chat",
          provider: "local",
          model: "llama",
          route: "local_rtx",
          inputTokens: 300,
          outputTokens: 120,
          estimatedCostUsd: 0,
          success: true,
          createdAt: new Date("2026-06-12T11:00:00.000Z"),
        },
        {
          userId: user.id,
          feature: "failed_call",
          provider: "openai",
          model: "gpt-4o-mini",
          route: "cloud",
          inputTokens: 10,
          outputTokens: 0,
          estimatedCostUsd: 0.001,
          success: false,
          createdAt: new Date("2026-06-12T12:00:00.000Z"),
        },
      ],
    });

    const summary = await service.getRollupSummary({
      since: monthStart,
      until: new Date("2026-07-01T00:00:00.000Z"),
    });

    assert.equal(summary.requestCount, 3);
    assert.equal(summary.inputTokens, 600);
    assert.equal(summary.outputTokens, 250);
    assert.equal(summary.estimatedCostUsd, 0.03);
    assert.equal(summary.byFeature.length, 2);
    assert.equal(summary.byFeature[0]?.feature, "general_chat");
    assert.equal(summary.byFeature[0]?.requestCount, 2);
    assert.equal(summary.byUser.length, 1);
    assert.equal(summary.byUser[0]?.userDisplayName, "Rollup Tester");
    assert.equal(summary.byUser[0]?.estimatedCostUsd, 0.03);

    await db.aiUsageLog.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  });

  it("builds contract names and converts USD to EUR cents", () => {
    assert.equal(buildAiUsageContractName("2026-06"), "KI-Nutzung (2026-06)");
    assert.equal(usdToEuroCents(1.25, 0.8), 100);
  });
});
