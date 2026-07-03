import { MAIL_PRIORITY_CATEGORIES } from "@uwe/mail/portal-types";
import type { MailPriorityCategory } from "@uwe/mail/portal-types";

export interface MailAiPriorityScore {
  priority: number;
  category: MailPriorityCategory;
  confidence: number;
  explanation: string;
  extractedActions: Array<{ type: string; label: string; value?: string }>;
  modelProvider: string;
  modelName: string;
}

/** Extract the first JSON object from an LLM response (tolerates code fences/prose). */
export function parseMailPriorityResponse(text: string): MailAiPriorityScore | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const record = parsed as Record<string, unknown>;
  const priorityRaw = Number(record.priority);
  const confidenceRaw = Number(record.confidence);
  const category = String(record.category ?? "");
  const explanation = String(record.explanation ?? "").trim();

  if (!Number.isFinite(priorityRaw)) return null;
  if (!(MAIL_PRIORITY_CATEGORIES as readonly string[]).includes(category)) return null;

  const actionsRaw = Array.isArray(record.extractedActions) ? record.extractedActions : [];
  const extractedActions = actionsRaw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      type: String(entry.type ?? "task"),
      label: String(entry.label ?? "").trim(),
      value: entry.value === undefined ? undefined : String(entry.value),
    }))
    .filter((entry) => entry.label.length > 0)
    .slice(0, 10);

  return {
    priority: Math.min(Math.max(Math.round(priorityRaw), 0), 100),
    category: category as MailPriorityCategory,
    confidence: Number.isFinite(confidenceRaw)
      ? Math.min(Math.max(confidenceRaw, 0), 1)
      : 0.6,
    explanation: explanation || "KI-Priorisierung ohne Begründung.",
    extractedActions,
    modelProvider: "",
    modelName: "",
  };
}
