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
    // Nach dem V2-Abriss (Paket E) verbleiben nur die lebenden Teile:
    // tokens.css (Theme-Engine-Kopplung), wiki.css (uwe-v2-wiki-Render),
    // parchment-os-shell.css (Theme-Skin) und das index.css-Bundle.
    const required = [
      "tokens.css",
      "wiki.css",
      "parchment-os-shell.css",
      "tinte-papier-shell.css",
      "index.css",
    ];
    for (const file of required) {
      const content = readFileSync(path.join(designV2Dir, file), "utf8");
      assert.ok(content.length > 50, `missing or empty ${file}`);
    }
  });

  it("uwe.css imports design-v2 bundle", () => {
    const uweCss = readFileSync(path.join(__dirname, "../uwe.css"), "utf8");
    assert.match(uweCss, /@import "\.\/design-v2\/index\.css"/);
    assert.doesNotMatch(uweCss, /legacy-bridge\.css/);
  });

  it("design-v2 wiki styles target reader content", () => {
    const wiki = readFileSync(path.join(designV2Dir, "wiki.css"), "utf8");
    assert.match(wiki, /\.uwe-v2-wiki-content/);
  });

  it("parchment OS handoff tokens match theme preset", () => {
    const parchment = UWE_THEMES["uwe-parchment-os"].colors;
    assert.equal(parchment.fg?.toLowerCase(), "#211d17");
    assert.equal(parchment.accent?.toLowerCase(), "#c2622b");
    assert.equal(parchment.bg?.toLowerCase(), "#f1e8d4");
    assert.equal(parchment.sidebarBg?.toLowerCase(), "#211d17");
    assert.equal(parchment.cardBg?.toLowerCase(), "#fbf6ea");
  });

  it("parchment OS shell uses semantic CSS tokens instead of hard-coded colors", () => {
    const shell = readFileSync(path.join(designV2Dir, "parchment-os-shell.css"), "utf8");
    assert.doesNotMatch(shell, /#[0-9a-fA-F]{3,8}\b/);
    assert.doesNotMatch(shell, /\brgba?\(/);
    assert.match(shell, /--uwe-v2-topbar-bg/);
    assert.match(shell, /--uwe-v2-sidebar-active-bg/);
  });

  it("tinte-papier tokens match the room theme presets", () => {
    const werkbank = UWE_THEMES["uwe-werkbank"].colors;
    assert.equal(werkbank.accent?.toLowerCase(), "#33567d");
    assert.equal(werkbank.bg?.toLowerCase(), "#e3ded2");
    assert.equal(werkbank.sidebarBg?.toLowerCase(), "#241f17");
    const lesesaal = UWE_THEMES["uwe-lesesaal"].colors;
    assert.equal(lesesaal.accent?.toLowerCase(), "#2f614b");
    // Lesesaal ist der Raum ohne dunkle Sidebar — Kopfleiste auf Papier.
    assert.equal(lesesaal.sidebarBg?.toLowerCase(), lesesaal.cardBg?.toLowerCase());
    const nachtstudie = UWE_THEMES["uwe-nachtstudie"].colors;
    assert.equal(nachtstudie.accent?.toLowerCase(), "#c29a3a");
    assert.equal(nachtstudie.bg?.toLowerCase(), "#1f1b14");
    // Semantik bleibt vom Akzent getrennt (Befund B-3 aus dem Konzept).
    for (const room of [werkbank, lesesaal, nachtstudie]) {
      assert.notEqual(room.danger, room.accent);
      assert.notEqual(room.dmOnly, room.accent);
    }
  });

  it("tinte-papier shell uses semantic CSS tokens instead of hard-coded colors", () => {
    const shell = readFileSync(path.join(designV2Dir, "tinte-papier-shell.css"), "utf8");
    assert.doesNotMatch(shell, /#[0-9a-fA-F]{3,8}\b/);
    assert.doesNotMatch(shell, /\brgba?\(/);
    assert.match(shell, /--uwe-sidebar-bg/);
    assert.match(shell, /uwe-nachtstudie/);
  });

  it("v2 layout tokens follow handoff dimensions", () => {
    const tokens = readFileSync(path.join(designV2Dir, "tokens.css"), "utf8");
    assert.match(tokens, /14\.75rem.*236px/);
    assert.match(tokens, /3\.375rem.*54px/);
  });
});

describe("theme preset QA — all 11 presets", () => {
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
