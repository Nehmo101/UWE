import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateRules, ruleMatches } from "./rule-engine";
import { parseRuleActions, parseRuleConditions } from "./rule-types";
import type { MailRuleDefinition, MailRuleMessage } from "./rule-types";

const message: MailRuleMessage = {
  accountId: "acc1",
  fromAddress: "Newsletter <news@shop.example>",
  subject: "Angebot der Woche",
  toAddresses: ["dm@uwe.local"],
  hasAttachments: false,
  hasUnsubscribeTarget: true,
};

function rule(partial: Partial<MailRuleDefinition>): MailRuleDefinition {
  return {
    id: "r1",
    name: "Rule",
    enabled: true,
    sortOrder: 0,
    accountId: null,
    conditions: [],
    actions: [],
    ...partial,
  };
}

describe("ruleMatches", () => {
  it("matches on from contains", () => {
    assert.equal(ruleMatches([{ field: "from", op: "contains", value: "shop.example" }], message), true);
  });
  it("requires all conditions (AND)", () => {
    assert.equal(
      ruleMatches(
        [
          { field: "from", op: "contains", value: "shop.example" },
          { field: "subject", op: "contains", value: "rechnung" },
        ],
        message,
      ),
      false,
    );
  });
  it("matches hasUnsubscribe flag", () => {
    assert.equal(ruleMatches([{ field: "hasUnsubscribe", op: "is", value: true }], message), true);
  });
});

describe("evaluateRules", () => {
  it("collects actions from matching enabled rules in sortOrder", () => {
    const rules = [
      rule({ id: "b", sortOrder: 2, conditions: [{ field: "hasUnsubscribe", op: "is", value: true }], actions: [{ type: "markRead" }] }),
      rule({ id: "a", sortOrder: 1, conditions: [{ field: "from", op: "contains", value: "shop" }], actions: [{ type: "move", target: "archive" }] }),
    ];
    const result = evaluateRules(rules, message);
    assert.deepEqual(result.matchedRuleIds, ["a", "b"]);
    assert.deepEqual(result.actions, [{ type: "move", target: "archive" }, { type: "markRead" }]);
  });

  it("keeps only the first move action (first move wins)", () => {
    const rules = [
      rule({ id: "a", sortOrder: 1, conditions: [{ field: "from", op: "contains", value: "shop" }], actions: [{ type: "move", target: "archive" }] }),
      rule({ id: "b", sortOrder: 2, conditions: [{ field: "from", op: "contains", value: "shop" }], actions: [{ type: "move", target: "trash" }] }),
    ];
    const moves = evaluateRules(rules, message).actions.filter((a) => a.type === "move");
    assert.equal(moves.length, 1);
    assert.deepEqual(moves[0], { type: "move", target: "archive" });
  });

  it("skips disabled rules and rules scoped to another account", () => {
    const rules = [
      rule({ id: "off", enabled: false, conditions: [], actions: [{ type: "star" }] }),
      rule({ id: "other", accountId: "acc2", conditions: [], actions: [{ type: "star" }] }),
    ];
    assert.deepEqual(evaluateRules(rules, message).matchedRuleIds, []);
  });
});

describe("rule JSON validation", () => {
  it("drops malformed conditions and actions", () => {
    assert.deepEqual(
      parseRuleConditions([{ field: "from", op: "contains", value: "x" }, { field: "bogus" }, { field: "subject", value: "" }]),
      [{ field: "from", op: "contains", value: "x" }],
    );
    assert.deepEqual(
      parseRuleActions([{ type: "move", target: "nowhere" }, { type: "star" }, { type: "unknown" }]),
      [{ type: "star" }],
    );
  });
});
