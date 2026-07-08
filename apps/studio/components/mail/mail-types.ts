import type { RtxConnectorState } from "@uwe/shared-ui";
import { MAIL_PRIORITY_LABELS, type MailPriorityCategory } from "@uwe/mail/portal-types";

/**
 * View-model contracts for the Mail Center (three-pane inbox, reader, KI-Triage,
 * compose and settings). Server components build these from the DB services and
 * serialize all `Date`s to ISO strings before crossing the client boundary.
 */

export type MailView = "inbox" | "triage" | "settings" | "drafts" | "sent";

export type MailFolderKey = "inbox" | "marked" | "drafts" | "sent" | "archive" | "trash";

export interface MailAccountVM {
  id: string;
  label: string;
  email: string;
  imapHost: string | null;
  smtpHost: string | null;
  lastImapSyncAt: string | null;
  imapSyncError: string | null;
  syncEnabled: boolean;
  ok: boolean;
}

export interface MailPriorityVM {
  category: MailPriorityCategory;
  priority: number;
  explanation: string;
}

export interface MailMessageVM {
  id: string;
  accountId: string;
  accountLabel: string | null;
  fromAddress: string;
  senderName: string;
  subject: string;
  snippet: string | null;
  receivedAt: string;
  isRead: boolean;
  isStarred?: boolean;
  hasAttachments: boolean;
  hasUnsubscribeTarget: boolean;
  priority: MailPriorityVM | null;
}

export interface MailThreadEntryVM {
  id: string;
  subject: string;
  fromAddress: string;
  snippet: string | null;
  receivedAt: string;
  isRead: boolean;
  folderRole: string | null;
}

export interface MailAttachmentVM {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MailAiActionVM {
  kind: string;
  outputText: string | null;
  tone: string | null;
  createdAt: string;
}

export interface MailMessageDetailVM extends MailMessageVM {
  bodyText: string | null;
  bodyHtml: string | null;
  /** DOMPurify-sanitized HTML body, safe for `dangerouslySetInnerHTML` (see MailReader). */
  bodySafeHtml: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  attachments: MailAttachmentVM[];
  aiActions: MailAiActionVM[];
  thread: MailThreadEntryVM[];
}

export interface MailDraftVM {
  id: string;
  subject: string;
  status: string;
  updatedAt: string;
}

export interface MailLogVM {
  id: string;
  createdAt: string;
  status: string;
  subject: string;
  recipients: string[];
  errorMessage: string | null;
}

export interface MailWorldVM {
  id: string;
  name: string;
  slug: string;
}

export interface MailConfigVM {
  enabled: boolean;
  configured: boolean;
  host: string | null;
  port: number | null;
  fromAddress: string | null;
  useMock: boolean;
  message: string;
}

export interface MailFolderVM {
  key: MailFolderKey;
  name: string;
  icon: string;
  count: number | null;
  active: boolean;
}

export interface MailCategoryVM {
  key: MailPriorityCategory;
  name: string;
  count: number;
}

export interface MailCenterData {
  rtxState: RtxConnectorState;
  accounts: MailAccountVM[];
  messages: MailMessageVM[];
  sentMessages: MailMessageVM[];
  drafts: MailDraftVM[];
  logs: MailLogVM[];
  worlds: MailWorldVM[];
  config: MailConfigVM;
  folders: MailFolderVM[];
  categories: MailCategoryVM[];
  activeCategory: MailPriorityCategory | null;
  activeFolder: MailFolderKey;
  selectedAccountId: string | null;
  query: string;
  autoSyncEnabled: boolean;
  /** Intervall des Hintergrund-Sync-Timers (Mail Center + Host-Timer) in Minuten. */
  autoSyncIntervalMinutes: number;
  counts: { inbox: number; unread: number; drafts: number; triage: number; sent: number };
}

export const CATEGORY_LABELS = MAIL_PRIORITY_LABELS;

/** Category → semantic token color, so the rail dots re-skin with the theme. */
export const CATEGORY_COLORS: Record<MailPriorityCategory, string> = {
  urgent: "var(--uwe-danger)",
  reply_needed: "var(--uwe-accent)",
  today: "var(--uwe-warning)",
  waiting: "var(--uwe-info)",
  info: "var(--uwe-info)",
  newsletter: "var(--uwe-fg-subtle)",
  suspicious: "var(--uwe-danger)",
};

/** Best-effort display name from an email address ("Anna Brenner <a@x.de>" → "Anna Brenner"). */
export function senderNameFromAddress(address: string): string {
  const trimmed = address.trim();
  const named = trimmed.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
  if (named?.[1]?.trim()) return named[1].trim();
  const local = trimmed.replace(/<[^>]*>/g, "").trim() || trimmed;
  const beforeAt = local.split("@")[0] ?? local;
  return beforeAt
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || local;
}

/** Two-letter avatar initials from a display name. */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Compact German-style timestamp used in the message list. */
export function formatMailTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Gestern";
  const withinWeek = (now.getTime() - date.getTime()) / 86_400_000 < 7;
  if (withinWeek) {
    return date.toLocaleDateString("de-DE", { weekday: "short" });
  }
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

/** Full timestamp for the reader header ("Montag, 30. Juni · 09:42"). */
export function formatMailFull(iso: string): { date: string; time: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  return {
    date: date.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }),
    time: date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
