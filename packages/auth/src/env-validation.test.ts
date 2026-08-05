import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BlockingEnvError,
  enforceEnvSafetyAtBoot,
  hasBlockingEnvIssues,
  isWeakAuthSecretValue,
  validateUweEnvironment,
} from "./env-validation";

describe("env validation", () => {
  it("flags weak auth secrets", () => {
    assert.equal(isWeakAuthSecretValue(undefined), true);
    assert.equal(isWeakAuthSecretValue("change-me"), true);
    assert.equal(isWeakAuthSecretValue("short"), true);
    // Shipped .env.production.example placeholder — must be rejected even though
    // it is 44 chars long and looks random.
    assert.equal(
      isWeakAuthSecretValue("CHANGE_ME_generate_with_openssl_rand_base64_32"),
      true,
    );
    assert.equal(isWeakAuthSecretValue("a-strong-random-secret-value-here"), false);
  });

  it("blocks boot when AUTH_REQUIRED=false and publicly exposed", () => {
    const issues = validateUweEnvironment({
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://uwe.example.com",
      AUTH_SECRET: "a-strong-random-secret-value-here",
      RUN_DB_SEED: "false",
      STUDIO_API_TOKEN: "studio-token-value-here",
      TRUST_PROXY: "true",
      CLOUDFLARE_TUNNEL: "true",
      SESSION_COOKIE_SECURE: "true",
      AUTH_REQUIRED: "false",
    });

    const issue = issues.find((entry) => entry.id === "env:auth-required");
    assert.ok(issue);
    assert.equal(issue.severity, "error");
    assert.equal(hasBlockingEnvIssues(issues), true);
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

  it("warns (not errors) about missing STUDIO_API_TOKEN in production without public exposure", () => {
    const issues = validateUweEnvironment({
      NODE_ENV: "production",
      AUTH_SECRET: "a-strong-random-secret-value-here",
      RUN_DB_SEED: "false",
    });

    const tokenIssue = issues.find((issue) => issue.id === "env:studio-api-token-recommended");
    assert.ok(tokenIssue);
    assert.equal(tokenIssue.severity, "warning");
  });
});

describe("enforceEnvSafetyAtBoot", () => {
  function collectingLogger() {
    const warnings: string[] = [];
    const errors: string[] = [];
    return {
      warnings,
      errors,
      logger: {
        warn: (message: string) => warnings.push(message),
        error: (message: string) => errors.push(message),
      },
    };
  }

  const saneProductionEnv = {
    NODE_ENV: "production",
    AUTH_SECRET: "a-strong-random-secret-value-here",
    RUN_DB_SEED: "false",
    STUDIO_API_TOKEN: "studio-token-value-here",
  };

  it("throws BlockingEnvError in production for error-severity issues, naming the env var", () => {
    const { logger, errors } = collectingLogger();
    assert.throws(
      () =>
        enforceEnvSafetyAtBoot(
          { NODE_ENV: "production", AUTH_SECRET: "change-me" },
          logger,
        ),
      (error: unknown) => {
        assert.ok(error instanceof BlockingEnvError);
        assert.match(error.message, /AUTH_SECRET/);
        assert.ok(error.issues.every((issue) => issue.severity === "error"));
        return true;
      },
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /AUTH_SECRET/);
  });

  it("does not throw in production with a sane config", () => {
    const { logger, warnings, errors } = collectingLogger();
    const issues = enforceEnvSafetyAtBoot({ ...saneProductionEnv }, logger);
    assert.equal(hasBlockingEnvIssues(issues), false);
    assert.equal(warnings.length, 0);
    assert.equal(errors.length, 0);
  });

  it("only warns outside production", () => {
    const { logger, warnings } = collectingLogger();
    const issues = enforceEnvSafetyAtBoot(
      { NODE_ENV: "development", AUTH_SECRET: "change-me" },
      logger,
    );
    assert.equal(hasBlockingEnvIssues(issues), true);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /AUTH_SECRET/);
  });

  it("only warns in production when UWE_ALLOW_INSECURE_ENV=1 is set (test opt-out)", () => {
    const { logger, warnings, errors } = collectingLogger();
    const issues = enforceEnvSafetyAtBoot(
      {
        NODE_ENV: "production",
        AUTH_SECRET: "change-me",
        UWE_ALLOW_INSECURE_ENV: "1",
      },
      logger,
    );
    assert.equal(hasBlockingEnvIssues(issues), true);
    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /UWE_ALLOW_INSECURE_ENV/);
  });
});
