import { describe, it, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createMailUnsubscribeService } from "./mail-unsubscribe-service";
import { createTestBrainClient, type BrainPrismaClient } from "./test-helpers";
import { encryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";

describe("mail-unsubscribe-service", () => {
  let db: BrainPrismaClient;
  const originalFetch = global.fetch;

  before(() => {
    db = createTestBrainClient();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  async function createAccountAndMessage(overrides: {
    listUnsubscribeHttpUrl?: string | null;
    listUnsubscribeMailto?: string | null;
    listUnsubscribePostSupported?: boolean;
  }) {
    const account = await db.mailAccount.create({
      data: {
        label: "Unsubscribe Test",
        smtpHost: "smtp.example.com",
        smtpPort: 587,
        username: "dm@example.com",
        passwordEnc: encryptSecret("secret", resolveTokenEncryptionSecret()),
      },
    });

    const message = await db.mailInboxMessage.create({
      data: {
        accountId: account.id,
        imapUid: `${Date.now()}-${Math.random()}`,
        subject: "Wöchentlicher Newsletter",
        fromAddress: "newsletter@sender.example",
        receivedAt: new Date(),
        isRead: false,
        listUnsubscribeHttpUrl: overrides.listUnsubscribeHttpUrl ?? null,
        listUnsubscribeMailto: overrides.listUnsubscribeMailto ?? null,
        listUnsubscribePostSupported: overrides.listUnsubscribePostSupported ?? false,
      },
    });

    return { account, message };
  }

  it("throws when the message carries no unsubscribe target", async () => {
    const { message } = await createAccountAndMessage({});
    const service = createMailUnsubscribeService(db);
    await assert.rejects(
      () => service.unsubscribeFromMessage(message.id),
      /Kein Abmelde-Link/,
    );
  });

  it("fires the RFC 8058 one-click POST and marks sibling messages from the sender as read", async () => {
    const { account, message } = await createAccountAndMessage({
      listUnsubscribeHttpUrl: "https://sender.example/unsub?id=42",
      listUnsubscribePostSupported: true,
    });

    const olderMessage = await db.mailInboxMessage.create({
      data: {
        accountId: account.id,
        imapUid: `${Date.now()}-${Math.random()}`,
        subject: "Älterer Newsletter",
        fromAddress: "newsletter@sender.example",
        receivedAt: new Date(Date.now() - 86_400_000),
        isRead: false,
      },
    });

    let requestedUrl: string | null = null;
    global.fetch = (async (url: string, init?: RequestInit) => {
      requestedUrl = String(url);
      assert.equal(init?.method, "POST");
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    const service = createMailUnsubscribeService(db);
    const outcome = await service.unsubscribeFromMessage(message.id, "user-1");

    assert.equal(outcome.method, "http_one_click");
    assert.equal(outcome.senderAddress, "newsletter@sender.example");
    assert.equal(outcome.cleanedUpCount, 2);
    assert.equal(requestedUrl, "https://sender.example/unsub?id=42");

    const refreshedOlder = await db.mailInboxMessage.findUnique({ where: { id: olderMessage.id } });
    assert.equal(refreshedOlder?.isRead, true);

    const request = await db.mailUnsubscribeRequest.findFirst({ where: { messageId: message.id } });
    assert.equal(request?.status, "sent");
    assert.equal(request?.requestedByUserId, "user-1");
  });

  it("records a failed request and rethrows when the one-click POST fails", async () => {
    const { message } = await createAccountAndMessage({
      listUnsubscribeHttpUrl: "https://sender.example/unsub?id=99",
      listUnsubscribePostSupported: true,
    });

    global.fetch = (async () => new Response(null, { status: 500 })) as typeof fetch;

    const service = createMailUnsubscribeService(db);
    await assert.rejects(() => service.unsubscribeFromMessage(message.id));

    const request = await db.mailUnsubscribeRequest.findFirst({ where: { messageId: message.id } });
    assert.equal(request?.status, "failed");
  });
});
