import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { stripCanonMarkers } from "./canonical-status";
import { buildDocumentTree, normalizeBodyHeadings } from "./doc-tree";
import { markdownToWikiHtml } from "./markdown-html";
import { collectWikiLinkTargets } from "./relations";
import { extractDefinitionBullets, extractLabelledBlocks } from "./semantic/blocks";
import { linkEntityNames } from "./semantic/crosslink";
import { tidyHeadingText } from "./semantic/headings";
import { shiftHeadings } from "./semantic/fold";

/**
 * Regressionstest gegen quadratisches Zurücksetzen in den Mustern dieses Packages.
 *
 * Der Anlass war echt: vier Ausdrücke hier brauchten für 16 000 Zeichen rund
 * 200 ms — pro Zeile. Das Material kommt aus hochgeladenen Dokumenten, ein
 * Kampagnenbuch hat 1 778 Zeilen, und ein Absatz aus lauter Leerzeichen ist in
 * einem 190-KB-Markdown kein konstruierter Sonderfall.
 *
 * Gemessen wird bewusst mit **viel** Luft: linear braucht das hier unter 5 ms,
 * quadratisch läge bei über einer Minute. Zwischen beiden liegen Größenordnungen,
 * also wackelt der Test auch auf einem ausgelasteten CI-Läufer nicht.
 */

const SIZE = 200_000;
const BUDGET_MS = 2_000;

function within(label: string, run: () => void): void {
  const started = process.hrtime.bigint();
  run();
  const elapsed = Number(process.hrtime.bigint() - started) / 1e6;

  assert.ok(
    elapsed < BUDGET_MS,
    `${label} brauchte ${elapsed.toFixed(0)} ms für ${SIZE} Zeichen — das riecht nach ` +
      `quadratischem Zurücksetzen im Muster, nicht nach ehrlicher Arbeit.`,
  );
}

describe("Muster bleiben linear", () => {
  it("verkraftet eine Überschriftenzeile aus lauter Leerzeichen", () => {
    const line = `# ${" ".repeat(SIZE)}`;

    within("buildDocumentTree", () => {
      const tree = buildDocumentTree(line);
      // Rauten ohne Text sind keine Überschrift — sonst entstünde eine Seite ohne Titel.
      assert.equal(tree.nodes.length, 0);
    });
  });

  it("verkraftet denselben Fall beim Verschieben der Rumpf-Überschriften", () => {
    const line = `# ${" ".repeat(SIZE)}`;

    within("normalizeBodyHeadings", () => {
      assert.equal(normalizeBodyHeadings(line), line);
    });
  });

  it("verkraftet einen langen Weißraum-Lauf im Überschriftentext", () => {
    const title = `Teil 4 ◆${" ".repeat(SIZE)}!`;

    within("stripCanonMarkers", () => {
      const { marker } = stripCanonMarkers(title);
      assert.equal(marker, "canon");
    });
  });

  it("verkraftet rohes HTML mit lauter offenen Tags", () => {
    // `marked` reicht rohes HTML durch — offene Tags sind damit erreichbar.
    within("markdownToWikiHtml (offene h1)", () => {
      assert.ok(typeof markdownToWikiHtml("<h1>".repeat(SIZE / 4)) === "string");
    });

    within("markdownToWikiHtml (offene spitze Klammern)", () => {
      assert.ok(typeof markdownToWikiHtml(`<h1>x</h1>${"<".repeat(SIZE)}`) === "string");
    });
  });

  it("verkraftet einen Text aus lauter offenen Wikilink-Klammern", () => {
    within("collectWikiLinkTargets", () => {
      assert.deepEqual(collectWikiLinkTargets("[[".repeat(SIZE / 2)), []);
    });
  });

  it("liest gültige Wikilinks weiterhin, auch mit Beschriftung", () => {
    assert.deepEqual(collectWikiLinkTargets("Siehe [[Xarza]] und [[ferlor|Ferlor]]."), [
      "Xarza",
      "ferlor",
    ]);
  });

  it("nimmt Markup aus dem Überschriftentext, ohne an einer spitzen Klammer zu hängen", () => {
    const html = markdownToWikiHtml("# Der *Turm* von Validori\n\nText.");
    assert.match(html, /<h1 id="der-turm-von-validori">/);

    // `a < b` ist Text. Früher fraß der Tag-Entferner den Rest der Zeile.
    const mit = markdownToWikiHtml("# Wenn a < b gilt\n\nText.");
    assert.match(mit, /<h1 id="wenn-a-lt-b-gilt">/);
  });

  it("verkraftet ein Etikett ohne schließende Fettschrift", () => {
    // `^\*\*\s*(…)\s*\*\*` ließ die beiden `\s*` und die Gruppe dazwischen um
    // dieselben Leerzeichen streiten; ohne Abschluss wurde jede Aufteilung
    // durchprobiert.
    const line = `**${" ".repeat(SIZE)}`;

    within("extractLabelledBlocks", () => {
      assert.equal(extractLabelledBlocks(line).blocks.length, 0);
    });

    within("extractDefinitionBullets", () => {
      assert.equal(extractDefinitionBullets(`- **${" ".repeat(SIZE)}`).blocks.length, 0);
    });
  });

  it("verkraftet einen Text aus lauter offenen Klammerpaaren beim Verlinken", () => {
    // `\[\[[^\]]*\]\]` und `\]\([^)]*\)` setzten bei jedem Anfang neu an und
    // liefen von dort bis zum Textende.
    const targets = [{ title: "Nepurga" }];

    within("linkEntityNames ([[)", () => {
      assert.ok(typeof linkEntityNames("[[".repeat(SIZE / 2), targets) === "string");
    });

    within("linkEntityNames (](", () => {
      assert.ok(typeof linkEntityNames("](".repeat(SIZE / 2), targets) === "string");
    });
  });

  it("verkraftet einen Titel aus lauter Satzzeichen und Leerraum", () => {
    // `[\s—–\-:,;]+$` und `\s*\(…\)\s*$` werden an jeder Position neu angesetzt.
    within("tidyHeadingText (Satzzeichen)", () => {
      assert.equal(tidyHeadingText(`Turm${",".repeat(SIZE)}`), "Turm");
    });

    within("tidyHeadingText (offene Klammer)", () => {
      const title = `Turm (${" ".repeat(SIZE)}`;
      assert.ok(tidyHeadingText(title).startsWith("Turm"));
    });
  });

  it("verkraftet das Verschieben einer Überschrift aus lauter Leerraum", () => {
    const line = `#${"\t".repeat(SIZE)}`;

    within("shiftHeadings", () => {
      assert.equal(shiftHeadings(line, 1), line);
    });
  });

  it("gibt Überschriften weiterhin ihre id — auch verschachtelt und doppelt", () => {
    const html = markdownToWikiHtml("# Auf einen Blick\n\nText.\n\n# Auf einen Blick\n\nMehr.");

    assert.match(html, /<h1 id="auf-einen-blick">/);
    assert.match(html, /<h1 id="auf-einen-blick-2">/);
  });
});
