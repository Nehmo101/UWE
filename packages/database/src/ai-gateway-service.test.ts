import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveFeatureCategory,
  resolveRequiredPermission,
  isMasterAdminRole,
  DEFAULT_PRIVACY_RULES,
} from "./ai-gateway-service";

describe("ai-gateway-service", () => {
  it("resolveFeatureCategory maps personal_brain correctly", () => {
    assert.equal(resolveFeatureCategory({ contextMode: "personal_brain" }), "personal_brain");
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
    // W0 policy: DnD world context may go to cloud (RTX preferred, cloud fallback OK)
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
});
