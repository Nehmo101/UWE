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
      "ghibli-shell.css",
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

  it("styles search highlights outside the reader scope", () => {
    // `highlightHtml` (@uwe/session-runner) setzt genau diese Klasse in den
    // Bandtext, die Trefferliste benutzt sie daneben. Ungestylt bliebe das
    // Browser-Gelb übrig — und nur im Lesetext gestylt wäre die halbe Anzeige.
    const wiki = readFileSync(path.join(designV2Dir, "wiki.css"), "utf8");
    assert.match(wiki, /^\.uwe-treffer \{/m);
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

  it("Gemalte-Welt tokens match the design handoff table", () => {
    const tag = UWE_THEMES["uwe-ghibli-tag"].colors;
    assert.equal(tag.bg?.toLowerCase(), "#f1e8d4"); // --ground
    assert.equal(tag.fg?.toLowerCase(), "#211d17"); // --ink
    assert.equal(tag.fgMuted?.toLowerCase(), "#4a4336"); // --ink2
    assert.equal(tag.fgSubtle?.toLowerCase(), "#8a7d64"); // --ink3
    assert.equal(tag.sidebarBg?.toLowerCase(), "#211d17"); // --side-bg
    assert.equal(tag.playerVisible?.toLowerCase(), "#1a5c4f"); // --teal
    assert.equal(tag.dmOnly?.toLowerCase(), "#a8541b"); // --terra

    const nacht = UWE_THEMES["uwe-ghibli-nacht"].colors;
    assert.equal(nacht.bg?.toLowerCase(), "#100e16"); // --ground
    assert.equal(nacht.fg?.toLowerCase(), "#f1e8d4"); // --ink
    assert.equal(nacht.fgMuted?.toLowerCase(), "#c9bfaf"); // --ink2
    assert.equal(nacht.fgSubtle?.toLowerCase(), "#948b78"); // --ink3
    assert.equal(nacht.sidebarBg?.toLowerCase(), "#0d0b13"); // --side-bg
    assert.equal(nacht.playerVisible?.toLowerCase(), "#7fd0b4"); // --teal
    assert.equal(nacht.dmOnly?.toLowerCase(), "#e8a670"); // --terra

    // Sichtbarkeits-Semantik bleibt vom Produktakzent getrennt: "Portal
    // sichtbar" ist teal, "Nur GM" terracotta — auch im Portal, wo der
    // Produktakzent selbst teal ist.
    for (const mode of [tag, nacht]) {
      assert.notEqual(mode.playerVisible, mode.dmOnly);
    }
  });

  it("Gemalte-Welt shell only defines tokens the engine does not own", () => {
    const shell = readFileSync(path.join(designV2Dir, "ghibli-shell.css"), "utf8");
    // Die Engine schreibt diese Namen als Inline-Style auf <html>; ein
    // Stylesheet käme dagegen nicht an und der Block wäre stumm wirkungslos.
    for (const owned of ["--uwe-bg:", "--uwe-fg:", "--uwe-accent:", "--uwe-border:"]) {
      assert.ok(!shell.includes(owned), `ghibli-shell.css must not set ${owned}`);
    }
    assert.match(shell, /--uwe-hero-sh/);
    assert.match(shell, /--uwe-scene-veil-opacity/);
    assert.match(shell, /uwe-ghibli-nacht/);
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
