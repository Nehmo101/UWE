import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isThemeId, LEGACY_THEME_ID_MAP, resolveThemeId, UWE_THEMES, THEME_LIST } from "./themes";
import { defaultPreferences, getStorageKey } from "./storage";
import { buildThemeBootstrapScript } from "./bootstrapScript";

describe("uwe theme system", () => {
  it("defines all required theme presets", () => {
    const required = [
      "uwe-default",
      "uwe-dark-fantasy",
      "uwe-portal-purple",
      "uwe-charcoal-desk",
      "uwe-night-observatory",
      "uwe-parchment-study",
      "uwe-phosphor-console",
      "terra",
      "hells",
    ];
    for (const id of required) {
      assert.ok(isThemeId(id), `missing theme ${id}`);
      assert.ok(UWE_THEMES[id].colors.bg.startsWith("#"), id);
    }
    assert.equal(THEME_LIST.length, required.length);
  });

  it("uses separate storage keys per app scope", () => {
    assert.equal(getStorageKey("studio"), "uwe-theme-preferences-studio");
    assert.equal(getStorageKey("portal"), "uwe-theme-preferences-portal");
    assert.notEqual(
      defaultPreferences("studio").themeId,
      defaultPreferences("portal").themeId,
    );
  });

  it("migrates retired preview theme ids to UWE-native ids", () => {
    assert.equal(resolveThemeId("odysseus-dark-inspired", "uwe-default"), "uwe-charcoal-desk");
    assert.equal(
      resolveThemeId("odysseus-terminal-inspired", "uwe-default"),
      "uwe-phosphor-console",
    );
    assert.equal(Object.keys(LEGACY_THEME_ID_MAP).length, 4);
  });

  it("bootstrap script references CSS variables and localStorage", () => {
    const script = buildThemeBootstrapScript("studio");
    assert.match(script, /uwe-theme-preferences-studio/);
    assert.match(script, /localStorage/);
    assert.match(script, /--uwe-bg/);
    assert.match(script, /uwe-default/);
    assert.match(script, /uwe-portal-purple/);
    assert.match(script, /odysseus-dark-inspired/);
  });
});
