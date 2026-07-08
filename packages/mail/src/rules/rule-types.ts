import type { MailPriorityCategory } from "../mail-portal-types";

/** A single condition on an incoming message. All conditions of a rule must match (AND). */
export type MailRuleCondition =
  | { field: "from"; op: "contains" | "equals"; value: string }
  | { field: "subject"; op: "contains" | "equals"; value: string }
  | { field: "to"; op: "contains"; value: string }
  | { field: "hasAttachment"; op: "is"; value: boolean }
  | { field: "hasUnsubscribe"; op: "is"; value: boolean };

/** An action applied when a rule matches. */
export type MailRuleAction =
  | { type: "move"; target: "archive" | "trash" }
  | { type: "markRead" }
  | { type: "star" }
  | { type: "setCategory"; category: MailPriorityCategory }
  | { type: "setMinPriority"; priority: number }
  | { type: "skipAiTriage" };

export interface MailRuleDefinition {
  id: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
  accountId: string | null;
  conditions: MailRuleCondition[];
  actions: MailRuleAction[];
}

/** The message shape the engine evaluates (already normalized from a fetched/stored message). */
export interface MailRuleMessage {
  accountId: string;
  fromAddress: string;
  subject: string;
  toAddresses: string[];
  hasAttachments: boolean;
  hasUnsubscribeTarget: boolean;
}

const CONDITION_FIELDS = new Set(["from", "subject", "to", "hasAttachment", "hasUnsubscribe"]);
const ACTION_TYPES = new Set([
  "move",
  "markRead",
  "star",
  "setCategory",
  "setMinPriority",
  "skipAiTriage",
]);

/** Defensive runtime validation for the untyped JSON stored in MailRule.conditions/actions. */
export function parseRuleConditions(raw: unknown): MailRuleCondition[] {
  if (!Array.isArray(raw)) return [];
  const result: MailRuleCondition[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    if (typeof rec.field !== "string" || !CONDITION_FIELDS.has(rec.field)) continue;
    if (rec.field === "hasAttachment" || rec.field === "hasUnsubscribe") {
      result.push({ field: rec.field, op: "is", value: Boolean(rec.value) });
    } else if (typeof rec.value === "string" && rec.value.trim()) {
      const op = rec.op === "equals" ? "equals" : "contains";
      result.push({ field: rec.field, op, value: rec.value } as MailRuleCondition);
    }
  }
  return result;
}

export function parseRuleActions(raw: unknown): MailRuleAction[] {
  if (!Array.isArray(raw)) return [];
  const result: MailRuleAction[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    if (typeof rec.type !== "string" || !ACTION_TYPES.has(rec.type)) continue;
    switch (rec.type) {
      case "move":
        if (rec.target === "archive" || rec.target === "trash") {
          result.push({ type: "move", target: rec.target });
        }
        break;
      case "setCategory":
        if (typeof rec.category === "string") {
          result.push({ type: "setCategory", category: rec.category as MailPriorityCategory });
        }
        break;
      case "setMinPriority":
        if (typeof rec.priority === "number") {
          result.push({ type: "setMinPriority", priority: Math.max(0, Math.min(100, rec.priority)) });
        }
        break;
      default:
        result.push({ type: rec.type } as MailRuleAction);
    }
  }
  return result;
}
