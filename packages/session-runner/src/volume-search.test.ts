import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ReadingPage } from "./reading-order";
import { buildVolume } from "./volume";
import {
  buildSnippet,
  findMatchRanges,
  highlightHtml,
  normalizeQuery,
  plainTextFromHtml,
  searchSections,
  searchVolume,
  type SearchableSection,
} from "./volume-search";

const PAGES: ReadingPage[] = [
  { id: "root", parentPageId: null, sortIndex: null, title: "Der Turm", slug: "turm", type: "dungeon" },
  { id: "e1", parentPageId: "root", sortIndex: 0, title: "Ebene 1", slug: "ebene-1", type: "dungeon_level" },
  { id: "r1", parentPageId: "e1", sortIndex: 0, title: "Der Wirt", slug: "der-wirt", type: "room" },
  { id: "e2", parentPageId: "root", sortIndex: 1, title: "Ebene 2", slug: "ebene-2", type: "dungeon_level" },
];

const HTML = new Map([
  ["root", "<p>Ein Turm am Meer.</p>"],
  ["e1", "<p>Der Wirt heißt Gorm.</p>"],
  ["r1", "<p>Gorm schweigt. Gorm lügt.</p>"],
  ["e2", "<p>Leer bis auf Staub.</p>"],
]);

function section(id: string, text: string, title = id): SearchableSection {
  return { id, title, slug: id, type: "note", depth: 1, anchor: `abschnitt-${id}`, text };
}

describe("normalizeQuery", () => {
  it("putzt Weißraum und lässt zu kurze Begriffe fallen", () => {
    assert.equal(normalizeQuery("  der   Wirt \n"), "der Wirt");
    assert.equal(normalizeQuery(" a "), "");
    assert.equal(normalizeQuery(null), "");
  });
});

describe("findMatchRanges", () => {
  it("findet ohne Rücksicht auf Groß-/Kleinschreibung", () => {
    assert.deepEqual(findMatchRanges("Der Wirt und der Wirt", "wirt"), [
      { start: 4, end: 8 },
      { start: 17, end: 21 },
    ]);
  });

  it("findet Umlaute wie geschrieben", () => {
    assert.deepEqual(findMatchRanges("Er LÜGT", "lügt"), [{ start: 3, end: 7 }]);
  });

  it("überspringt Zeilenumbrüche innerhalb der Wortfolge", () => {
    const ranges = findMatchRanges("Der\n  Wirt schweigt", "der wirt");
    assert.deepEqual(
      ranges.map((range) => "Der\n  Wirt schweigt".slice(range.start, range.end)),
      ["Der\n  Wirt"],
    );
  });

  it("findet keine Wortmenge, nur die Folge", () => {
    assert.deepEqual(findMatchRanges("Wirt der Ebene", "der wirt"), []);
  });

  it("hält sich an das Limit", () => {
    assert.equal(findMatchRanges("aa aa aa aa", "aa", 2).length, 2);
  });
});

describe("buildSnippet", () => {
  it("setzt Auslassungen und schneidet an Wortgrenzen", () => {
    const text = "Weit vor dem Tor der Stadt wartet der Wirt auf jeden, der ihm etwas schuldet.";
    const range = findMatchRanges(text, "wirt")[0];
    const snippet = buildSnippet(text, range, 12);

    assert.equal(snippet.match, "Wirt");
    assert.ok(snippet.before.startsWith("… "), snippet.before);
    assert.ok(snippet.after.endsWith(" …"), snippet.after);
    assert.ok(!snippet.before.includes("wartet der Wirt"));
  });

  it("lässt kurze Ränder unangetastet", () => {
    const snippet = buildSnippet("Der Wirt", { start: 4, end: 8 });
    assert.deepEqual(snippet, { before: "Der ", match: "Wirt", after: "" });
  });
});

describe("plainTextFromHtml", () => {
  it("wirft Tags weg und übersetzt Entities zurück", () => {
    assert.equal(
      plainTextFromHtml('<p>Gorm &amp; Sohn</p><p><a href="/wirt">Der Wirt</a></p>'),
      "Gorm & Sohn Der Wirt",
    );
  });

  it("zerreißt kein Wort an einem Inline-Tag", () => {
    // Der Import verlinkt Begriffe mitten im Wort — mit Leerzeichen dazwischen
    // stünde „Aetherit -Gilde" im Ausschnitt und die Suche fände es nicht.
    const text = plainTextFromHtml('<p>Die <a href="/aetherit">Aetherit</a>-Gilde schweigt<em>.</em></p>');
    assert.equal(text, "Die Aetherit-Gilde schweigt.");
    assert.equal(findMatchRanges(text, "aetherit-gilde").length, 1);
  });

  it("klebt Blöcke nicht aneinander", () => {
    // Ohne Trennung stünde hier „TorDer" und „torder" wäre ein Treffer.
    assert.equal(plainTextFromHtml("<p>Tor</p><p>Der Wirt</p>"), "Tor Der Wirt");
    assert.deepEqual(findMatchRanges(plainTextFromHtml("<p>Tor</p><p>Der</p>"), "torder"), []);
  });

  it("wirft Kommentare weg, auch unabgeschlossene", () => {
    assert.equal(plainTextFromHtml("<p>Vor<!-- versteckt -->nach</p>"), "Vor nach");
    assert.equal(plainTextFromHtml("<p>Vor<!-- ohne Ende</p>"), "Vor");
  });

  it("bleibt auf entartetem Markup schnell", () => {
    // Regressionsschutz gegen zwei quadratische Regex-Vorgänger (CodeQL
    // js/polynomial-redos): viele offene Kommentare, und ein nie geschlossenes
    // Tag, dessen Name sich mit dem Attributteil überlappte. Beides brauchte
    // dort Sekunden statt Millisekunden.
    for (const html of [`<p>${"<!--".repeat(20_000)}</p>`, `<p><A${"-".repeat(40_000)}`]) {
      const started = process.hrtime.bigint();
      plainTextFromHtml(html);
      const millis = Number(process.hrtime.bigint() - started) / 1e6;
      assert.ok(millis < 500, `plainTextFromHtml brauchte ${millis.toFixed(0)} ms`);
    }
  });

  it("wirft ein unabgeschlossenes Tag samt Rest weg", () => {
    assert.equal(plainTextFromHtml("<p>Vor<a href='/x' Rest ohne Klammer"), "Vor");
  });

  it("übersetzt maskierte Entities nicht doppelt", () => {
    assert.equal(plainTextFromHtml("<p>&amp;lt;dm&amp;gt;</p>"), "&lt;dm&gt;");
  });
});

describe("highlightHtml", () => {
  it("markiert Treffer im Text", () => {
    assert.equal(
      highlightHtml("<p>Der Wirt lügt.</p>", "wirt"),
      '<p>Der <mark class="uwe-treffer">Wirt</mark> lügt.</p>',
    );
  });

  it("markiert alle Treffer", () => {
    const marked = highlightHtml("<p>Gorm schweigt. Gorm lügt.</p>", "gorm");
    assert.equal(marked.match(/<mark/g)?.length, 2);
  });

  it("lässt Attributwerte in Ruhe", () => {
    // „wirt" steht im href — ein <mark> darin würde das Markup zerlegen.
    assert.equal(
      highlightHtml('<a href="/der-wirt" title="wirt">Gorm</a>', "wirt"),
      '<a href="/der-wirt" title="wirt">Gorm</a>',
    );
  });

  it("zerlegt keine Entities", () => {
    assert.equal(highlightHtml("<p>Gorm &amp; Sohn</p>", "amp"), "<p>Gorm &amp; Sohn</p>");
  });

  it("markiert nicht über eine Tag-Grenze hinweg", () => {
    // Der Preis der Sicherheit: der Klartext trifft, das Markup bleibt heil.
    const html = "<p>des <em>Turms</em></p>";
    assert.equal(highlightHtml(html, "des turms"), html);
    assert.equal(findMatchRanges(plainTextFromHtml(html), "des turms").length, 1);
  });

  it("gibt bei leerem Begriff das Original zurück", () => {
    assert.equal(highlightHtml("<p>Gorm</p>", " a "), "<p>Gorm</p>");
  });
});

describe("searchSections", () => {
  it("behält die Eingabereihenfolge und zählt Treffer", () => {
    const hits = searchSections(
      [section("a", "Gorm wartet."), section("b", "Nichts."), section("c", "Gorm und Gorm.")],
      "gorm",
    );

    assert.deepEqual(
      hits.map((hit) => [hit.id, hit.matches]),
      [
        ["a", 1],
        ["c", 2],
      ],
    );
  });

  it("nimmt Titeltreffer ohne Textreffer mit", () => {
    const hits = searchSections([section("a", "Nichts davon.", "Der Wirt")], "wirt");
    assert.deepEqual(
      hits.map((hit) => [hit.titleMatch, hit.matches]),
      [[true, 0]],
    );
  });

  it("begrenzt die Ausschnitte je Abschnitt", () => {
    const hits = searchSections([section("a", "Gorm Gorm Gorm Gorm")], "gorm", { snippetsPerSection: 2 });
    assert.equal(hits[0].matches, 4);
    assert.equal(hits[0].snippets.length, 2);
  });

  it("sucht bei leerem Begriff nicht", () => {
    assert.deepEqual(searchSections([section("a", "Gorm")], " "), []);
  });
});

describe("searchVolume", () => {
  it("findet über den ganzen Band und markiert nur die Trefferabschnitte", () => {
    const volume = buildVolume(PAGES, "root", { htmlById: HTML })!;
    const result = searchVolume(volume, "Gorm");

    assert.equal(result.query, "Gorm");
    assert.equal(result.matches, 3);
    assert.deepEqual(
      result.hits.map((hit) => [hit.title, hit.matches]),
      [
        ["Ebene 1", 1],
        ["Der Wirt", 2],
      ],
    );
    assert.deepEqual([...result.htmlById.keys()], ["e1", "r1"]);
    assert.ok(result.htmlById.get("r1")?.includes('<mark class="uwe-treffer">Gorm</mark>'));
  });

  it("markiert Abschnitte ohne Textreffer nicht", () => {
    const volume = buildVolume(PAGES, "root", { htmlById: HTML })!;
    const result = searchVolume(volume, "Ebene 2");

    assert.deepEqual(
      result.hits.map((hit) => [hit.title, hit.titleMatch, hit.matches]),
      [["Ebene 2", true, 0]],
    );
    assert.equal(result.htmlById.size, 0);
  });

  it("gibt bei zu kurzem Begriff ein leeres Ergebnis", () => {
    const volume = buildVolume(PAGES, "root", { htmlById: HTML })!;
    const result = searchVolume(volume, "a");

    assert.equal(result.query, "");
    assert.deepEqual(result.hits, []);
    assert.equal(result.matches, 0);
  });
});
