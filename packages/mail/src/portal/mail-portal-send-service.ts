import type { PrismaClient } from "@uwe/database/client";
import { decryptSecret } from "@uwe/database/token-crypto";
import { createMailLogService } from "@uwe/database/mail-log-service";
import type { MailAuditAction } from "@uwe/database/mail-prisma-types";
import { createMailTransport } from "@uwe/mail-core";

type AuditFn = (input: {
  action: MailAuditAction;
  accountId?: string | null;
  userId?: string | null;
  detail?: string | null;
}) => Promise<void>;

export async function sendDirectMail(
  db: PrismaClient,
  encryptionSecret: string,
  logAudit: AuditFn,
  input: {
    accountId: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    bodyText: string;
    bodyHtml?: string | null;
    attachments?: Array<{ filename: string; path?: string; contentType?: string }>;
  },
  actorUserId?: string | null,
) {
  const account = await db.mailAccount.findUnique({ where: { id: input.accountId } });
  if (!account) throw new Error("Mail-Account nicht gefunden.");

  const password = decryptSecret(account.passwordEnc, encryptionSecret);
  const transport = createMailTransport({
    enabled: true,
    host: account.smtpHost,
    port: account.smtpPort ?? 587,
    user: account.username,
    password,
    from: account.username,
    secure: (account.smtpPort ?? 587) === 465,
    logBody: false,
    useMock: false,
  });

  const logService = createMailLogService(db);
  const pendingLog = await logService.create({
    status: "pending",
    subject: input.subject,
    toAddresses: input.to,
    fromAddress: account.username,
    sourceType: "mail_portal",
    bodyLogged: false,
    bodyText: input.bodyText,
    bodyHtml: input.bodyHtml,
  });

  const sendResult = await transport.send({
    to: input.to.map((email) => ({ email })),
    cc: input.cc?.map((email) => ({ email })),
    bcc: input.bcc?.map((email) => ({ email })),
    subject: input.subject,
    text: input.bodyText,
    html: input.bodyHtml ?? undefined,
    attachments: input.attachments,
  });

  const result = sendResult.ok
    ? { ok: true as const, log: await logService.markSent(pendingLog.id, sendResult.messageId) }
    : {
        ok: false as const,
        log: await logService.markFailed(pendingLog.id, sendResult.error ?? "Versand fehlgeschlagen"),
        error: sendResult.error,
      };

  // Never log bcc recipients or attachment contents — only counts.
  const ccCount = input.cc?.length ?? 0;
  const bccCount = input.bcc?.length ?? 0;
  const attachmentCount = input.attachments?.length ?? 0;
  const meta = [
    ccCount ? `cc:${ccCount}` : null,
    bccCount ? `bcc:${bccCount}` : null,
    attachmentCount ? `anh:${attachmentCount}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  await logAudit({
    action: "send",
    accountId: input.accountId,
    userId: actorUserId,
    detail: result.ok ? `Direkt gesendet${meta ? ` (${meta})` : ""}` : `Fehler: ${input.subject ? "" : ""}${result.error ?? "unbekannt"}`,
  });

  return result;
}
