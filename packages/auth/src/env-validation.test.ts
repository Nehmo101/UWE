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
      UWE_MEDIA_SIGNING_SECRET: "a-strong-random-media-secret",
    });

    assert.equal(hasBlockingEnvIssues(issues), false);
  });

  it("flags missing or dev-default media signing secret as error in production", () => {
    const base = {
      NODE_ENV: "production",
      AUTH_SECRET: "a-strong-random-secret-value-here",
      RUN_DB_SEED: "false",
    };

    const missing = validateUweEnvironment({ ...base });
    assert.ok(
      missing.some(
        (issue) => issue.id === "env:media-signing-secret" && issue.severity === "error",
      ),
    );

    const devDefault = validateUweEnvironment({
      ...base,
      UWE_MEDIA_SIGNING_SECRET: "uwe-dev-media-signing-secret",
    });
    assert.ok(
      devDefault.some(
        (issue) => issue.id === "env:media-signing-secret" && issue.severity === "error",
      ),
    );

    const strong = validateUweEnvironment({
      ...base,
      UWE_MEDIA_SIGNING_SECRET: "a-strong-random-media-secret",
    });
    assert.ok(!strong.some((issue) => issue.id === "env:media-signing-secret"));
  });

  it("does not flag media signing secret outside production", () => {
    const issues = validateUweEnvironment({
      NODE_ENV: "development",
      AUTH_SECRET: "a-strong-random-secret-value-here",
    });
    assert.ok(!issues.some((issue) => issue.id === "env:media-signing-secret"));
  });

  it("warns (not errors) about missing STUDIO_API_TOKEN in production without public exposure", () => {
    const issues = validateUweEnvironment({
      NODE_ENV: "production",
      AUTH_SECRET: "a-strong-random-secret-value-here",
      RUN_DB_SEED: "false",
      UWE_MEDIA_SIGNING_SECRET: "a-strong-random-media-secret",
    });

    const tokenIssue = issues.find((issue) => issue.id === "env:studio-api-token-recommended");
    assert.ok(tokenIssue);
    assert.equal(tokenIssue.severity, "warning");
  });
});
