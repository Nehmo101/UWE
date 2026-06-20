import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@uwe/database/server";
import {
  AiGatewayAccessDeniedError,
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
  it("player without grant is denied", async () => {
    const service = new AiGatewayService(createMockGatewayDb({ grant: null }));

    await assert.rejects(
      () =>
        service.assertFeatureAccess({
          userId: "player-1",
          role: "player",
          feature: "AI_CHAT_USE",
          contextMode: "general_chat",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AiGatewayAccessDeniedError);
        return true;
      },
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

  it("player with grant but wrong permission is denied", async () => {
    const service = new AiGatewayService(
      createMockGatewayDb({
        grant: {
          userId: "player-3",
          permissions: ["AI_CHAT_USE"],
          cloudFallbackAllowed: false,
        },
      }),
    );

    await assert.rejects(
      () =>
        service.assertFeatureAccess({
          userId: "player-3",
          role: "player",
          feature: "AI_DND_USE",
          contextMode: "brain",
        }),
      AiGatewayAccessDeniedError,
    );
  });

  it("createAiGatewayService accepts mock db", () => {
    const service = createAiGatewayService(createMockGatewayDb());
    assert.ok(service instanceof AiGatewayService);
  });
});
