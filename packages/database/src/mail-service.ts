import {
  createMailTransport,
  getMailConfigStatus,
  redactSecrets,
  resolveSmtpConfig,
  type MailAddress,
  type MailConfigStatus,
  type MailSendResult,
  type MailTransport,
  type SmtpConfig,
} from "@uwe/mail";
import type { PrismaClient } from "./client";
import { createMailLogService, type MailLogEntry } from "./mail-log-service";
import { createSettingsService } from "./settings-service";

export interface SendMailInput {
  to: MailAddress[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  worldId?: string | null;
  templateId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  confirmDmOnly?: boolean;
  containsDmOnlyHint?: boolean;
}

export interface SendMailResult {
  ok: boolean;
  log: MailLogEntry;
  error?: string;
}

export function getPublicMailConfigStatus(
  env: NodeJS.ProcessEnv = process.env,
): MailConfigStatus {
  return getMailConfigStatus(env);
}

export function assertMailApiResponseHasNoSecrets(
  payload: unknown,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const serialized = JSON.stringify(payload);
  const secretKeys = ["SMTP_PASSWORD", "SMTP_USER"] as const;

  for (const key of secretKeys) {
    const value = env[key]?.trim();
    if (value && serialized.includes(value)) {
      throw new Error(`Mail API response leaked secret from ${key}`);
    }
  }
}

export class MailService {
  constructor(
    private readonly db: PrismaClient,
    private readonly transportFactory: (config: SmtpConfig) => MailTransport = createMailTransport,
  ) {}

  async getConfigStatus(env: NodeJS.ProcessEnv = process.env): Promise<MailConfigStatus> {
    const settings = await createSettingsService(this.db).getSettings();
    return getMailConfigStatus(env, {
      enabled: settings.mail.enabled,
      logBody: settings.mail.logBody,
    });
  }

  async verifyConnection(env: NodeJS.ProcessEnv = process.env): Promise<MailSendResult> {
    const settings = await createSettingsService(this.db).getSettings();
    const config = resolveSmtpConfig(env, {
      enabled: settings.mail.enabled,
      logBody: settings.mail.logBody,
    });

    if (!settings.mail.enabled) {
      return { ok: false, error: "Mail ist deaktiviert (MAIL_ENABLED=false)." };
    }

    return this.transportFactory(config).verify();
  }

  async sendTestMail(
    toEmail: string,
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<SendMailResult> {
    const email = toEmail.trim();
    if (!email.includes("@")) {
      throw new Error("Ungültige Testmail-Adresse.");
    }

    return this.sendMail(
      {
        to: [{ email, name: "UWE Test" }],
        subject: "UWE Mail Center — Testmail",
        bodyText:
          "Diese Testmail wurde manuell aus dem UWE Mail Center gesendet.\n\nWenn du diese Nachricht liest, funktioniert SMTP.",
        bodyHtml:
          "<p>Diese Testmail wurde <strong>manuell</strong> aus dem UWE Mail Center gesendet.</p><p>Wenn du diese Nachricht liest, funktioniert SMTP.</p>",
        sourceType: "test",
        sourceId: "mail-center-test",
      },
      env,
    );
  }

  async sendMail(input: SendMailInput, env: NodeJS.ProcessEnv = process.env): Promise<SendMailResult> {
    const settings = await createSettingsService(this.db).getSettings();
    const config = resolveSmtpConfig(env, {
      enabled: settings.mail.enabled,
      logBody: settings.mail.logBody,
    });
    const logService = createMailLogService(this.db);
    const fromAddress = config.from || "unknown@uwe.local";
    const toAddresses = input.to.map((recipient) => recipient.email);

    if (input.containsDmOnlyHint && !input.confirmDmOnly) {
      const log = await logService.create({
        worldId: input.worldId,
        status: "failed",
        subject: input.subject,
        toAddresses,
        fromAddress,
        templateId: input.templateId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        errorMessage: "DM-only Inhalt erfordert explizite Bestätigung vor dem Versand.",
        bodyLogged: false,
        bodyText: input.bodyText,
        bodyHtml: input.bodyHtml,
      });

      return {
        ok: false,
        log,
        error: "DM-only Inhalt erfordert explizite Bestätigung vor dem Versand.",
      };
    }

    if (!settings.mail.enabled) {
      const log = await logService.create({
        worldId: input.worldId,
        status: "failed",
        subject: input.subject,
        toAddresses,
        fromAddress,
        templateId: input.templateId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        errorMessage: "Mail ist deaktiviert (MAIL_ENABLED=false).",
        bodyLogged: config.logBody,
        bodyText: input.bodyText,
        bodyHtml: input.bodyHtml,
      });

      return { ok: false, log, error: log.errorMessage ?? undefined };
    }

    const pendingLog = await logService.create({
      worldId: input.worldId,
      status: "pending",
      subject: input.subject,
      toAddresses,
      fromAddress,
      templateId: input.templateId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      bodyLogged: config.logBody,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml,
    });

    const transport = this.transportFactory(config);
    const result = await transport.send({
      to: input.to,
      subject: input.subject,
      text: input.bodyText,
      html: input.bodyHtml,
    });

    if (result.ok) {
      const log = await logService.markSent(pendingLog.id, result.messageId);
      return { ok: true, log };
    }

    const errorMessage = redactSecrets(result.error ?? "Unbekannter Versandfehler.");
    const log = await logService.markFailed(pendingLog.id, errorMessage);
    return { ok: false, log, error: errorMessage };
  }
}

export function createMailService(db: PrismaClient): MailService {
  return new MailService(db);
}
