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

  it("persists a decoded HTML body and attachment metadata from a fetched message", async () => {
    const service = createMailAccountService(db);
    const account = await service.createAccount({
      label: "Inbox Test",
      smtpHost: "smtp.example.com",
      username: "inbox@example.com",
      password: "secret-pass",
    });

    const fetchedMessage = {
      imapUid: "1001",
      messageId: "<msg-1@dazn.example>",
      subject: "Saison 2026/27",
      fromAddress: "NFL Game Pass <mail@nflgamepass.dazn.com>",
      toAddresses: ["dm@uwe.local"],
      snippet: "Mach deine Kündigung jetzt.",
      bodyText: null,
      bodyHtml: '<p>Mach deine Kündigung jetzt.</p><img src="data:image/png;base64,iVBORw0KGgo=">',
      attachments: [
        { filename: "hero.png", mimeType: "image/png", sizeBytes: 42, contentId: "hero@dazn" },
        { filename: "agb.pdf", mimeType: "application/pdf", sizeBytes: 1024, contentId: null },
      ],
      receivedAt: new Date("2026-07-01T09:00:00Z"),
      isRead: false,
    };

    const saved = await service.persistFetchedMessage(account.id, fetchedMessage);
    assert.equal(saved.bodyHtml, fetchedMessage.bodyHtml);
    assert.equal(saved.hasAttachments, true);

    const attachments = await db.mailAttachment.findMany({ where: { messageId: saved.id } });
    assert.equal(attachments.length, 2);
    const inline = attachments.find((a) => a.contentId === "hero@dazn");
    assert.equal(inline?.filename, "hero.png");
    assert.equal(inline?.mimeType, "image/png");

    // Re-syncing the same message (same accountId/imapUid) replaces attachment rows
    // instead of duplicating them, and clears them out entirely once none remain.
    const resynced = { ...fetchedMessage, attachments: [] };
    const savedAgain = await service.persistFetchedMessage(account.id, resynced);
    assert.equal(savedAgain.id, saved.id);
    assert.equal(savedAgain.hasAttachments, false);
    const attachmentsAfter = await db.mailAttachment.findMany({ where: { messageId: saved.id } });
    assert.equal(attachmentsAfter.length, 0);
  });
});
