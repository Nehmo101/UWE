export interface MailAddress {
  email: string;
  name?: string;
}

export interface MailMessage {
  to: MailAddress[];
  subject: string;
  text?: string;
  html?: string;
}

export interface MailSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  logBody: boolean;
  useMock: boolean;
}

export interface MailConfigStatus {
  enabled: boolean;
  configured: boolean;
  host: string | null;
  port: number | null;
  secure: boolean;
  userConfigured: boolean;
  passwordConfigured: boolean;
  fromAddress: string | null;
  logBody: boolean;
  useMock: boolean;
  message: string;
}

export type MailComposeKind = "session_recap" | "handout" | "share_link";

export interface MailDraft {
  kind: MailComposeKind;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  sourceType: string;
  sourceId: string;
  worldId: string;
  warnings: string[];
  containsDmOnlyHint: boolean;
}
