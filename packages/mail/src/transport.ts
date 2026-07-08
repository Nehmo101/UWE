import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { redactSecrets } from "./redact";
import type { MailMessage, MailSendResult, SmtpConfig } from "./types";

export interface MailTransport {
  send(message: MailMessage): Promise<MailSendResult>;
  verify(): Promise<MailSendResult>;
}

class MockMailTransport implements MailTransport {
  async send(message: MailMessage): Promise<MailSendResult> {
    if (message.to.length === 0) {
      return { ok: false, error: "Keine Empfänger angegeben." };
    }

    return {
      ok: true,
      messageId: `mock-${Date.now()}`,
    };
  }

  async verify(): Promise<MailSendResult> {
    return { ok: true, messageId: "mock-verify-ok" };
  }
}

class SmtpMailTransport implements MailTransport {
  private transporter: Transporter | null = null;

  constructor(private readonly config: SmtpConfig) {}

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth:
          this.config.user && this.config.password
            ? {
                user: this.config.user,
                pass: this.config.password,
              }
            : undefined,
      });
    }

    return this.transporter;
  }

  async send(message: MailMessage): Promise<MailSendResult> {
    if (message.to.length === 0) {
      return { ok: false, error: "Keine Empfänger angegeben." };
    }

    try {
      const formatRecipients = (recipients: MailMessage["to"]) =>
        recipients.map((recipient) =>
          recipient.name ? `"${recipient.name}" <${recipient.email}>` : recipient.email,
        );
      const info = await this.getTransporter().sendMail({
        from: this.config.from,
        to: formatRecipients(message.to),
        cc: message.cc && message.cc.length > 0 ? formatRecipients(message.cc) : undefined,
        bcc: message.bcc && message.bcc.length > 0 ? formatRecipients(message.bcc) : undefined,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments?.map((attachment) => ({
          filename: attachment.filename,
          path: attachment.path,
          content: attachment.content,
          contentType: attachment.contentType,
        })),
      });

      return {
        ok: true,
        messageId: info.messageId,
      };
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Unbekannter SMTP-Fehler.";
      return {
        ok: false,
        error: redactSecrets(raw),
      };
    }
  }

  async verify(): Promise<MailSendResult> {
    try {
      await this.getTransporter().verify();
      return { ok: true, messageId: "smtp-verify-ok" };
    } catch (error) {
      const raw = error instanceof Error ? error.message : "SMTP-Verbindung fehlgeschlagen.";
      return {
        ok: false,
        error: redactSecrets(raw),
      };
    }
  }
}

export function createMailTransport(config: SmtpConfig): MailTransport {
  if (config.useMock) {
    return new MockMailTransport();
  }

  return new SmtpMailTransport(config);
}
