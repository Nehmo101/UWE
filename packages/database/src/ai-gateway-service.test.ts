import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveFeatureCategory,
  resolveRequiredPermission,
  isMasterAdminRole,
  DEFAULT_PRIVACY_RULES, resolveFeatureModelOverride,
  AiGatewayService,
} from "./ai-gateway-service";
import type { PrismaClient } from "./client";

describe("ai-gateway-service", () => {
  it("resolveFeatureCategory maps personal_brain correctly", () => {
    assert.equal(resolveFeatureCategory({ contextMode: "personal_brain" }), "personal_brain");
  });

  it("resolveFeatureModelOverride returns configured override", () => {
    assert.deepEqual(resolveFeatureModelOverride({ featureModels: { dnd_world: { providerId: "openai", model: "gpt-4o" } } }, "dnd_world"), { providerId: "openai", model: "gpt-4o" });
  });

  it("resolveFeatureCategory maps general_chat correctly", () => {
    assert.equal(resolveFeatureCategory({ contextMode: "general_chat" }), "general_chat");
  });

  it("resolveFeatureCategory maps dnd brain modes", () => {
    assert.equal(resolveFeatureCategory({ contextMode: "brain" }), "dnd_world");
    assert.equal(resolveFeatureCategory({ contextMode: "current_object" }), "dnd_world");
  });

  it("resolveRequiredPermission returns AI_CHAT_USE for general chat", () => {
    assert.equal(
      resolveRequiredPermission({ contextMode: "general_chat" }),
      "AI_CHAT_USE",
    );
  });

  it("resolveRequiredPermission returns AI_DND_USE for brain", () => {
    assert.equal(resolveRequiredPermission({ contextMode: "brain" }), "AI_DND_USE");
  });

  it("isMasterAdminRole accepts only owner", () => {
    assert.equal(isMasterAdminRole("owner"), true);
    assert.equal(isMasterAdminRole("admin"), false);
    assert.equal(isMasterAdminRole("dm"), false);
  });

  it("DEFAULT_PRIVACY_RULES reflects W0 policy: dnd_world CLOUD_ALLOWED, personal_brain hard-blocked", () => {
    // W0 policy: DnD world context may go to cloud (Maschinenraum preferred, cloud fallback OK)
    assert.equal(DEFAULT_PRIVACY_RULES.dnd_world, "CLOUD_ALLOWED");
    // personal_brain remains permanently CLOUD_FORBIDDEN — not configurable
    assert.equal(DEFAULT_PRIVACY_RULES.personal_brain, "CLOUD_FORBIDDEN");
    assert.equal(DEFAULT_PRIVACY_RULES.private_notes, "CLOUD_FORBIDDEN");
    assert.equal(DEFAULT_PRIVACY_RULES.general_chat, "CLOUD_ALLOWED");
  });

  it("resolveRequiredPermission maps brain context to AI_DND_USE", () => {
    assert.equal(resolveRequiredPermission({ contextMode: "brain" }), "AI_DND_USE");
    assert.equal(resolveRequiredPermission({ contextMode: "personal_brain" }), "AI_KNOWLEDGE_USE");
  });

  it("resolveRequiredPermission maps image feature to AI_IMAGE_USE", () => {
    assert.equal(resolveRequiredPermission({ feature: "AI_IMAGE_USE" }), "AI_IMAGE_USE");
  });

  it("resolveFeatureCategory maps image feature", () => {
    assert.equal(resolveFeatureCategory({ feature: "AI_IMAGE_USE" }), "image_generation");
  });

  it("getConfig forces personal_brain to CLOUD_FORBIDDEN even for a tampered DB row", async () => {
    const tamperedDb = {
      aiGatewayConfig: {
        findUnique: async () => ({
          id: "default",
          routingMode: "LOCAL_THEN_CLOUD",
          cloudFallbackEnabled: true,
          privacyRules: {
            personal_brain: "CLOUD_ALLOWED",
            private_notes: "CLOUD_ALLOWED",
            dnd_world: "LOCAL_REQUIRED",
          },
          featureModels: {},
          dailyBudgetUsd: null,
          monthlyBudgetUsd: null,
          perUserDailyBudgetUsd: null,
          updatedAt: new Date(),
        }),
      },
    } as unknown as PrismaClient;

    const service = new AiGatewayService(tamperedDb, "test-encryption-secret");
    const config = await service.getConfig();

    assert.equal(config.privacyRules.personal_brain, "CLOUD_FORBIDDEN");
    // Other categories remain configurable via the stored row.
    assert.equal(config.privacyRules.private_notes, "CLOUD_ALLOWED");
    assert.equal(config.privacyRules.dnd_world, "LOCAL_REQUIRED");
  });
});
