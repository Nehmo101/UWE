import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { __testing } from "./page-viewer-service";

const { renderAssetBlockHtml } = __testing;

describe("Bildblöcke im Seiten-HTML", () => {
  it("rendert ein Asset als figure mit Bildquelle", () => {
    const html = renderAssetBlockHtml(
      { type: "image", assetId: "asset-1", content: "" },
      "",
    );

    assert.match(html, /<figure class="wiki-figure">/);
    assert.match(html, /src="\/api\/assets\/asset-1\/file"/);
    assert.match(html, /loading="lazy"/);
  });

  it("nutzt den Blocktext als Bildunterschrift und Alternativtext", () => {
    const html = renderAssetBlockHtml(
      { type: "map", assetId: "asset-2", content: "Karte der Höhle" },
      "<p>Karte der Höhle</p>",
    );

    assert.match(html, /alt="Karte der Höhle"/);
    assert.match(html, /<figcaption><p>Karte der Höhle<\/p><\/figcaption>/);
  });

  it("fällt ohne Blocktext auf einen sinnvollen Alternativtext zurück", () => {
    const html = renderAssetBlockHtml(
      { type: "image", assetId: "asset-3", content: null },
      "",
    );

    assert.match(html, /alt="Bild zur Seite"/);
    assert.ok(!html.includes("<figcaption>"));
  });

  it("maskiert HTML im Blocktext, statt es auszuführen", () => {
    const html = renderAssetBlockHtml(
      { type: "image", assetId: "a", content: '"><script>alert(1)</script>' },
      "",
    );

    assert.ok(!html.includes("<script>"));
    assert.match(html, /&quot;&gt;&lt;script&gt;/);
  });

  it("maskiert eine Asset-ID, die aus der URL ausbrechen will", () => {
    const html = renderAssetBlockHtml(
      { type: "image", assetId: '"onerror="alert(1)', content: "" },
      "",
    );

    assert.ok(!html.includes('"onerror="alert(1)'));
    assert.match(html, /src="\/api\/assets\/%22onerror%3D%22alert\(1\)\/file"/);
  });

  it("lässt Textblöcke unverändert durch", () => {
    const html = renderAssetBlockHtml(
      { type: "rich_text", assetId: null, content: "Nur Text" },
      "<p>Nur Text</p>",
    );

    assert.equal(html, "<p>Nur Text</p>");
  });

  it("rendert kein Bild, wenn der Block kein Asset trägt", () => {
    const html = renderAssetBlockHtml({ type: "image", assetId: null, content: "" }, "<p>x</p>");

    assert.equal(html, "<p>x</p>");
  });

  it("rendert kein Bild für Blocktypen ohne Bildbezug", () => {
    // Ein statblock-Block mit Asset bleibt Text — sonst würde ein
    // versehentlich gesetztes Asset unerwartet als Bild auftauchen.
    const html = renderAssetBlockHtml(
      { type: "statblock", assetId: "asset-9", content: "" },
      "<p>Werte</p>",
    );

    assert.equal(html, "<p>Werte</p>");
  });
});
