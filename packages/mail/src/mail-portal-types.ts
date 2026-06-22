export const MAIL_PROVIDER_PRESETS = {
  gmail: {
    label: "Gmail",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
  },
  outlook: {
    label: "Outlook / Microsoft 365",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
  },
  generic: {
    label: "Generic IMAP/SMTP",
    imapHost: "",
    imapPort: 993,
    smtpHost: "",
    smtpPort: 587,
  },
} as const;

export type MailProviderPreset = keyof typeof MAIL_PROVIDER_PRESETS;

export const MAIL_PRIORITY_CATEGORIES = [
  "urgent",
  "reply_needed",
  "today",
  "waiting",
  "info",
  "newsletter",
  "suspicious",
] as const;

export type MailPriorityCategory = (typeof MAIL_PRIORITY_CATEGORIES)[number];

export const MAIL_PRIORITY_LABELS: Record<MailPriorityCategory, string> = {
  urgent: "Dringend",
  reply_needed: "Antwort nötig",
  today: "Heute erledigen",
  waiting: "Warten",
  info: "Info",
  newsletter: "Newsletter / Low Priority",
  suspicious: "Spam / Verdächtig",
};

export const MAIL_REPLY_TONES = ["short", "friendly", "professional", "direct"] as const;
export type MailReplyTone = (typeof MAIL_REPLY_TONES)[number];

export const MAIL_REPLY_TONE_LABELS: Record<MailReplyTone, string> = {
  short: "Kurz",
  friendly: "Freundlich",
  professional: "Professionell",
  direct: "Direkt",
};

/** Strip HTML tags and scripts for safe AI processing and plain display. */
export function sanitizeMailHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Prefer plain text; fall back to sanitized HTML. */
export function mailBodyForProcessing(bodyText: string | null | undefined, bodyHtml?: string | null): string {
  const plain = bodyText?.trim();
  if (plain) return plain;
  if (bodyHtml?.trim()) return sanitizeMailHtml(bodyHtml);
  return "";
}
