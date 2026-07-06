import type { MailPriorityCategory } from "./mail-portal-types";
import { mailBodyForProcessing } from "./mail-portal-types";

export interface MailPriorityInput {
  subject: string;
  fromAddress: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
  hasAttachments?: boolean;
  vipSenders?: string[];
}

export interface MailPriorityResult {
  priority: number;
  category: MailPriorityCategory;
  confidence: number;
  explanation: string;
  ruleSignals: string[];
  extractedActions: Array<{ type: string; label: string; value?: string }>;
}

const URGENT_WORDS = ["dringend", "urgent", "asap", "sofort", "wichtig", "mahnung", "frist"];
const REPLY_WORDS = ["antwort", "reply", "rückmeldung", "feedback", "frage"];
const INVOICE_WORDS = ["rechnung", "invoice", "zahlung", "payment", "überweisung"];
const DEADLINE_WORDS = ["deadline", "frist", "bis zum", "termin", "meeting"];
const NEWSLETTER_HINTS = ["newsletter", "noreply", "no-reply", "unsubscribe", "abmelden"];
const SECURITY_WORDS = ["sicherheit", "security", "passwort", "password", "login", "verifizierung"];

function normalize(value: string): string {
  return value.toLowerCase();
}

function containsAny(haystack: string, needles: string[]): string[] {
  return needles.filter((word) => haystack.includes(word));
}

function extractEmailAddress(fromAddress: string): string {
  const match = fromAddress.match(/<([^>]+)>/);
  return (match?.[1] ?? fromAddress).trim().toLowerCase();
}

export function scoreMailPriority(input: MailPriorityInput): MailPriorityResult {
  const subject = normalize(input.subject);
  const from = normalize(input.fromAddress);
  const fromEmail = extractEmailAddress(input.fromAddress);
  const body = normalize(mailBodyForProcessing(input.bodyText, input.bodyHtml));
  const combined = `${subject} ${body}`;
  const signals: string[] = [];
  const extractedActions: MailPriorityResult["extractedActions"] = [];

  let priority = 50;
  let category: MailPriorityCategory = "info";
  let confidence = 0.55;

  const vipSenders = (input.vipSenders ?? []).map((s) => s.toLowerCase());
  if (vipSenders.some((vip) => fromEmail.includes(vip) || from.includes(vip))) {
    signals.push("VIP-Absender");
    priority += 25;
    confidence = Math.max(confidence, 0.75);
  }

  const urgentHits = containsAny(combined, URGENT_WORDS);
  if (urgentHits.length > 0) {
    signals.push(`Dringlichkeitswörter: ${urgentHits.join(", ")}`);
    priority += 30;
    category = "urgent";
    confidence = Math.max(confidence, 0.8);
  }

  const replyHits = containsAny(combined, REPLY_WORDS);
  if (replyHits.length > 0) {
    signals.push(`Antwort erwartet: ${replyHits.join(", ")}`);
    priority += 15;
    if (category === "info") category = "reply_needed";
    confidence = Math.max(confidence, 0.7);
  }

  const invoiceHits = containsAny(combined, INVOICE_WORDS);
  if (invoiceHits.length > 0 || (input.hasAttachments && combined.includes("pdf"))) {
    signals.push("Rechnung/Zahlung erkannt");
    priority += 20;
    category = category === "urgent" ? "urgent" : "today";
    extractedActions.push({ type: "payment", label: "Rechnung prüfen" });
    confidence = Math.max(confidence, 0.72);
  }

  const deadlineHits = containsAny(combined, DEADLINE_WORDS);
  if (deadlineHits.length > 0) {
    signals.push(`Termin/Frist: ${deadlineHits.join(", ")}`);
    priority += 18;
    category = category === "urgent" ? "urgent" : "today";
    extractedActions.push({ type: "deadline", label: "Frist/Termin notieren" });
    confidence = Math.max(confidence, 0.68);
  }

  const securityHits = containsAny(combined, SECURITY_WORDS);
  if (securityHits.length > 0) {
    signals.push(`Sicherheitshinweis: ${securityHits.join(", ")}`);
    priority += 22;
    category = "urgent";
    extractedActions.push({ type: "security", label: "Account/Sicherheit prüfen" });
    confidence = Math.max(confidence, 0.78);
  }

  const newsletterHits = containsAny(`${from} ${combined}`, NEWSLETTER_HINTS);
  if (newsletterHits.length > 0) {
    signals.push(`Newsletter/No-Reply: ${newsletterHits.join(", ")}`);
    priority = Math.min(priority, 25);
    category = "newsletter";
    confidence = Math.max(confidence, 0.85);
  }

  if (subject.includes("?") && category === "info") {
    signals.push("Frage im Betreff");
    category = "reply_needed";
    priority += 10;
  }

  if (signals.length === 0) {
    signals.push("Keine starken Regel-Signale — Standard Info");
  }

  priority = Math.max(0, Math.min(100, priority));

  const explanation =
    signals.length > 0
      ? signals.join(" · ")
      : "Standardpriorität ohne besondere Signale.";

  return {
    priority,
    category,
    confidence,
    explanation,
    ruleSignals: signals,
    extractedActions,
  };
}
