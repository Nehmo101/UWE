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
      "uwe-ghibli-tag",
      "uwe-ghibli-nacht",
      "uwe-default",
      "uwe-dark-fantasy",
      "uwe-charcoal-desk",
      "uwe-night-observatory",
      "uwe-parchment-study",
      "uwe-parchment-os",
      "uwe-parchment-teal",
      "uwe-parchment-brain",
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

  it("defaults every scope to the Gemalte-Welt pair", () => {
    assert.equal(defaultPreferences("studio").themeId, "uwe-ghibli-tag");
    assert.equal(defaultPreferences("portal").themeId, "uwe-ghibli-tag");
    assert.equal(defaultPreferences("brain").themeId, "uwe-ghibli-nacht");
  });

  it("keeps the scene layer unobstructed: the pair ships without a bg pattern", () => {
    // BackgroundEffect's canvas sits on the same layer as the painted scene.
    for (const id of ["uwe-ghibli-tag", "uwe-ghibli-nacht"] as const) {
      assert.equal(UWE_THEMES[id].defaults?.background, "none");
    }
    for (const scope of ["studio", "portal", "brain"] as const) {
      assert.equal(defaultPreferences(scope).background, "none");
    }
  });

  it("migrates retired preview theme ids to UWE-native ids", () => {
    assert.equal(resolveThemeId("odysseus-dark-inspired", "uwe-default"), "uwe-charcoal-desk");
    assert.equal(
      resolveThemeId("odysseus-terminal-inspired", "uwe-default"),
      "uwe-phosphor-console",
    );
    assert.equal(Object.keys(LEGACY_THEME_ID_MAP).length, 9);
  });

  it("remaps every retired scope default onto the Gemalte-Welt pair", () => {
    // Retired ids must NOT resolve as ids any more — otherwise resolveThemeId
    // short-circuits before the legacy map and the migration silently no-ops.
    for (const id of [
      "uwe-cockpit-red",
      "uwe-portal-purple",
      "uwe-werkbank",
      "uwe-lesesaal",
      "uwe-nachtstudie",
    ]) {
      assert.equal(isThemeId(id), false, id);
    }
    assert.equal(resolveThemeId("uwe-cockpit-red", "uwe-default"), "uwe-ghibli-tag");
    assert.equal(resolveThemeId("uwe-portal-purple", "uwe-default"), "uwe-ghibli-tag");
    assert.equal(resolveThemeId("uwe-werkbank", "uwe-default"), "uwe-ghibli-tag");
    assert.equal(resolveThemeId("uwe-lesesaal", "uwe-default"), "uwe-ghibli-tag");
    assert.equal(resolveThemeId("uwe-nachtstudie", "uwe-default"), "uwe-ghibli-nacht");
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
    // The retired room ids must travel in the inlined legacy map too, so the
    // migration happens before first paint instead of after hydration.
    assert.match(script, /uwe-werkbank/);
    assert.match(script, /uwe-nachtstudie/);
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
