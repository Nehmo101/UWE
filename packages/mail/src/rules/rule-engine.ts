import type {
  MailRuleAction,
  MailRuleCondition,
  MailRuleDefinition,
  MailRuleMessage,
} from "./rule-types";

/** True when every condition of the rule matches the message (AND semantics). */
export function ruleMatches(conditions: MailRuleCondition[], message: MailRuleMessage): boolean {
  return conditions.every((condition) => conditionMatches(condition, message));
}

function conditionMatches(condition: MailRuleCondition, message: MailRuleMessage): boolean {
  switch (condition.field) {
    case "from":
      return matchText(message.fromAddress, condition.op, condition.value);
    case "subject":
      return matchText(message.subject, condition.op, condition.value);
    case "to":
      return message.toAddresses.some((to) => matchText(to, "contains", condition.value));
    case "hasAttachment":
      return message.hasAttachments === condition.value;
    case "hasUnsubscribe":
      return message.hasUnsubscribeTarget === condition.value;
    default:
      return false;
  }
}

function matchText(haystack: string, op: "contains" | "equals", value: string): boolean {
  const h = haystack.toLowerCase();
  const v = value.toLowerCase().trim();
  if (!v) return false;
  return op === "equals" ? h === v : h.includes(v);
}

export interface RuleEvaluation {
  actions: MailRuleAction[];
  matchedRuleIds: string[];
}

/**
 * Evaluates enabled rules (scoped to the message's account or global) in
 * sortOrder and collects their actions. Later rules can add actions; a `move`
 * from an earlier rule is not overridden (first move wins) so ordering is
 * predictable. Pure — no I/O.
 */
export function evaluateRules(
  rules: MailRuleDefinition[],
  message: MailRuleMessage,
): RuleEvaluation {
  const applicable = rules
    .filter((rule) => rule.enabled)
    .filter((rule) => rule.accountId === null || rule.accountId === message.accountId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const actions: MailRuleAction[] = [];
  const matchedRuleIds: string[] = [];
  let hasMove = false;

  for (const rule of applicable) {
    if (!ruleMatches(rule.conditions, message)) continue;
    matchedRuleIds.push(rule.id);
    for (const action of rule.actions) {
      if (action.type === "move") {
        if (hasMove) continue;
        hasMove = true;
      }
      actions.push(action);
    }
  }

  return { actions, matchedRuleIds };
}
