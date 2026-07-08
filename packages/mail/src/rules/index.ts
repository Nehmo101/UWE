export {
  MailRuleService,
  createMailRuleService,
  type UpsertMailRuleInput,
} from "./mail-rule-service";

export {
  evaluateRules,
  ruleMatches,
  type RuleEvaluation,
} from "./rule-engine";

export {
  parseRuleConditions,
  parseRuleActions,
  type MailRuleCondition,
  type MailRuleAction,
  type MailRuleDefinition,
  type MailRuleMessage,
} from "./rule-types";
