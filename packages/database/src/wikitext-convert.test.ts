import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  autoLinkWikitext,
  buildWikitextLinkTerms,
  convertWikitext,
  structureWikitext,
} from "./wikitext-convert";

describe("structureWikitext", () => {
  it("normalizes headings, bullets and blank lines", () => {
    const input = "#Titel   \nText direkt darunter.\n\n\n\n* Punkt eins\n+ Punkt zwei   ";
    const expected =
      "# Titel\n\nText direkt darunter.\n\n- Punkt eins\n- Punkt zwei";
    assert.equal(structureWikitext(input), expected);
  });

  it("adds blank lines around headings", () => {
    const input = "Intro.\n## Kapitel\nInhalt.";
    assert.equal(structureWikitext(input), "Intro.\n\n## Kapitel\n\nInhalt.");
  });

  it("strips trailing heading decorations", () => {
    assert.equal(structureWikitext("## Kapitel ##"), "## Kapitel");
  });

  it("leaves code fences untouched", () => {
    const input = "Text\n\n```\n#kein Heading\n* kein Bullet   \n\n\n\nInhalt\n```\n\nEnde";
    assert.equal(structureWikitext(input), input);
  });

  it("leaves opening fence lines untouched including trailing whitespace", () => {
    const input = "```js  \nconst a = 1;\n```";
    assert.equal(structureWikitext(input), input);
  });

  it("does not promote hash-tags that are no headings", () => {
    assert.equal(structureWikitext("#42 ist eine Zahl"), "#42 ist eine Zahl");
  });

  it("normalizes CRLF line endings", () => {
    assert.equal(structureWikitext("Zeile eins\r\nZeile zwei"), "Zeile eins\nZeile zwei");
  });

  it("is idempotent", () => {
    const input = "#Titel\nText mit * Sternchen am Zeilenanfang? Nein.\n\n\n* Liste";
    const once = structureWikitext(input);
    assert.equal(structureWikitext(once), once);
  });
});

describe("autoLinkWikitext", () => {
  const terms = [
    { term: "Gandalf", target: "Gandalf" },
    { term: "Schwarzer Turm", target: "Schwarzer Turm" },
    { term: "Turm", target: "Schwarzer Turm" },
    { term: "der Graue", target: "Gandalf" },
  ];

  it("links the first plain mention of a page title", () => {
    const result = autoLinkWikitext("Gandalf reist zum Schwarzer Turm.", terms);
    assert.equal(result.content, "[[Gandalf]] reist zum [[Schwarzer Turm]].");
    assert.equal(result.addedLinks.length, 2);
  });

  it("links each target at most once", () => {
    const result = autoLinkWikitext("Gandalf trifft Gandalf. Gandalf lacht.", terms);
    assert.equal(result.content, "[[Gandalf]] trifft Gandalf. Gandalf lacht.");
  });

  it("prefers longer terms over contained shorter ones", () => {
    const result = autoLinkWikitext("Der Schwarzer Turm ragt auf.", terms);
    assert.equal(result.content, "Der [[Schwarzer Turm]] ragt auf.");
  });

  it("uses a label when an alias matched", () => {
    const result = autoLinkWikitext("Man nennt ihn der Graue.", terms);
    assert.equal(result.content, "Man nennt ihn [[Gandalf|der Graue]].");
  });

  it("does not link inside existing wikilinks", () => {
    const result = autoLinkWikitext("[[Gandalf]] und [[Gandalf|der Zauberer]].", terms);
    assert.equal(result.content, "[[Gandalf]] und [[Gandalf|der Zauberer]].");
    assert.equal(result.addedLinks.length, 0);
  });

  it("does not link inside headings, code or markdown links", () => {
    const input =
      "# Gandalf\n\n`Gandalf` im Code und [Gandalf](https://example.org) als Link.\n\n```\nGandalf im Fence\n```";
    const result = autoLinkWikitext(input, terms);
    assert.equal(result.content, input);
  });

  it("does not link inside multi-backtick code spans", () => {
    const input = "Nutze ``Gandalf`` und ``` Turm ` Gandalf ``` im Code.";
    const result = autoLinkWikitext(input, terms);
    assert.equal(result.content, input);
    assert.equal(result.addedLinks.length, 0);
  });

  it("matches case-insensitively but keeps the original text as label", () => {
    const result = autoLinkWikitext("gandalf kommt an.", terms);
    assert.equal(result.content, "[[Gandalf|gandalf]] kommt an.");
  });

  it("respects word boundaries including umlauts", () => {
    const result = autoLinkWikitext("Gandalfs Stab, Turmwächter, Türme.", terms);
    assert.equal(result.content, "Gandalfs Stab, Turmwächter, Türme.");
    assert.equal(result.addedLinks.length, 0);
  });

  it("ignores terms below the minimum length", () => {
    const result = autoLinkWikitext("Om ist kurz.", [{ term: "Om", target: "Om" }]);
    assert.equal(result.content, "Om ist kurz.");
  });
});

describe("convertWikitext", () => {
  it("structures and links in one pass", () => {
    const result = convertWikitext(
      "#Ankunft\nGandalf erreicht die Stadt.",
      [{ term: "Gandalf", target: "Gandalf" }],
    );
    assert.equal(result.content, "# Ankunft\n\n[[Gandalf]] erreicht die Stadt.");
    assert.equal(result.changed, true);
    assert.equal(result.structured, true);
    assert.deepEqual(result.addedLinks, [{ target: "Gandalf", matched: "Gandalf" }]);
  });

  it("reports unchanged content", () => {
    const input = "# Ankunft\n\n[[Gandalf]] erreicht die Stadt.";
    const result = convertWikitext(input, [{ term: "Gandalf", target: "Gandalf" }]);
    assert.equal(result.changed, false);
    assert.equal(result.content, input);
  });

  it("is idempotent", () => {
    const terms = [
      { term: "Gandalf", target: "Gandalf" },
      { term: "Schwarzer Turm", target: "Schwarzer Turm" },
    ];
    const once = convertWikitext("#Reise\nGandalf zieht zum Schwarzer Turm.", terms);
    const twice = convertWikitext(once.content, terms);
    assert.equal(twice.changed, false);
    assert.equal(twice.content, once.content);
  });
});

describe("buildWikitextLinkTerms", () => {
  const pages = [
    { id: "p1", title: "Gandalf", aliases: ["der Graue", "Mithrandir"] },
    { id: "p2", title: "Schwarzer Turm", aliases: [] },
    { id: "p3", title: "  ", aliases: ["Leer"] },
  ];

  it("excludes the current page and empty titles", () => {
    const terms = buildWikitextLinkTerms(pages, "p1");
    assert.deepEqual(terms, [{ term: "Schwarzer Turm", target: "Schwarzer Turm" }]);
  });

  it("maps aliases to the canonical title", () => {
    const terms = buildWikitextLinkTerms(pages, "p2");
    assert.deepEqual(terms, [
      { term: "Gandalf", target: "Gandalf" },
      { term: "der Graue", target: "Gandalf" },
      { term: "Mithrandir", target: "Gandalf" },
    ]);
  });
});
