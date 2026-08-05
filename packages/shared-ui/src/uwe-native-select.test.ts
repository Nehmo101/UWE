/**
 * Guard für die Popup-Farben des nativen <select>.
 *
 * Das aufgeklappte Menü malt der Browser selbst und nimmt dafür die Farben des
 * Steuerelements. Ohne deckenden Hintergrund auf dem <select> wird die Liste
 * weiß, während die Optionen die helle Theme-Schrift erben — im dunklen Theme
 * unlesbar. Die Studio-Selects tragen (wie die Inputs daneben) `bg-transparent`
 * aus @layer utilities; die Korrektur muss deshalb ungelayert stehen, sonst
 * verliert sie wieder gegen die Utility.
 *
 * Fixiert wird genau das: geladen, ungelayert, deckend aus Theme-Tokens.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const here = import.meta.dirname;
const nativeSelect = fs.readFileSync(path.join(here, "uwe-native-select.css"), "utf8");
const uwe = fs.readFileSync(path.join(here, "uwe.css"), "utf8");

/** Datei ohne Kommentare — Kommentare nennen `bg-transparent` und `@layer` absichtlich. */
const declarations = nativeSelect.replace(/\/\*[\s\S]*?\*\//g, "");

describe("uwe-native-select.css", () => {
  it("wird von uwe.css geladen", () => {
    assert.match(uwe, /@import "\.\/uwe-native-select\.css";/);
  });

  it("steht hinter design-v3, damit es die zuletzt geladene Schicht ist", () => {
    const v3 = uwe.indexOf('@import "./design-v3/index.css";');
    const self = uwe.indexOf('@import "./uwe-native-select.css";');
    assert.ok(v3 !== -1 && self !== -1, "beide Imports müssen vorhanden sein");
    assert.ok(self > v3, "uwe-native-select.css muss nach design-v3 importiert werden");
  });

  it("bleibt ungelayert und gewinnt damit gegen Tailwind-Utilities", () => {
    assert.doesNotMatch(declarations, /@layer/);
  });

  it("gibt dem Steuerelement eine deckende Fläche aus Theme-Tokens", () => {
    assert.match(
      declarations,
      /(^|\n)select\s*\{[^}]*background-color:\s*var\(--uwe-select-bg, var\(--uwe-input-bg/,
    );
  });

  it("färbt Optionen und Gruppen als Paar aus Fläche und Schrift", () => {
    const optionRule = declarations.match(/select option,\s*\nselect optgroup\s*\{([^}]*)\}/);
    assert.ok(optionRule, "select option / select optgroup muss eine gemeinsame Regel haben");
    assert.match(optionRule[1], /background-color:\s*var\(--uwe-select-bg, var\(--uwe-input-bg/);
    assert.match(optionRule[1], /color:\s*var\(--uwe-select-fg, var\(--uwe-fg\)\)/);
  });

  it("greift auf keine System-Farbe und keinen Literal-Wert zurück", () => {
    assert.doesNotMatch(declarations, /\b(field|fieldtext|buttonface|buttontext|canvas|canvastext)\b/i);
    assert.doesNotMatch(declarations, /#[0-9a-f]{3,8}\b/i);
  });

  it("überschreibt die Schriftfarbe des geschlossenen Selects nicht", () => {
    const selectRule = declarations.match(/(^|\n)select\s*\{([^}]*)\}/);
    assert.ok(selectRule, "select-Regel muss vorhanden sein");
    assert.doesNotMatch(selectRule[2], /(^|;|\s)color:/);
  });
});
