import type { PrismaClient } from "./client";
import { decryptSecret } from "./token-crypto";
import { createMailLogService } from "./mail-log-service";
import { createMailTransport } from "@uwe/mail";
import type { MailAuditAction } from "./generated/prisma/client";

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
    subject: string;
    bodyText: string;
    bodyHtml?: string | null;
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
    subject: input.subject,
    text: input.bodyText,
    html: input.bodyHtml ?? undefined,
  });

  const result = sendResult.ok
    ? { ok: true as const, log: await logService.markSent(pendingLog.id, sendResult.messageId) }
    : {
        ok: false as const,
        log: await logService.markFailed(pendingLog.id, sendResult.error ?? "Versand fehlgeschlagen"),
        error: sendResult.error,
      };

  await logAudit({
    action: "send",
    accountId: input.accountId,
    userId: actorUserId,
    detail: result.ok ? "Direkt gesendet" : `Fehler: ${result.error ?? "unbekannt"}`,
  });

  return result;
}
