import test from "node:test";
import assert from "node:assert/strict";
import { renderContentHtml, type PageViewLink } from "./page-service";

const NO_LINKS: PageViewLink[] = [];

test("wraps plain prose in a paragraph", () => {
  assert.equal(renderContentHtml("Hallo Welt", NO_LINKS), "<p>Hallo Welt</p>");
});

test("separates blank-line-delimited paragraphs", () => {
  assert.equal(renderContentHtml("Erster Absatz\n\nZweiter Absatz", NO_LINKS), "<p>Erster Absatz</p><p>Zweiter Absatz</p>");
});

test("keeps single newlines as soft breaks inside a paragraph", () => {
  assert.equal(renderContentHtml("Zeile eins\nZeile zwei", NO_LINKS), "<p>Zeile eins<br />Zeile zwei</p>");
});

test("renders markdown headings as heading elements", () => {
  assert.equal(
    renderContentHtml("# Kapitel\n\nInhalt", NO_LINKS),
    '<h1 class="wiki-heading">Kapitel</h1><p>Inhalt</p>',
  );
  assert.equal(
    renderContentHtml("### Unterpunkt", NO_LINKS),
    '<h3 class="wiki-heading">Unterpunkt</h3>',
  );
});

test("renders dash/star bullets as an unordered list", () => {
  assert.equal(
    renderContentHtml("- eins\n- zwei\n* drei", NO_LINKS),
    "<ul><li>eins</li><li>zwei</li><li>drei</li></ul>",
  );
});

test("renders a resolved wikilink as a clickable anchor", () => {
  const content = "Siehe [[Aman]] im Untergrund.";
  const links: PageViewLink[] = [{ displayText: "Aman", href: "/worlds/terra/npcs/aman", status: "resolved" }];
  assert.equal(
    renderContentHtml(content, links),
    '<p>Siehe <a href="/worlds/terra/npcs/aman" class="wiki-link">Aman</a> im Untergrund.</p>',
  );
});

test("renders a broken wikilink as a marked span (no navigation)", () => {
  const content = "Kontakt zu [[Unbekannt]].";
  const links: PageViewLink[] = [{ displayText: "Unbekannt", status: "broken" }];
  assert.equal(
    renderContentHtml(content, links),
    '<p>Kontakt zu <span class="wiki-link-broken" title="Seite nicht gefunden">Unbekannt</span>.</p>',
  );
});

test("escapes HTML-significant characters in prose", () => {
  assert.equal(renderContentHtml('a < b & c "d"', NO_LINKS), "<p>a &lt; b &amp; c &quot;d&quot;</p>");
});

test("returns empty string for empty content", () => {
  assert.equal(renderContentHtml("", NO_LINKS), "");
  assert.equal(renderContentHtml("\n\n", NO_LINKS), "");
});

test("combines headings, lists and paragraphs with wikilinks", () => {
  const content = "# Beziehungen\n\n- Freund: [[Aman]]\n- Gegner: Imperium\n\nEnde.";
  const links: PageViewLink[] = [{ displayText: "Aman", href: "/a", status: "resolved" }];
  assert.equal(
    renderContentHtml(content, links),
    '<h1 class="wiki-heading">Beziehungen</h1>' +
      '<ul><li>Freund: <a href="/a" class="wiki-link">Aman</a></li><li>Gegner: Imperium</li></ul>' +
      "<p>Ende.</p>",
  );
});
