import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultThemePreferencesRecord,
  mapClientBackgroundToServer,
  mapServerBackgroundToClient,
  normalizeThemePreferencesRecord,
  resolveThemePreferencesForScope,
  withThemePreferencesForScope,
} from "./theme-preferences";

describe("theme preferences", () => {
  it("normalizes stored theme preference records", () => {
    const prefs = normalizeThemePreferencesRecord(
      {
        themeId: "terra",
        font: "mono",
        density: "compact",
        background: "noise",
        frostedGlass: false,
        uiScale: 1.05,
        bgEffectIntensity: 0.5,
      },
      "studio",
    );
    assert.ok(prefs);
    assert.equal(prefs.themeId, "terra");
    assert.equal(prefs.font, "mono");
    assert.equal(prefs.background, "noise");
  });

  it("maps client and server background pattern ids", () => {
    assert.equal(mapClientBackgroundToServer("noise"), "subtle-noise");
    assert.equal(mapServerBackgroundToClient("subtle-noise"), "noise");
    assert.equal(mapClientBackgroundToServer("dots"), "dots");
  });

  it("resolves legacy app settings when themePreferences missing", () => {
    const prefs = resolveThemePreferencesForScope(
      {
        backgroundPattern: "synapse",
        frostedGlass: false,
      },
      "portal",
    );
    assert.equal(prefs.themeId, "uwe-lesesaal");
    assert.equal(prefs.background, "synapse");
    assert.equal(prefs.frostedGlass, false);
  });

  it("prefers stored themePreferences over legacy fields", () => {
    const stored = defaultThemePreferencesRecord("studio");
    stored.themeId = "hells";
    const prefs = resolveThemePreferencesForScope(
      {
        backgroundPattern: "none",
        themePreferences: { studio: stored },
      },
      "studio",
    );
    assert.equal(prefs.themeId, "hells");
  });

  it("merges scope updates into app themePreferences", () => {
    const studio = defaultThemePreferencesRecord("studio");
    studio.themeId = "terra";
    const portal = defaultThemePreferencesRecord("portal");
    portal.themeId = "uwe-portal-purple";
    const merged = withThemePreferencesForScope({ studio }, "portal", portal);
    assert.equal(merged.studio?.themeId, "terra");
    assert.equal(merged.portal?.themeId, "uwe-portal-purple");
  });
});
