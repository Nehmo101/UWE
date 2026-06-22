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

export type {
  MailAddress,
  MailMessage,
  MailSendResult,
  SmtpConfig,
  MailConfigStatus,
  MailComposeKind,
  MailDraft,
} from "./types";
