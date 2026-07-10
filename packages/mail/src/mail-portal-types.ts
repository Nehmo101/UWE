// Thin re-export shim: these portal presentation types/constants moved to the
// leaf package @uwe/mail-core. Kept here so the "@uwe/mail/portal-types"
// subpath export stays valid for existing consumers.
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
} from "@uwe/mail-core";
