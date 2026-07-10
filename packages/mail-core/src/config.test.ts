import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMailConfigStatus, isSmtpConfigured, resolveSmtpConfig } from "./config";

describe("mail config", () => {
  it("reports unconfigured when host is missing", () => {
    const status = getMailConfigStatus({
      MAIL_ENABLED: "true",
      MAIL_FROM: "UWE <test@example.org>",
    });

    assert.equal(status.enabled, true);
    assert.equal(status.configured, false);
    assert.match(status.message, /SMTP_HOST/);
  });

  it("uses mock mode without real SMTP", () => {
    const config = resolveSmtpConfig({ MAIL_USE_MOCK: "true" });
    assert.equal(config.useMock, true);
    assert.equal(isSmtpConfigured(config), true);
  });

  it("never exposes password in status", () => {
    const status = getMailConfigStatus({
      MAIL_ENABLED: "true",
      SMTP_HOST: "smtp.example.com",
      SMTP_USER: "secret-user",
      SMTP_PASSWORD: "super-secret-password",
      MAIL_FROM: "UWE <test@example.org>",
    });

    const serialized = JSON.stringify(status);
    assert.equal(serialized.includes("super-secret-password"), false);
    assert.equal(status.passwordConfigured, true);
  });
});
