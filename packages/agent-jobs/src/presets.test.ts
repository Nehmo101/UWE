import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AGENT_JOB_PRESETS,
  fillAgentJobPreset,
  getAgentJobPreset,
  listPresetPlaceholders,
} from "./presets";

describe("AGENT_JOB_PRESETS", () => {
  it("every placeholder has a matching field definition", () => {
    for (const preset of AGENT_JOB_PRESETS) {
      const fieldKeys = new Set(preset.fields.map((field) => field.key));
      for (const key of listPresetPlaceholders(preset)) {
        assert.ok(fieldKeys.has(key), `${preset.id}: {{${key}}} has no field`);
      }
    }
  });

  it("has unique ids and non-empty templates", () => {
    const ids = AGENT_JOB_PRESETS.map((preset) => preset.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const preset of AGENT_JOB_PRESETS) {
      assert.ok(preset.titleTemplate.trim().length > 0);
      assert.ok(preset.promptTemplate.includes("pnpm ci:light"), `${preset.id}: gate rules missing`);
      assert.ok(preset.promptTemplate.includes("cursor/backlog-"), `${preset.id}: branch rules missing`);
    }
  });

  it("resolves presets by id", () => {
    assert.equal(getAgentJobPreset("bugfix")?.label, "Bug aus dem Bug Center fixen");
    assert.equal(getAgentJobPreset("unknown"), undefined);
  });
});

describe("fillAgentJobPreset", () => {
  const bugfix = getAgentJobPreset("bugfix")!;

  it("substitutes all placeholders into title and prompt", () => {
    const { title, prompt } = fillAgentJobPreset(bugfix, {
      bugTitle: "Portal zeigt DM-Notizen",
      bugDetails: "Als Spieler /auth/... öffnen",
      branchSlug: "portal-dm-leak",
    });
    assert.equal(title, "fix: Portal zeigt DM-Notizen");
    assert.ok(prompt.includes("Portal zeigt DM-Notizen"));
    assert.ok(prompt.includes("Als Spieler /auth/... öffnen"));
    assert.ok(prompt.includes("cursor/backlog-portal-dm-leak-c636"));
    assert.ok(!prompt.includes("{{"), "unresolved placeholder left in prompt");
  });

  it("trims values before substitution", () => {
    const { title } = fillAgentJobPreset(bugfix, {
      bugTitle: "  Spaces  ",
      bugDetails: "x",
      branchSlug: "s",
    });
    assert.equal(title, "fix: Spaces");
  });

  it("rejects empty required fields", () => {
    assert.throws(
      () => fillAgentJobPreset(bugfix, { bugTitle: " ", bugDetails: "x", branchSlug: "s" }),
      /Pflichtfeld/,
    );
  });

  it("rejects templates with undefined placeholders", () => {
    const broken = {
      ...bugfix,
      id: "broken",
      promptTemplate: "{{missing}}",
      fields: bugfix.fields,
    };
    assert.throws(() => fillAgentJobPreset(broken, {}), /Platzhalter/);
  });
});
