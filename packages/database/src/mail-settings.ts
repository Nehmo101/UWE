export const MAIL_INBOX_LIMIT_MIN = 10;
export const MAIL_INBOX_LIMIT_MAX = 5000;
export const MAIL_INBOX_LIMIT_DEFAULT = 100;
export const MAIL_SYNC_BATCH_DEFAULT = 100;

export type MailSyncIntervalMinutes = 5 | 15 | 30 | 60;

const MAIL_SYNC_INTERVALS: MailSyncIntervalMinutes[] = [5, 15, 30, 60];

export function normalizeMailInboxLimit(value: unknown): number {
  const limit = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(limit)) {
    return MAIL_INBOX_LIMIT_DEFAULT;
  }
  const rounded = Math.round(limit);
  if (rounded < MAIL_INBOX_LIMIT_MIN) return MAIL_INBOX_LIMIT_MIN;
  if (rounded > MAIL_INBOX_LIMIT_MAX) return MAIL_INBOX_LIMIT_MAX;
  return rounded;
}

export function normalizeMailSyncInterval(value: unknown): MailSyncIntervalMinutes {
  const minutes = typeof value === "number" ? value : Number(value);
  if (MAIL_SYNC_INTERVALS.includes(minutes as MailSyncIntervalMinutes)) {
    return minutes as MailSyncIntervalMinutes;
  }
  return 15;
}
