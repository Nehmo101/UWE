import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isThemeId,
  LEGACY_THEME_ID_MAP,
  resolveThemeId,
  UWE_THEMES,
  THEME_LIST,
  type ThemeId,
} from "./themes";
import { defaultPreferences, getStorageKey } from "./storage";
import { buildThemeBootstrapScript } from "./bootstrapScript";

describe("uwe theme system", () => {
  it("defines all required theme presets", () => {
    const required: ThemeId[] = [
      "uwe-default",
      "uwe-dark-fantasy",
      "uwe-charcoal-desk",
      "uwe-night-observatory",
      "uwe-parchment-study",
      "uwe-parchment-os",
      "uwe-parchment-teal",
      "uwe-parchment-brain",
      "uwe-werkbank",
      "uwe-lesesaal",
      "uwe-nachtstudie",
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
  });

  it("defaults Studio to Werkbank and Portal to Lesesaal", () => {
    assert.equal(defaultPreferences("studio").themeId, "uwe-werkbank");
    assert.equal(defaultPreferences("portal").themeId, "uwe-lesesaal");
  });

  it("migrates retired preview theme ids to UWE-native ids", () => {
    assert.equal(resolveThemeId("odysseus-dark-inspired", "uwe-default"), "uwe-charcoal-desk");
    assert.equal(
      resolveThemeId("odysseus-terminal-inspired", "uwe-default"),
      "uwe-phosphor-console",
    );
    assert.equal(Object.keys(LEGACY_THEME_ID_MAP).length, 6);
  });

  it("remaps the retired cockpit-red / portal-purple defaults to Parchment OS", () => {
    assert.equal(isThemeId("uwe-cockpit-red"), false);
    assert.equal(isThemeId("uwe-portal-purple"), false);
    assert.equal(resolveThemeId("uwe-cockpit-red", "uwe-default"), "uwe-parchment-os");
    assert.equal(resolveThemeId("uwe-portal-purple", "uwe-default"), "uwe-parchment-os");
  });

  it("bootstrap script references CSS variables and localStorage", () => {
    const script = buildThemeBootstrapScript("studio");
    assert.match(script, /uwe-theme-preferences-studio/);
    assert.match(script, /localStorage/);
    assert.match(script, /--uwe-bg/);
    assert.match(script, /--uwe-sidebar-bg/);
    assert.match(script, /--uwe-radius-sm/);
    assert.match(script, /--uwe-spacing-md/);
    assert.match(script, /uwe-cockpit-red/);
    assert.match(script, /uwe-portal-purple/);
    assert.match(script, /odysseus-dark-inspired/);
  });

  it("resolves and lists registered custom themes; drops them when cleared", async () => {
    const { setCustomThemes, getTheme, isThemeId, getCustomThemesForScope } =
      await import("./themes");
    const base = UWE_THEMES["uwe-parchment-teal"].colors;
    setCustomThemes([
      { id: "custom-abc", label: "Mein Design", description: "", scope: "studio", colors: base },
      { id: "custom-portal", label: "Portal-Only", description: "", scope: "portal", colors: base },
      { id: "custom-both", label: "Beide", description: "", scope: "both", colors: base },
    ]);

    assert.equal(isThemeId("custom-abc"), true);
    assert.equal(getTheme("custom-abc").colors.accent, base.accent);
    // Unknown ids no longer collapse to the fallback in resolveThemeId.
    assert.equal(resolveThemeId("custom-abc", "uwe-default"), "custom-abc");
    // Scope filtering: studio sees studio + both, not portal-only.
    const studio = getCustomThemesForScope("studio").map((t) => t.id).sort();
    assert.deepEqual(studio, ["custom-abc", "custom-both"]);
    const portal = getCustomThemesForScope("portal").map((t) => t.id).sort();
    assert.deepEqual(portal, ["custom-both", "custom-portal"]);
    // Unknown id still falls back safely in getTheme.
    assert.ok(getTheme("does-not-exist").colors.bg.startsWith("#"));

    setCustomThemes([]);
    assert.equal(isThemeId("custom-abc"), false);
    assert.equal(resolveThemeId("custom-abc", "uwe-default"), "uwe-default");
  });

  it("bakes custom palettes into the bootstrap color map (anti-flash)", () => {
    const base = UWE_THEMES["uwe-parchment-teal"].colors;
    const script = buildThemeBootstrapScript("studio", {
      customThemes: [
        { id: "custom-xyz", label: "X", description: "", scope: "both", colors: base },
      ],
    });
    // The custom id + its accent must be inlined so first paint matches.
    assert.match(script, /custom-xyz/);
    assert.match(script, new RegExp(base.accent));
  });

  it("portal bootstrap uses portal-scoped storage keys", () => {
    const script = buildThemeBootstrapScript("portal", {
      serverPreferences: defaultPreferences("portal"),
      serverUpdatedAt: "2026-06-01T00:00:00.000Z",
    });
    assert.match(script, /uwe-theme-preferences-portal/);
    assert.match(script, /uwe-theme-sync-at-portal/);
  });
});
