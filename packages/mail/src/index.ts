// Pure mail primitives now live in the leaf package @uwe/mail-core (no database
// dependency). Re-exported here so existing @uwe/mail consumers stay unchanged.
export * from "@uwe/mail-core";

// Database-bound mail services stay in @uwe/mail (they depend on @uwe/database).
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
