import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  customThemesForScope,
  normalizeCustomThemes,
  removeCustomTheme,
  upsertCustomTheme,
  type CustomThemeRecord,
} from "./custom-theme-preferences";

const palette = { bg: "#f1e8d4", fg: "#211d17", accent: "#2f6f63" };

function record(overrides: Partial<CustomThemeRecord> = {}): CustomThemeRecord {
  return {
    id: "custom-a",
    label: "Design A",
    scope: "both",
    colors: palette,
    createdAt: "2026-07-09T00:00:00.000Z",
    ...overrides,
  };
}

describe("normalizeCustomThemes", () => {
  it("keeps valid records and drops malformed / duplicate ones", () => {
    const result = normalizeCustomThemes([
      record(),
      { id: "custom-a", label: "Dup", scope: "both", colors: palette }, // duplicate id
      { id: "", label: "no id", colors: palette }, // invalid: empty id
      { id: "custom-b", label: "", colors: palette }, // invalid: empty label
      { id: "custom-c", label: "no colors" }, // invalid: no colors
      { id: "custom-d", label: "Design D", scope: "studio", colors: palette },
      "garbage",
    ]);
    assert.deepEqual(
      result.map((r) => r.id),
      ["custom-a", "custom-d"],
    );
  });

  it("defaults scope to 'both' and fills a deterministic createdAt", () => {
    const [r] = normalizeCustomThemes([{ id: "custom-x", label: "X", colors: palette }]);
    assert.equal(r.scope, "both");
    assert.equal(r.createdAt, "1970-01-01T00:00:00.000Z");
  });

  it("trims color values and drops non-string entries", () => {
    const [r] = normalizeCustomThemes([
      { id: "custom-y", label: "Y", colors: { bg: "  #fff  ", fg: 5, accent: "#000" } },
    ]);
    assert.deepEqual(r.colors, { bg: "#fff", accent: "#000" });
  });

  it("returns [] for non-array input", () => {
    assert.deepEqual(normalizeCustomThemes(undefined), []);
    assert.deepEqual(normalizeCustomThemes({}), []);
  });
});

describe("customThemesForScope", () => {
  const themes = [
    record({ id: "custom-s", scope: "studio" }),
    record({ id: "custom-p", scope: "portal" }),
    record({ id: "custom-b", scope: "both" }),
  ];
  it("includes 'both' plus the matching scope", () => {
    assert.deepEqual(
      customThemesForScope(themes, "studio").map((t) => t.id),
      ["custom-s", "custom-b"],
    );
    assert.deepEqual(
      customThemesForScope(themes, "portal").map((t) => t.id),
      ["custom-p", "custom-b"],
    );
  });
});

describe("upsert / remove", () => {
  it("appends a new theme and replaces an existing one by id", () => {
    const one = upsertCustomTheme([], record({ id: "custom-a", label: "A1" }));
    assert.equal(one.length, 1);
    const updated = upsertCustomTheme(one, record({ id: "custom-a", label: "A2" }));
    assert.equal(updated.length, 1);
    assert.equal(updated[0].label, "A2");
  });

  it("removes by id", () => {
    const list = [record({ id: "custom-a" }), record({ id: "custom-b" })];
    assert.deepEqual(
      removeCustomTheme(list, "custom-a").map((t) => t.id),
      ["custom-b"],
    );
  });
});
