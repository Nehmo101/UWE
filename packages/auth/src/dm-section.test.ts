import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractDmSections,
  findDmSections,
  hasDmSection,
  preserveDmSections,
  splitDmSegments,
  stripDmSections,
} from "./dm-section";

describe("dm-section — Wikitext", () => {
  it("schneidet den Bereich samt Marken heraus", () => {
    const content = "Vorher\n:::dm\nGeheim\n:::\nNachher";
    assert.equal(stripDmSections(content), "Vorher\nNachher");
  });

  it("liest den Titel hinter der Marke", () => {
    const sections = findDmSections(":::dm Der wahre Verräter\nRoderick\n:::");
    assert.equal(sections.length, 1);
    assert.equal(sections[0].title, "Der wahre Verräter");
  });

  it("kennt Bereiche ohne Titel", () => {
    const sections = findDmSections(":::dm\nRoderick\n:::");
    assert.equal(sections[0].title, null);
  });

  it("findet mehrere Bereiche in einem Block", () => {
    const content = "A\n:::dm\neins\n:::\nB\n:::dm\nzwei\n:::\nC";
    assert.equal(findDmSections(content).length, 2);
    assert.equal(stripDmSections(content), "A\nB\nC");
  });

  it("verschweigt bei fehlender Schlussmarke den Rest — fail closed", () => {
    const content = "Sichtbar\n:::dm\nGeheim\nNoch geheimer";
    const sections = findDmSections(content);
    assert.equal(sections.length, 1);
    assert.equal(sections[0].unclosed, true);
    assert.equal(stripDmSections(content), "Sichtbar\n");
  });

  it("beendet den Bereich bei der ersten Schlussmarke, verschachtelt nicht", () => {
    const content = ":::dm\neins\n:::dm\nzwei\n:::\ndanach";
    assert.equal(findDmSections(content).length, 1);
    assert.equal(stripDmSections(content), "danach");
  });

  it("lässt Inhalt ohne Marke unangetastet — dasselbe Objekt, nicht nur derselbe Text", () => {
    const content = "Ein ganz gewöhnlicher Absatz mit [[Wikilink]].";
    assert.equal(stripDmSections(content), content);
    assert.equal(hasDmSection(content), false);
  });

  it("hält Doppelpunkte mitten in der Zeile für Text, nicht für eine Marke", () => {
    const content = "Er murmelte ::: und ging. :::dm ist hier kein Zeilenanfang.";
    assert.equal(hasDmSection(content), false);
    assert.equal(stripDmSections(content), content);
  });

  it("ignoriert `dm` als Wortanfang eines anderen Wortes", () => {
    assert.equal(hasDmSection(":::dmg\nKein Bereich\n"), false);
  });
});

describe("dm-section — Rich-Text-HTML aus dem Editor", () => {
  const html =
    "<p>Vorlesetext</p><p>:::dm</p><p>Roderick ist der Verräter.</p><p>:::</p><p>Weiter</p>";

  it("schneidet Marken samt umschließendem Absatz heraus", () => {
    assert.equal(stripDmSections(html), "<p>Vorlesetext</p><p>Weiter</p>");
  });

  it("gibt den Rumpf ohne die Marken-Absätze zurück", () => {
    const [section] = findDmSections(html);
    assert.equal(
      html.slice(section.bodyStart, section.bodyEnd),
      "<p>Roderick ist der Verräter.</p>",
    );
  });

  it("erkennt die Marke auch mit Attributen am Wrapper", () => {
    const withAttrs = '<p class="x">:::dm</p><p>Geheim</p><p class="y">:::</p><p>Rest</p>';
    assert.equal(stripDmSections(withAttrs), "<p>Rest</p>");
  });

  it("erkennt die Marke in einer Überschrift", () => {
    assert.equal(stripDmSections("<h2>:::dm</h2><p>Geheim</p><h2>:::</h2><p>Rest</p>"), "<p>Rest</p>");
  });

  it("verschont einen Absatz, in dem neben der Marke noch Text steht", () => {
    const inline = "<p>Text und ::: mittendrin</p>";
    assert.equal(hasDmSection(inline), false);
  });

  it("verträgt ein <br> hinter der Marke", () => {
    assert.equal(stripDmSections("<p>:::dm<br /></p><p>Geheim</p><p>:::</p><p>Rest</p>"), "<p>Rest</p>");
  });
});

describe("splitDmSegments", () => {
  it("liefert Abschnitte in Dokumentreihenfolge mit ihren Fundstellen", () => {
    const content = "Vorher\n:::dm Notiz\nGeheim\n:::\nNachher";
    const segments = splitDmSegments(content);

    assert.deepEqual(
      segments.map((segment) => [segment.dm, segment.text.trim(), segment.title]),
      [
        [false, "Vorher", null],
        [true, "Geheim", "Notiz"],
        [false, "Nachher", null],
      ],
    );

    for (const segment of segments) {
      assert.equal(content.slice(segment.start, segment.end), segment.text);
    }
  });

  it("lässt leere Abschnitte weg", () => {
    const segments = splitDmSegments(":::dm\nGeheim\n:::");
    assert.equal(segments.length, 1);
    assert.equal(segments[0].dm, true);
  });

  it("gibt für leeren Inhalt nichts zurück", () => {
    assert.deepEqual(splitDmSegments(""), []);
  });
});

describe("preserveDmSections", () => {
  it("hängt die Bereiche des gespeicherten Stands an die Bearbeitung an", () => {
    const previous = "Mein Held\n:::dm\nIst insgeheim verflucht.\n:::\nEnde";
    const next = "Mein Held, neu geschrieben\nEnde";

    const merged = preserveDmSections(previous, next);
    assert.match(merged, /Mein Held, neu geschrieben/);
    assert.match(merged, /Ist insgeheim verflucht\./);
    assert.equal(extractDmSections(merged).length, 1);
  });

  it("verwirft Marken, die aus der Bearbeitung selbst kommen", () => {
    const merged = preserveDmSections("Alt", "Neu\n:::dm\nSelbst gebaut\n:::");
    assert.equal(hasDmSection(merged), false);
    assert.equal(merged, "Neu\n");
  });

  it("lässt eine Bearbeitung ohne gespeicherte Bereiche unverändert", () => {
    assert.equal(preserveDmSections("Alt", "Neu"), "Neu");
  });
});
