import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessRtxExposure,
  assessStudioSecurity,
  classifyEndpointUrl,
} from "./studio-security";
import { getSystemStatus } from "./system-status";
import { createPrismaClient } from "./client";
import { createTestDatabaseUrl } from "./test-helpers";

describe("studio security assessment", () => {
  it("classifies endpoint URLs", () => {
    assert.equal(classifyEndpointUrl("http://localhost:11434"), "loopback");
    assert.equal(classifyEndpointUrl("http://192.168.1.50:11434"), "private");
    assert.equal(classifyEndpointUrl("https://ollama.example.com"), "public");
    assert.equal(classifyEndpointUrl("not-a-url"), "invalid");
  });

  it("reports local_only when no public exposure is configured", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    try {
      const system = await getSystemStatus(db, { rateLimiterMode: "test" });
      const assessment = assessStudioSecurity(system, {
        NODE_ENV: "development",
        PUBLIC_APP_URL: "",
        CLOUDFLARE_TUNNEL: "false",
      });

      assert.equal(assessment.level, "local_only");
      assert.equal(assessment.label, "Nur lokal");
      assert.equal(assessment.severity, "ok");
    } finally {
      await db.$disconnect();
    }
  });

  it("reports unsafe when public exposure lacks proxy indicators and token", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    try {
      const system = await getSystemStatus(db, { rateLimiterMode: "test" });
      const assessment = assessStudioSecurity(system, {
        NODE_ENV: "development",
        PUBLIC_APP_URL: "https://uwe.example.org",
        TRUST_PROXY: "false",
        CLOUDFLARE_TUNNEL: "false",
        AUTH_SECRET: "x".repeat(32),
        RUN_DB_SEED: "false",
      });

      assert.equal(assessment.level, "unsafe");
      assert.equal(assessment.severity, "critical");
      assert.ok(assessment.nextSteps.some((step) => step.includes("STUDIO_API_TOKEN")));
    } finally {
      await db.$disconnect();
    }
  });

  it("reports misconfigured when production public URL lacks TRUST_PROXY", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    try {
      const system = await getSystemStatus(db, { rateLimiterMode: "test" });
      const assessment = assessStudioSecurity(system, {
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://uwe.example.org",
        TRUST_PROXY: "false",
        CLOUDFLARE_TUNNEL: "false",
        AUTH_SECRET: "x".repeat(32),
        RUN_DB_SEED: "false",
      });

      assert.equal(assessment.level, "misconfigured");
      assert.ok(assessment.misconfigurations.some((item) => item.includes("TRUST_PROXY")));
    } finally {
      await db.$disconnect();
    }
  });

  it("reports protected when proxy, token and auth are configured", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    try {
      const system = await getSystemStatus(db, { rateLimiterMode: "test" });
      const assessment = assessStudioSecurity(system, {
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://uwe.example.org",
        TRUST_PROXY: "true",
        CLOUDFLARE_TUNNEL: "true",
        AUTH_REQUIRED: "true",
        AUTH_SECRET: "x".repeat(32),
        RUN_DB_SEED: "false",
        STUDIO_API_TOKEN: "studio-token-for-tests",
        SESSION_COOKIE_SECURE: "true",
      });

      assert.equal(assessment.level, "protected");
      assert.equal(assessment.label, "Studio geschützt");
      assert.equal(assessment.severity, "ok");
    } finally {
      await db.$disconnect();
    }
  });

  it("reports misconfigured for HTTPS without secure cookies", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    try {
      const system = await getSystemStatus(db, { rateLimiterMode: "test" });
      const assessment = assessStudioSecurity(system, {
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://uwe.example.org",
        TRUST_PROXY: "true",
        CLOUDFLARE_TUNNEL: "true",
        SESSION_COOKIE_SECURE: "false",
        AUTH_SECRET: "x".repeat(32),
        RUN_DB_SEED: "false",
        STUDIO_API_TOKEN: "studio-token-for-tests",
      });

      assert.equal(assessment.level, "misconfigured");
      assert.ok(assessment.misconfigurations.length > 0);
    } finally {
      await db.$disconnect();
    }
  });

  it("does not leak secrets in assessment JSON", async () => {
    const db = createPrismaClient(createTestDatabaseUrl());
    const secret = "super-secret-studio-token-12345";
    try {
      const system = await getSystemStatus(db, { rateLimiterMode: "test" });
      const assessment = assessStudioSecurity(system, {
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://uwe.example.org",
        TRUST_PROXY: "true",
        CLOUDFLARE_TUNNEL: "true",
        AUTH_SECRET: secret,
        STUDIO_API_TOKEN: secret,
        RUN_DB_SEED: "false",
      });

      const serialized = JSON.stringify(assessment);
      assert.ok(!serialized.includes(secret));
    } finally {
      await db.$disconnect();
    }
  });
});

describe("RTX exposure assessment", () => {
  it("flags public RTX_BASE_URL", () => {
    const assessment = assessRtxExposure({
      RTX_BASE_URL: "https://rtx.example.com",
      AI_INFERENCE_ALLOW_PUBLIC_URL: "false",
    });

    assert.equal(assessment.ok, false);
    assert.equal(assessment.severity, "critical");
    assert.ok(assessment.endpoints.some((endpoint) => endpoint.envKey === "RTX_BASE_URL"));
    assert.ok(assessment.nextSteps.some((step) => step.includes("RTX_BASE_URL")));
  });

  it("allows private home network URLs", () => {
    const assessment = assessRtxExposure({
      RTX_BASE_URL: "http://192.168.1.100:8787",
      AI_INFERENCE_BASE_URL: "http://192.168.1.100:11434",
    });

    assert.equal(assessment.ok, true);
    assert.equal(assessment.severity, "ok");
  });

  it("warns when AI_INFERENCE_ALLOW_PUBLIC_URL overrides protection", () => {
    const assessment = assessRtxExposure({
      AI_INFERENCE_BASE_URL: "https://ollama.example.com",
      AI_INFERENCE_ALLOW_PUBLIC_URL: "true",
    });

    assert.equal(assessment.ok, false);
    assert.equal(assessment.severity, "warning");
    assert.ok(assessment.nextSteps.some((step) => step.includes("AI_INFERENCE_ALLOW_PUBLIC_URL")));
  });

  it("does not leak RTX tokens in serialized output", () => {
    const assessment = assessRtxExposure({
      RTX_BASE_URL: "http://192.168.1.100:8787",
      RTX_SERVICE_TOKEN: "secret-rtx-token-do-not-leak",
    });

    assert.ok(!JSON.stringify(assessment).includes("secret-rtx-token-do-not-leak"));
  });
});
