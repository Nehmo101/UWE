import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createPrismaClient, type PrismaClient } from "./client";
import { createMailAccountService } from "./mail-account-service";
import { createTestDatabaseUrl } from "./test-helpers";

describe("mail-account-service", () => {
  let db: PrismaClient;

  before(async () => {
    db = createPrismaClient(createTestDatabaseUrl());
  });

  it("stores encrypted account passwords and drafts", async () => {
    const service = createMailAccountService(db);
    const account = await service.createAccount({
      label: "Test",
      smtpHost: "smtp.example.com",
      username: "dm@example.com",
      password: "secret-pass",
    });
    assert.ok(account.passwordEnc.includes(":"));
    assert.notEqual(account.passwordEnc, "secret-pass");

    const draft = await service.createDraft({
      accountId: account.id,
      subject: "Session Recap",
      bodyText: "Hello party",
    });
    assert.equal(draft.status, "draft");

    const listed = await service.listDrafts();
    assert.ok(listed.some((entry) => entry.id === draft.id));
  });
});
