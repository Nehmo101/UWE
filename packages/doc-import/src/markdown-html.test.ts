import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { markdownToSummary, markdownToWikiHtml } from "./markdown-html";

describe("markdownToWikiHtml", () => {
  it("renders the tables that UWE's runtime renderer cannot", () => {
    const html = markdownToWikiHtml(
      ["| Stunde | Was geschah |", "|---|---|", "| **1** | Die letzte Ladung zündet. |"].join("\n"),
    );

    assert.ok(html.includes("<table>"));
    assert.ok(html.includes("<th>Stunde</th>"));
    assert.ok(html.includes("<strong>1</strong>"));
  });

  it("renders bold, italics and block quotes", () => {
    const html = markdownToWikiHtml("> **Vorlesen:**\n> *Die Straßen von Validori enden nicht.*");

    assert.ok(html.includes("<blockquote>"));
    assert.ok(html.includes("<strong>Vorlesen:</strong>"));
    assert.ok(html.includes("<em>"));
  });

  it("leaves wikilinks untouched — they resolve at render time", () => {
    const html = markdownToWikiHtml("Bürgermeister von [[ferlor]] und [[xarza|der Hexe]].");

    assert.ok(html.includes("[[ferlor]]"));
    assert.ok(html.includes("[[xarza|der Hexe]]"));
  });

  it("keeps wikilinks intact inside table cells", () => {
    const html = markdownToWikiHtml("| Ort | Wer |\n|---|---|\n| [[ferlor]] | [[pellar]] |");

    assert.ok(html.includes("[[ferlor]]"));
    assert.ok(html.includes("[[pellar]]"));
  });

  it("produces markup that `looksLikeHtml` recognises", () => {
    // Dieselbe Heuristik wie page-service.ts — sonst würde der Import als
    // Klartext escapt und die Tabellen erschienen als rohe Pipe-Zeichen.
    const htmlMarkupPattern =
      /<(?:p|br|div|span|ul|ol|li|h[1-6]|strong|em|b|i|u|s|a|blockquote|pre|code|img|hr|figure|figcaption|table|thead|tbody|tr|td|th)\b[^>]*>/i;

    assert.match(markdownToWikiHtml("Ein einfacher Absatz."), htmlMarkupPattern);
    assert.match(markdownToWikiHtml("| a |\n|---|\n| b |"), htmlMarkupPattern);
  });

  it("gives headings stable, unique ids so a bookmark can find them again", () => {
    const html = markdownToWikiHtml("## Auf einen Blick\n\ntext\n\n## Auf einen Blick\n\ntext");

    assert.ok(html.includes('id="auf-einen-blick"'));
    assert.ok(html.includes('id="auf-einen-blick-2"'));
  });

  it("returns an empty string for empty input", () => {
    assert.equal(markdownToWikiHtml(""), "");
    assert.equal(markdownToWikiHtml("   \n  "), "");
  });
});

describe("markdownToSummary", () => {
  it("takes the first real paragraph and strips markup", () => {
    const summary = markdownToSummary(
      [
        "**Harengon · 47 · Bürgermeister von [[ferlor]]**",
        "",
        "Hellbraunes Fell mit silbrig werdenden Ohrspitzen.",
      ].join("\n"),
    );

    assert.equal(summary, "Harengon · 47 · Bürgermeister von ferlor");
  });

  it("skips tables, quotes, lists and headings", () => {
    const summary = markdownToSummary(
      ["## Auf einen Blick", "", "| a | b |", "|---|---|", "", "> Zitat", "", "Der echte Text."].join(
        "\n",
      ),
    );

    assert.equal(summary, "Der echte Text.");
  });

  it("truncates on a word boundary", () => {
    const summary = markdownToSummary("Ein sehr langer Satz über den Flüsterforst und seine Halme.", 30);

    assert.ok(summary);
    assert.ok(summary.length <= 30);
    assert.ok(summary.endsWith("…"));
    assert.ok(!summary.includes("  "));
  });

  it("returns null when there is nothing usable", () => {
    assert.equal(markdownToSummary(""), null);
    assert.equal(markdownToSummary("# Nur eine Überschrift"), null);
  });
});
