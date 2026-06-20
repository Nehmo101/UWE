import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PRIVACY_RULES } from "@uwe/database/server";
import { simulateGatewayRouting } from "./simulate";

const baseConfig = {
  routingMode: "LOCAL_THEN_CLOUD" as const,
  cloudFallbackEnabled: true,
  privacyRules: { ...DEFAULT_PRIVACY_RULES },
  dailyBudgetUsd: null,
  monthlyBudgetUsd: null,
  perUserDailyBudgetUsd: null,
  updatedAt: new Date(),
};

describe("simulateGatewayRouting", () => {
  it("returns single case when routing is DISABLED", () => {
    const cases = simulateGatewayRouting({
      config: { ...baseConfig, routingMode: "DISABLED" },
      rtxOnline: true,
      cloudProviders: [],
      budgetWithinLimit: true,
      privacyFeature: "general_chat",
      privacyLevel: "CLOUD_ALLOWED",
      userCloudFallbackEnabled: true,
    });
    assert.equal(cases.length, 1);
    assert.equal(cases[0]?.id, "disabled");
  });

  it("expects cloud fallback when RTX offline and policy allows", () => {
    const cases = simulateGatewayRouting({
      config: baseConfig,
      rtxOnline: false,
      cloudProviders: [{ label: "OpenAI", hasApiKey: true, isEnabled: true }],
      budgetWithinLimit: true,
      privacyFeature: "general_chat",
      privacyLevel: "CLOUD_ALLOWED",
      userCloudFallbackEnabled: true,
      simulateRtxOffline: true,
    });
    const cloudCase = cases.find((c) => c.id === "rtx_offline_cloud");
    assert.equal(cloudCase?.passed, true);
  });

  it("blocks cloud for personal_brain privacy feature", () => {
    const cases = simulateGatewayRouting({
      config: baseConfig,
      rtxOnline: false,
      cloudProviders: [{ label: "OpenAI", hasApiKey: true, isEnabled: true }],
      budgetWithinLimit: true,
      privacyFeature: "personal_brain",
      privacyLevel: "CLOUD_ALLOWED",
      userCloudFallbackEnabled: true,
      simulateRtxOffline: true,
    });
    const privacyCase = cases.find((c) => c.id === "cloud_forbidden");
    assert.equal(privacyCase?.passed, true);
    const cloudCase = cases.find((c) => c.id === "rtx_offline_cloud");
    assert.equal(cloudCase?.passed, false);
  });
});
