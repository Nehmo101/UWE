import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SETTINGS_GROUPS,
  buildUpdateBody,
  coerceSettingValue,
  readSettingValue,
  type SettingsField,
} from "./settings-fields";

/**
 * The settings editor sends a nested partial to `settings-update`, which is
 * validated against a fixed key list on the host. These tests pin the two places
 * where the client could send something the validator would reject: the shape of
 * the body, and the type of each value.
 */

function field(overrides: Partial<SettingsField> & Pick<SettingsField, "group" | "key" | "kind">): SettingsField {
  return { label: overrides.key, ...overrides };
}

describe("settings field catalogue", () => {
  it("has unique group/key pairs", () => {
    const seen = new Set<string>();
    for (const group of SETTINGS_GROUPS) {
      for (const entry of group.fields) {
        const id = `${entry.group}.${entry.key}`;
        assert.ok(!seen.has(id), `duplicate settings field: ${id}`);
        seen.add(id);
      }
    }
  });

  it("gives every select field its options", () => {
    for (const group of SETTINGS_GROUPS) {
      for (const entry of group.fields) {
        if (entry.kind !== "select") continue;
        assert.ok((entry.options ?? []).length > 0, `select without options: ${entry.key}`);
      }
    }
  });

  it("never offers a cloud switch — KI läuft nur über den RTX-Host", () => {
    const keys = SETTINGS_GROUPS.flatMap((group) => group.fields.map((entry) => entry.key));
    assert.ok(!keys.includes("allowCloud"));
    assert.ok(!keys.includes("defaultProviderMode"));
  });
});

describe("readSettingValue", () => {
  const target = field({ group: "backup", key: "retentionCount", kind: "select" });

  it("reads a nested value", () => {
    assert.equal(readSettingValue({ backup: { retentionCount: 14 } }, target), 14);
  });

  it("returns undefined instead of throwing on a missing group", () => {
    assert.equal(readSettingValue({}, target), undefined);
    assert.equal(readSettingValue(null, target), undefined);
    assert.equal(readSettingValue({ backup: "nope" }, target), undefined);
  });
});

describe("coerceSettingValue", () => {
  it("keeps booleans boolean", () => {
    assert.equal(coerceSettingValue(field({ group: "portal", key: "portalEnabled", kind: "boolean" }), true), true);
    assert.equal(coerceSettingValue(field({ group: "portal", key: "portalEnabled", kind: "boolean" }), "true"), false);
  });

  it("turns numeric inputs into numbers", () => {
    assert.equal(coerceSettingValue(field({ group: "mail", key: "inboxLimit", kind: "number" }), "250"), 250);
  });

  it("turns numeric selects into numbers and leaves enums as strings", () => {
    assert.equal(coerceSettingValue(field({ group: "backup", key: "retentionCount", kind: "select" }), "30"), 30);
    assert.equal(
      coerceSettingValue(field({ group: "worlds", key: "defaultCanonicalStatus", kind: "select" }), "canon"),
      "canon",
    );
  });

  it("maps an empty textarea to null, which is how the prompt default is expressed", () => {
    const prompt = field({ group: "ai", key: "generalChatSystemPrompt", kind: "textarea" });
    assert.equal(coerceSettingValue(prompt, "   "), null);
    assert.equal(coerceSettingValue(prompt, "Sei knapp."), "Sei knapp.");
  });
});

describe("buildUpdateBody", () => {
  const fieldsById = new Map<string, SettingsField>([
    ["backup.retentionCount", field({ group: "backup", key: "retentionCount", kind: "select" })],
    ["backup.autoBackupEnabled", field({ group: "backup", key: "autoBackupEnabled", kind: "boolean" })],
    ["portal.portalEnabled", field({ group: "portal", key: "portalEnabled", kind: "boolean" })],
  ]);

  it("nests edits under their group", () => {
    const body = buildUpdateBody(
      new Map<string, unknown>([
        ["backup.retentionCount", 30],
        ["backup.autoBackupEnabled", true],
        ["portal.portalEnabled", false],
      ]),
      fieldsById,
    );
    assert.deepEqual(body, {
      backup: { retentionCount: 30, autoBackupEnabled: true },
      portal: { portalEnabled: false },
    });
  });

  it("sends only what was edited, so a save never overwrites untouched keys", () => {
    const body = buildUpdateBody(new Map<string, unknown>([["portal.portalEnabled", true]]), fieldsById);
    assert.deepEqual(body, { portal: { portalEnabled: true } });
  });

  it("drops ids without a field, so a stale edit cannot smuggle a key through", () => {
    const body = buildUpdateBody(new Map<string, unknown>([["ghost.key", 1]]), fieldsById);
    assert.deepEqual(body, {});
  });
});
