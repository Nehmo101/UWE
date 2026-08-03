import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findDmSections, stripDmSections } from "@uwe/auth/dm-section";

import { balanceDmSections } from "./dm-balance";

/** Wie der Planer eine Seite reicht — Titel, HTML, Tags. */
function seite(title: string, html: string, tags: string[] = []) {
  return { title, html, tags };
}

describe("balanceDmSections", () => {
  it("führt einen über Seiten laufenden Bereich auf jeder Seite weiter", () => {
    const { pages, balanced } = balanceDmSections([
      seite("Band", "<p>Anreißer.</p>\n<p>:::dm Dossier</p>"),
      seite("Kapitel 1", "<p>Der Verräter.</p>"),
      seite("Kapitel 2", "<p>Er heißt Odran Vail.</p>\n<p>:::</p>"),
      seite("Kapitel 3", "<p>Danach ist alles offen.</p>"),
    ]);

    assert.equal(balanced, 3);
    for (const page of pages) {
      const sections = findDmSections(page.html);
      assert.equal(
        sections.some((section) => section.unclosed),
        false,
        `„${page.title}" trägt eine ungeschlossene Marke`,
      );
    }

    // Genau die Seiten, die im Bereich lagen, sind für Spieler leer.
    assert.equal(stripDmSections(pages[1].html).includes("Verräter"), false);
    assert.equal(stripDmSections(pages[2].html).includes("Odran Vail"), false);
    // Und die Seite nach dem Schluss bleibt sichtbar.
    assert.equal(stripDmSections(pages[3].html).includes("alles offen"), true);
  });

  it("übernimmt den Titel des Bereichs auf die Folgeseiten", () => {
    const { pages } = balanceDmSections([
      seite("Band", "<p>:::dm Spielleiter-Dossier</p>"),
      seite("Kapitel 1", "<p>Text.</p>"),
    ]);

    assert.equal(findDmSections(pages[1].html)[0]?.title, "Spielleiter-Dossier");
  });

  it("lässt Seiten ohne Marke unangetastet — auch identisch, nicht nur gleich", () => {
    const eingabe = [seite("A", "<p>Eins</p>"), seite("B", "<p>Zwei</p>")];
    const { pages, balanced } = balanceDmSections(eingabe);

    assert.equal(balanced, 0);
    assert.equal(pages[0], eingabe[0]);
    assert.equal(pages[1], eingabe[1]);
  });

  it("lässt einen in sich geschlossenen Bereich, wie er ist", () => {
    const eingabe = [seite("A", "<p>:::dm Werte</p>\n<p>RK 17</p>\n<p>:::</p>")];
    const { pages, balanced } = balanceDmSections(eingabe);

    assert.equal(balanced, 0);
    assert.equal(pages[0], eingabe[0]);
  });

  it("überspringt die abgelegte Originaldatei", () => {
    const quelltext = seite("Quelltext: band.md", "<p>Roher Text ohne Marke.</p>", ["import/quelltext"]);
    const { pages } = balanceDmSections([
      seite("Band", "<p>:::dm Dossier</p>"),
      quelltext,
    ]);

    assert.equal(pages[1], quelltext);
  });

  it("schließt einen Bereich, der bis zum Ende des Bandes offen bleibt", () => {
    const { pages } = balanceDmSections([
      seite("Band", "<p>:::dm Dossier</p>"),
      seite("Letztes Kapitel", "<p>Ende.</p>"),
    ]);

    const letzte = findDmSections(pages[1].html);
    assert.equal(letzte.length, 1);
    assert.equal(letzte[0].unclosed, false);
    assert.equal(stripDmSections(pages[1].html).includes("Ende."), false);
  });
});
