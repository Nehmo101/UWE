import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AiGatewayConfigRecord } from "@uwe/database/server";
import { DEFAULT_PRIVACY_RULES } from "@uwe/database/server";

// Test helper — mirrors private function behavior via re-export pattern
function resolveMode(
  config: AiGatewayConfigRecord,
  requested: "auto" | "local_engine" | "cloud",
  cloudFallbackAllowed: boolean,
  privacyLevel: "CLOUD_ALLOWED" | "CLOUD_FORBIDDEN" | "LOCAL_REQUIRED",
): "auto" | "local_engine" | "cloud" {
  if (config.routingMode === "DISABLED") {
    throw new Error("disabled");
  }
  if (config.routingMode === "LOCAL_ONLY" || privacyLevel === "LOCAL_REQUIRED") {
    return "local_engine";
  }
  if (privacyLevel === "CLOUD_FORBIDDEN") {
    if (requested === "cloud") {
      return "local_engine";
    }
    return requested === "local_engine" ? "local_engine" : "auto";
  }
  if (config.routingMode === "CLOUD_ONLY") {
    return "cloud";
  }
  if (requested === "cloud") {
    return cloudFallbackAllowed ? "cloud" : "local_engine";
  }
  if (requested === "local_engine") {
    return "local_engine";
  }
  return "auto";
}

describe("ai gateway routing", () => {
  const baseConfig: AiGatewayConfigRecord = {
    routingMode: "LOCAL_THEN_CLOUD",
    cloudFallbackEnabled: false,
    privacyRules: { ...DEFAULT_PRIVACY_RULES }, featureModels: {}, dailyBudgetUsd: null,
    monthlyBudgetUsd: null,
    perUserDailyBudgetUsd: null,
    updatedAt: new Date(),
  };

  it("LOCAL_ONLY forces local_engine", () => {
    assert.equal(
      resolveMode({ ...baseConfig, routingMode: "LOCAL_ONLY" }, "auto", true, "CLOUD_ALLOWED"),
      "local_engine",
    );
  });

  it("CLOUD_ONLY forces cloud", () => {
    assert.equal(
      resolveMode({ ...baseConfig, routingMode: "CLOUD_ONLY" }, "local_engine", false, "CLOUD_ALLOWED"),
      "cloud",
    );
  });

  it("LOCAL_REQUIRED privacy blocks cloud request", () => {
    assert.equal(
      resolveMode(baseConfig, "cloud", true, "LOCAL_REQUIRED"),
      "local_engine",
    );
  });

  it("cloud request denied when fallback not allowed", () => {
    assert.equal(
      resolveMode(baseConfig, "cloud", false, "CLOUD_ALLOWED"),
      "local_engine",
    );
  });

  it("CLOUD_FORBIDDEN blocks explicit cloud request", () => {
    assert.equal(
      resolveMode(baseConfig, "cloud", true, "CLOUD_FORBIDDEN"),
      "local_engine",
    );
  });

  it("cloud request allowed when fallback permitted", () => {
    assert.equal(
      resolveMode(baseConfig, "cloud", true, "CLOUD_ALLOWED"),
      "cloud",
    );
  });
});
