import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "./client";
import {
  assertMailApiResponseHasNoSecrets,
  createMailService,
} from "./mail-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("mail service", () => {
  let db: PrismaClient;

  before(async () => {
    const databaseUrl = createTestDatabaseUrl();
    db = createPrismaClient(databaseUrl);
  });

  it("blocks DM-only content without explicit confirmation", async () => {
    const previousMock = process.env.MAIL_USE_MOCK;
    const previousEnabled = process.env.MAIL_ENABLED;
    process.env.MAIL_USE_MOCK = "true";
    process.env.MAIL_ENABLED = "true";

    try {
      const mail = createMailService(db);
      const result = await mail.sendMail({
        to: [{ email: "player@example.org" }],
        subject: "Test",
        bodyText: "DM only",
        containsDmOnlyHint: true,
        confirmDmOnly: false,
      });

      assert.equal(result.ok, false);
      assert.match(result.error ?? "", /DM-only/);
      assert.equal(result.log.status, "failed");
    } finally {
      process.env.MAIL_USE_MOCK = previousMock;
      process.env.MAIL_ENABLED = previousEnabled;
    }
  });

  it("assertMailApiResponseHasNoSecrets rejects leaked SMTP values", () => {
    const env = {
      SMTP_PASSWORD: "leaked-password-value",
      SMTP_USER: "mailer",
    };

    assert.throws(
      () =>
        assertMailApiResponseHasNoSecrets(
          { note: "leaked-password-value" },
          env as NodeJS.ProcessEnv,
        ),
      /leaked secret/,
    );
  });
});
