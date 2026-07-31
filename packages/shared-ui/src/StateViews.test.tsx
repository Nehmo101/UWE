import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ErrorState, SkeletonLines, StatusPill } from "./StateViews";

/**
 * Wie bei `ResponsiveTable` liegt der Vertrag im Stylesheet: `states.css`
 * zeichnet das Fehlerzeichen über `::before` und die Statusanzeige über
 * `content: attr(data-glyph)`. Wird eines davon umbenannt, verschwindet
 * lautlos genau der Teil, der die Bedeutung *nicht* über Farbe trägt.
 */

const CSS = readFileSync(path.join(__dirname, "design-v3", "states.css"), "utf8");

describe("ErrorState", () => {
  it("meldet sich der Vorlesesoftware, sobald er erscheint", () => {
    const html = renderToStaticMarkup(<ErrorState title="Kaputt" />);
    assert.match(html, /role="alert"/);
    assert.match(html, /class="uwe-error-v3"/);
  });

  it("klappt technische Einzelheiten ein, statt sie in den Weg zu stellen", () => {
    const html = renderToStaticMarkup(<ErrorState title="Kaputt" detail="digest: abc" />);
    assert.match(html, /<details>/);
    assert.match(html, /uwe-error-v3__detail/);
  });

  it("trägt sein Zeichen aus dem Stylesheet, nicht nur die Farbe", () => {
    assert.ok(CSS.includes(".uwe-error-v3__title::before"), "Fehlerzeichen entfernt");
  });
});

describe("StatusPill", () => {
  it("verlangt Zeichen und Farbe — nie Farbe allein", () => {
    const html = renderToStaticMarkup(
      <StatusPill glyph="✓" tone="success">
        Fertig
      </StatusPill>,
    );
    assert.match(html, /data-glyph="✓"/);
    assert.match(html, /data-tone="success"/);
    // Das Stylesheet ist die andere Vertragsseite: ohne attr(data-glyph)
    // wäre das Attribut oben wirkungslos.
    assert.ok(CSS.includes("content: attr(data-glyph)"), "data-glyph wird nicht mehr gelesen");
  });
});

describe("SkeletonLines", () => {
  it("sagt vorlesbar, dass geladen wird", () => {
    const html = renderToStaticMarkup(<SkeletonLines lines={3} label="Lade Welten…" />);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /Lade Welten…/);
  });

  it("zeigt eine Titelzeile und den Rest als Textzeilen", () => {
    const html = renderToStaticMarkup(<SkeletonLines lines={3} />);
    assert.equal((html.match(/data-lines="title"/g) ?? []).length, 1);
    assert.equal((html.match(/data-lines="text"/g) ?? []).length, 2);
  });

  it("hält den Schimmer aus, wenn Bewegung abgeschaltet ist", () => {
    // Eine Dauerschleife im Vordergrund ist genau das, was
    // `prefers-reduced-motion` meint.
    assert.ok(CSS.includes("prefers-reduced-motion"), "Bewegungs-Ausnahme entfernt");
    assert.ok(CSS.includes('html[data-uwe-motion="off"]'), "UWE-Bewegungsschalter entfernt");
  });
});
