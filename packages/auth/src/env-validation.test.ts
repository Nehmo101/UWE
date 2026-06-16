import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasBlockingEnvIssues,
  isWeakAuthSecretValue,
  validateUweEnvironment,
} from "./env-validation";

describe("env validation", () => {
  it("flags weak auth secrets", () => {
    assert.equal(isWeakAuthSecretValue(undefined), true);
    assert.equal(isWeakAuthSecretValue("change-me"), true);
    assert.equal(isWeakAuthSecretValue("short"), true);
    assert.equal(isWeakAuthSecretValue("a-strong-random-secret-value-here"), false);
  });

  it("requires production hardening when publicly exposed", () => {
    const issues = validateUweEnvironment({
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uwe.example.com",
      AUTH_SECRET: "change-me",
      RUN_DB_SEED: "auto",
      TRUST_PROXY: "false",
    });

    assert.ok(issues.some((issue) => issue.id === "env:auth-secret"));
    assert.ok(issues.some((issue) => issue.id === "env:run-db-seed"));
    assert.ok(issues.some((issue) => issue.id === "env:studio-api-token"));
    assert.ok(issues.some((issue) => issue.id === "env:trust-proxy"));
    assert.equal(hasBlockingEnvIssues(issues), true);
  });

  it("passes with a sane production config", () => {
    const issues = validateUweEnvironment({
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uwe.example.com",
      AUTH_SECRET: "a-strong-random-secret-value-here",
      RUN_DB_SEED: "false",
      STUDIO_API_TOKEN: "studio-token-value-here",
      TRUST_PROXY: "true",
      CLOUDFLARE_TUNNEL: "true",
      AUTH_REQUIRED: "true",
      SESSION_COOKIE_SECURE: "true",
    });

    assert.equal(hasBlockingEnvIssues(issues), false);
  });
});
