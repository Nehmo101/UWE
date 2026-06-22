export {
  resolveSmtpConfig,
  isSmtpConfigured,
  getMailConfigStatus,
  getMailConfigStatusFromSmtpConfig,
  mergeSmtpConfig,
} from "./config";

export {
  createMailTransport,
  type MailTransport,
} from "./transport";

export {
  composeMail,
  composeSessionRecapMail,
  composeSessionReminderMail,
  composeHandoutMail,
  composeShareLinkMail,
  composeContractReminderMail,
  composeBackupWarningMail,
  composeSystemWarningMail,
  composeTerrainRentalMail,
  type SessionRecapSource,
  type SessionReminderSource,
  type HandoutSource,
  type ShareLinkSource,
  type ContractReminderSource,
  type BackupWarningSource,
  type SystemWarningSource,
  type TerrainRentalSource,
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

export {
  MAIL_PROVIDER_PRESETS,
  MAIL_PRIORITY_CATEGORIES,
  MAIL_PRIORITY_LABELS,
  MAIL_REPLY_TONES,
  MAIL_REPLY_TONE_LABELS,
  sanitizeMailHtml,
  mailBodyForProcessing,
  type MailProviderPreset,
  type MailPriorityCategory,
  type MailReplyTone,
} from "./mail-portal-types";

export type {
  MailAddress,
  MailMessage,
  MailSendResult,
  SmtpConfig,
  MailConfigStatus,
  MailComposeKind,
  MailDraft,
} from "./types";
