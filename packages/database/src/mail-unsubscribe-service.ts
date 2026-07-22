import type { MailUnsubscribeMethod, MailUnsubscribeStatus } from "./generated/prisma-brain/client";
import type { BrainPrismaClient as PrismaClient } from "./brain-client";
import { createMailTransport, executeHttpOneClickUnsubscribe, parseMailtoTarget } from "@uwe/mail-core";
import { decryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";

export interface UnsubscribeOutcome {
  method: MailUnsubscribeMethod;
  senderAddress: string;
  cleanedUpCount: number;
}

export class MailUnsubscribeService {
  constructor(
    private readonly db: PrismaClient,
    private readonly encryptionSecret: string = resolveTokenEncryptionSecret(),
  ) {}

  /**
   * Meldet den Absender einer Nachricht ab (RFC 8058 One-Click-HTTP oder mailto-Fallback,
   * je nachdem was der `List-Unsubscribe`-Header der Nachricht anbietet) und räumt danach
   * bereits synchronisierte Nachrichten desselben Absenders auf (als gelesen markiert).
   */
  async unsubscribeFromMessage(
    messageId: string,
    actorUserId?: string | null,
  ): Promise<UnsubscribeOutcome> {
    const message = await this.db.mailInboxMessage.findUnique({
      where: { id: messageId },
      include: { account: true },
    });
    if (!message) throw new Error("Nachricht nicht gefunden.");

    const senderAddress = message.fromAddress;

    if (message.listUnsubscribeHttpUrl && message.listUnsubscribePostSupported) {
      const result = await executeHttpOneClickUnsubscribe(message.listUnsubscribeHttpUrl);
      await this.recordRequest({
        accountId: message.accountId,
        messageId,
        senderAddress,
        method: "http_one_click",
        targetUrl: message.listUnsubscribeHttpUrl,
        status: result.ok ? "sent" : "failed",
        errorMessage: result.ok ? null : result.error ?? `Server antwortete mit Status ${result.status}.`,
        actorUserId,
      });
      if (!result.ok) {
        throw new Error(result.error ?? `Abmeldung fehlgeschlagen (Status ${result.status ?? "?"}).`);
      }
      const cleanedUpCount = await this.markSenderMessagesRead(message.accountId, senderAddress);
      return { method: "http_one_click", senderAddress, cleanedUpCount };
    }

    if (message.listUnsubscribeMailto) {
      const target = parseMailtoTarget(message.listUnsubscribeMailto);
      const password = decryptSecret(message.account.passwordEnc, this.encryptionSecret);
      const transport = createMailTransport({
        enabled: true,
        host: message.account.smtpHost,
        port: message.account.smtpPort ?? 587,
        user: message.account.username,
        password,
        from: message.account.username,
        secure: (message.account.smtpPort ?? 587) === 465,
        logBody: false,
        useMock: false,
      });

      const sendResult = await transport.send({
        to: [{ email: target.to }],
        subject: target.subject ?? "unsubscribe",
        text: target.body ?? "unsubscribe",
      });

      await this.recordRequest({
        accountId: message.accountId,
        messageId,
        senderAddress,
        method: "mailto",
        targetMailto: message.listUnsubscribeMailto,
        status: sendResult.ok ? "sent" : "failed",
        errorMessage: sendResult.ok ? null : sendResult.error ?? "Versand fehlgeschlagen.",
        actorUserId,
      });

      if (!sendResult.ok) {
        throw new Error(sendResult.error ?? "Abmelde-E-Mail konnte nicht gesendet werden.");
      }
      const cleanedUpCount = await this.markSenderMessagesRead(message.accountId, senderAddress);
      return { method: "mailto", senderAddress, cleanedUpCount };
    }

    throw new Error("Kein Abmelde-Link in dieser Nachricht gefunden.");
  }

  /** Markiert bereits synchronisierte, ungelesene Nachrichten desselben Absenders als gelesen. */
  async markSenderMessagesRead(accountId: string, senderAddress: string): Promise<number> {
    const result = await this.db.mailInboxMessage.updateMany({
      where: { accountId, fromAddress: senderAddress, isRead: false },
      data: { isRead: true },
    });
    return result.count;
  }

  private async recordRequest(input: {
    accountId: string;
    messageId: string;
    senderAddress: string;
    method: MailUnsubscribeMethod;
    targetUrl?: string | null;
    targetMailto?: string | null;
    status: MailUnsubscribeStatus;
    errorMessage?: string | null;
    actorUserId?: string | null;
  }) {
    await this.db.mailUnsubscribeRequest.create({
      data: {
        accountId: input.accountId,
        messageId: input.messageId,
        senderAddress: input.senderAddress,
        method: input.method,
        targetUrl: input.targetUrl ?? null,
        targetMailto: input.targetMailto ?? null,
        status: input.status,
        errorMessage: input.errorMessage ?? null,
        requestedByUserId: input.actorUserId ?? null,
      },
    });
  }
}

export function createMailUnsubscribeService(db: PrismaClient): MailUnsubscribeService {
  return new MailUnsubscribeService(db);
}
