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
  fetchImapMessages,
  fetchImapAttachmentContent,
  listImapMailboxes,
  parseImapMessage,
  normalizeMessageIdList,
  describeImapError,
  type ImapCredentials,
  type FetchedInboxMessage,
  type ImapSyncProgress,
  type FetchImapOptions,
  type FetchImapResult,
  type ImapFolderEntry,
} from "./imap-sync";

export {
  planImapSync,
  buildUidFetchChunks,
  type SyncPlanInput,
  type SyncPlan,
} from "./sync/sync-plan";

export {
  resolveThreadId,
  normalizeSubjectForThreading,
  type ThreadLookup,
} from "./threading";

export {
  setImapMessageFlagged,
} from "./imap-writeback";

export {
  MailRuleService,
  createMailRuleService,
  type UpsertMailRuleInput,
} from "./rules/mail-rule-service";

export {
  evaluateRules,
  ruleMatches,
  type RuleEvaluation,
} from "./rules/rule-engine";

export {
  parseRuleConditions,
  parseRuleActions,
  type MailRuleCondition,
  type MailRuleAction,
  type MailRuleDefinition,
  type MailRuleMessage,
} from "./rules/rule-types";

export {
  autoTriageNewMessages,
  type AutoTriageOptions,
} from "./triage/auto-triage";

export {
  storeOutboundAttachment,
  resolveOutboundAttachmentPath,
  deleteOutboundAttachment,
  resolveOutboundDir,
  sanitizeAttachmentFilename,
  MAX_OUTBOUND_ATTACHMENT_BYTES,
  type StoredOutboundAttachment,
} from "./outbound-attachments";

export {
  scoreMailPriority,
  type MailPriorityInput,
  type MailPriorityResult,
} from "./priority";

export {
  markImapMessageSeen,
  moveImapMessage,
  pickWritebackMailbox,
  type ImapMailboxEntry,
  type ImapWritebackTarget,
} from "./imap-writeback";

export {
  readMailScheduleConfig,
  writeMailScheduleConfig,
  resolveMailSchedulePath,
  type MailScheduleConfig,
  type MailSyncIntervalMinutes,
} from "./schedule";

export {
  parseListUnsubscribeHeader,
  parseMailtoTarget,
  supportsOneClickUnsubscribe,
  executeHttpOneClickUnsubscribe,
  type ParsedUnsubscribeTargets,
  type ParsedMailtoTarget,
  type HttpUnsubscribeResult,
} from "./unsubscribe";

export {
  parseRawMailSource,
  type ParsedMailAttachment,
  type ParsedMailMessage,
} from "./mime-decode";

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
