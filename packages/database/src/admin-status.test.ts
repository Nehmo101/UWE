import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { getMailConfigStatus } from "@uwe/mail";
import { createPrismaClient, type PrismaClient } from "./client";
import {
  assertAdminStatusHasNoSecrets,
  getAdminStatus,
} from "./admin-status";
import { createTestDatabaseUrl } from "./test-helpers";

describe("admin status dashboard sources", () => {
  let db: PrismaClient;

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
  });

  it("reports mail config without leaking SMTP password", () => {
    const status = getMailConfigStatus({
      MAIL_ENABLED: "true",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_USER: "mail-user",
      SMTP_PASSWORD: "super-secret-password",
      MAIL_FROM: "UWE <test@example.org>",
    });

    assert.equal(status.enabled, true);
    assert.equal(status.configured, true);
    assert.equal(status.passwordConfigured, true);
    assert.equal(status.host, "smtp.example.com");
    assert.ok(!JSON.stringify(status).includes("super-secret-password"));
    assert.ok(!JSON.stringify(status).includes("mail-user"));
  });

  it("builds admin status without leaking env secrets", async () => {
    const env = {
      ...process.env,
      MAIL_ENABLED: "false",
      SMTP_PASSWORD: "test-smtp-secret-do-not-leak",
      AUTH_SECRET: "test-auth-secret-do-not-leak",
      STUDIO_API_TOKEN: "test-studio-token-do-not-leak",
      BRAIN_EMBEDDINGS_ENABLED: "false",
    };

    const status = await getAdminStatus(db, { env });
    assertAdminStatusHasNoSecrets(status, env);

    assert.equal(typeof status.timestamp, "string");
    assert.equal(typeof status.system.version, "string");
    assert.equal(typeof status.brain.documentCount, "number");
    assert.equal(typeof status.aiRuns.totalRuns, "number");
    assert.equal(typeof status.mail.passwordConfigured, "boolean");
    assert.ok(Array.isArray(status.mail.nextSteps));
    assert.equal(typeof status.studioSecurity.level, "string");
    assert.equal(typeof status.rtxExposure.ok, "boolean");
    assert.ok(Array.isArray(status.studioSecurity.nextSteps));
  });

  it("marks mail as misconfigured when enabled without SMTP host", () => {
    const status = getMailConfigStatus({
      MAIL_ENABLED: "true",
      MAIL_FROM: "UWE <test@example.org>",
    });

    assert.equal(status.configured, false);
    assert.ok(status.message.includes("SMTP_HOST"));
  });
});
