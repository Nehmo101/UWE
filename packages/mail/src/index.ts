export {
  resolveSmtpConfig,
  isSmtpConfigured,
  getMailConfigStatus,
} from "./config";

export {
  createMailTransport,
  type MailTransport,
} from "./transport";

export {
  composeMail,
  composeSessionRecapMail,
  composeHandoutMail,
  composeShareLinkMail,
  type SessionRecapSource,
  type HandoutSource,
  type ShareLinkSource,
} from "./compose";

export {
  redactSecrets,
  maskEmailList,
  truncateBodyPreview,
} from "./redact";

export {
  fetchImapInboxMessages,
  type ImapCredentials,
  type FetchedInboxMessage,
} from "./imap-sync";

export type {
  MailAddress,
  MailMessage,
  MailSendResult,
  SmtpConfig,
  MailConfigStatus,
  MailComposeKind,
  MailDraft,
} from "./types";
