import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { resolveThemeColorTokens } from "../theme/resolveColorTokens";
import { THEME_LIST, UWE_THEMES } from "../theme/themes";
import { normalizeElementOverrides } from "../theme/tokens";

const designV2Dir = path.join(__dirname);

describe("design v2 CSS bundle", () => {
  it("includes all required design-v2 stylesheets", () => {
    const required = [
      "tokens.css",
      "shell.css",
      "components.css",
      "layouts.css",
      "mobile.css",
      "wiki.css",
      "parchment-os-shell.css",
      "legacy-bridge.css",
      "index.css",
    ];
    for (const file of required) {
      const content = readFileSync(path.join(designV2Dir, file), "utf8");
      assert.ok(content.length > 50, `missing or empty ${file}`);
    }
  });

  it("uwe.css imports design-v2 and legacy bridge", () => {
    const uweCss = readFileSync(path.join(__dirname, "../uwe.css"), "utf8");
    assert.match(uweCss, /@import "\.\/design-v2\/index\.css"/);
    assert.match(uweCss, /@import "\.\/design-v2\/legacy-bridge\.css"/);
  });

  it("legacy bridge maps graph height and wiki content under v2", () => {
    const bridge = readFileSync(path.join(designV2Dir, "legacy-bridge.css"), "utf8");
    assert.match(bridge, /max-height:\s*220px/);
    assert.match(bridge, /data-uwe-design-v2/);
    assert.match(bridge, /body\[data-uwe-design-v2\] \.wiki-content/);
  });

  it("parchment OS handoff tokens match theme preset", () => {
    const parchment = UWE_THEMES["uwe-parchment-os"].colors;
    assert.equal(parchment.fg?.toLowerCase(), "#211d17");
    assert.equal(parchment.accent?.toLowerCase(), "#c2622b");
    assert.equal(parchment.bg?.toLowerCase(), "#f1e8d4");
    assert.equal(parchment.sidebarBg?.toLowerCase(), "#211d17");
    assert.equal(parchment.cardBg?.toLowerCase(), "#fbf6ea");
  });

  it("v2 layout tokens follow handoff dimensions", () => {
    const tokens = readFileSync(path.join(designV2Dir, "tokens.css"), "utf8");
    assert.match(tokens, /14\.75rem.*236px/);
    assert.match(tokens, /3\.375rem.*54px/);
    const components = readFileSync(path.join(designV2Dir, "components.css"), "utf8");
    assert.match(components, /\.uwe-v2-btn-accent/);
    assert.match(components, /\.uwe-v2-btn-primary/);
  });
});

describe("theme preset QA — all 9 presets", () => {
  const requiredColorKeys = [
    "bg",
    "fg",
    "panel",
    "border",
    "accent",
    "danger",
    "success",
    "wikiLink",
    "dmOnly",
    "playerVisible",
  ] as const;

  for (const theme of THEME_LIST) {
    it(`${theme.id} resolves extended color tokens`, () => {
      const colors = UWE_THEMES[theme.id].colors;
      for (const key of requiredColorKeys) {
        assert.ok(colors[key], `${theme.id} missing ${key}`);
      }
      const resolved = resolveThemeColorTokens(colors);
      assert.ok(resolved.sidebarBg, `${theme.id} sidebarBg`);
      assert.ok(resolved.cardBg, `${theme.id} cardBg`);
      assert.ok(resolved.focusRing, `${theme.id} focusRing`);
    });
  }

  it("element overrides normalize hex colors for zone tokens", () => {
    const overrides = normalizeElementOverrides({
      chromeBg: "#1a1a2e",
      headingFg: "#e2e8f0",
      cardBg: "#f1e8d4",
    });
    assert.equal(overrides?.chromeBg, "#1a1a2e");
    assert.equal(overrides?.headingFg, "#e2e8f0");
    assert.equal(overrides?.cardBg, "#f1e8d4");
  });
});
