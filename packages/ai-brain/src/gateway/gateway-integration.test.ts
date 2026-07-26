import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@uwe/database/server";
import {
  AiGatewayService,
  createAiGatewayService,
} from "@uwe/database/server";

function createMockGatewayDb(overrides?: {
  routingMode?: string;
  grant?: { userId: string; permissions: string[]; cloudFallbackAllowed: boolean } | null;
}): PrismaClient {
  const config = {
    id: "default",
    routingMode: overrides?.routingMode ?? "LOCAL_THEN_CLOUD",
    cloudFallbackEnabled: true,
    privacyRules: {
      general_chat: "CLOUD_ALLOWED",
      dnd_world: "CLOUD_FORBIDDEN",
      personal_brain: "CLOUD_FORBIDDEN",
      private_notes: "CLOUD_FORBIDDEN",
      admin_diagnostics: "CLOUD_ALLOWED",
      image_generation: "CLOUD_ALLOWED",
    },
    dailyBudgetUsd: null,
    monthlyBudgetUsd: null,
    perUserDailyBudgetUsd: null,
    updatedAt: new Date(),
  };

  const grant = overrides?.grant ?? null;

  return {
    aiGatewayConfig: {
      findUnique: async () => config,
      upsert: async () => config,
    },
    aiUserGrant: {
      findUnique: async ({ where }: { where: { userId: string } }) =>
        grant && grant.userId === where.userId
          ? {
              id: "grant-1",
              userId: grant.userId,
              permissions: grant.permissions,
              cloudFallbackAllowed: grant.cloudFallbackAllowed,
              dailyBudgetUsd: null,
              grantedBy: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              user: { displayName: "Test Player", email: "player@test.local" },
            }
          : null,
      findMany: async () => [],
      upsert: async () => {
        throw new Error("not implemented");
      },
      deleteMany: async () => ({ count: 0 }),
    },
    aiCloudProvider: {
      findMany: async () => [],
      findUnique: async () => null,
      upsert: async () => {
        throw new Error("not implemented");
      },
      deleteMany: async () => ({ count: 0 }),
    },
    aiUsageLog: {
      create: async () => ({ id: "log-1" }),
      findMany: async () => [],
      aggregate: async () => ({ _sum: { estimatedCostUsd: null } }),
    },
  } as unknown as PrismaClient;
}

describe("ai gateway integration", () => {
  it("allows a player without a grant — per-user AI grants were removed with the cloud budget", async () => {
    const gateway = createAiGatewayService(createMockGatewayDb());
    await assert.doesNotReject(() =>
      gateway.assertFeatureAccess({ userId: "player-1", role: "player", contextMode: "brain" }),
    );
  });

  it("player with AI_DND_USE grant passes brain feature check", async () => {
    const service = new AiGatewayService(
      createMockGatewayDb({
        grant: {
          userId: "player-2",
          permissions: ["AI_DND_USE"],
          cloudFallbackAllowed: false,
        },
      }),
    );

    await service.assertFeatureAccess({
      userId: "player-2",
      role: "player",
      feature: "AI_DND_USE",
      contextMode: "brain",
    });
  });

  it("denies everyone only when AI is switched off system-wide", async () => {
    const gateway = createAiGatewayService(createMockGatewayDb({ routingMode: "DISABLED" }));
    await assert.rejects(() =>
      gateway.assertFeatureAccess({ userId: "player-1", role: "player", contextMode: "brain" }),
    );
  });

  it("createAiGatewayService accepts mock db", () => {
    const service = createAiGatewayService(createMockGatewayDb());
    assert.ok(service instanceof AiGatewayService);
  });
});
