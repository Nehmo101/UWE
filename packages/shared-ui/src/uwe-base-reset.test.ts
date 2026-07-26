/**
 * Guard für den Button-Basis-Reset.
 *
 * Ohne Tailwind-Preflight (die Apps binden nur Theme + Utilities ein) behalten
 * <button>-Elemente die User-Agent-Vorgaben `border: 2px outset buttonborder`
 * und `background-color: buttonface`. Das sind System-Farben aus dem
 * color-scheme des Browsers, nicht aus den --uwe-*-Tokens — im dunklen Theme
 * erscheint der Ghost-Button „Abmelden" dadurch als heller OS-Chip.
 *
 * Die Tests fixieren die zwei Eigenschaften, die den Fehler fernhalten:
 * der Reset wird geladen, und er liegt in @layer base (verliert also gegen
 * Tailwind-Utilities und gegen die ungelayerten .uwe-*-Regeln).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const here = import.meta.dirname;
const reset = fs.readFileSync(path.join(here, "uwe-base-reset.css"), "utf8");
const uwe = fs.readFileSync(path.join(here, "uwe.css"), "utf8");

/** Body des `@layer base { … }`-Blocks (eine Ebene geschachtelter Klammern). */
function baseLayerBody(css: string): string {
  const start = css.indexOf("@layer base {");
  assert.notEqual(start, -1, "uwe-base-reset.css muss einen @layer base Block enthalten");
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error("@layer base Block ist nicht geschlossen");
}

describe("uwe-base-reset.css", () => {
  it("wird von uwe.css geladen, bevor die restlichen Styles greifen", () => {
    assert.match(uwe, /@import "\.\/uwe-base-reset\.css";/);
  });

  it("deklariert die Layer-Reihenfolge mit base vor utilities", () => {
    const order = reset.match(/@layer ([^{;]+);/);
    assert.ok(order, "Layer-Reihenfolge muss deklariert sein");
    const layers = order[1].split(",").map((name) => name.trim());
    assert.ok(
      layers.indexOf("base") < layers.indexOf("utilities"),
      `base muss vor utilities stehen, ist aber: ${layers.join(", ")}`,
    );
  });

  it("neutralisiert die UA-Vorgaben von <button> innerhalb von @layer base", () => {
    const body = baseLayerBody(reset);
    assert.match(body, /\bbutton\b[^{]*\{[^}]*border:\s*0 solid transparent;/);
    assert.match(body, /\bbutton\b[^{]*\{[^}]*background-color:\s*transparent;/);
    assert.match(body, /\bbutton\b[^{]*\{[^}]*font:\s*inherit;/);
  });

  it("hält klassenlose Alt-Buttons mit Theme-Tokens sichtbar", () => {
    const body = baseLayerBody(reset);
    assert.match(body, /button:not\(\[class\]\):not\(\[style\]\)\s*\{[^}]*var\(--uwe-border\)/);
  });

  it("greift in den Deklarationen auf keine System-Farbe zurück", () => {
    // Kommentare nennen die UA-Farben absichtlich — geprüft wird nur der Code.
    const declarations = baseLayerBody(reset).replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(declarations, /\b(buttonface|buttonborder|buttontext|fieldtext)\b/);
  });
});

describe("uwe.css Link-Basisfarbe", () => {
  it("nimmt als Button gerenderte Anker von der globalen Linkfarbe aus", () => {
    assert.match(uwe, /a:not\(\.uwe-button-surface\)\s*\{\s*color: var\(--uwe-link/);
  });
});
