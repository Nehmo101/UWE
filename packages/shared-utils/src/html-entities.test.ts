import assert from "node:assert/strict";
import test from "node:test";

import { decodeHtmlEntities } from "./html-entities";

test("übersetzt die fünf Maskierungen zurück, die ein HTML-Escaper vornimmt", () => {
  assert.equal(decodeHtmlEntities("A&#39;Tuin"), "A'Tuin");
  assert.equal(decodeHtmlEntities("Schätze &amp; Gegenstände"), "Schätze & Gegenstände");
  assert.equal(decodeHtmlEntities("Ravenna „Dreifinger&quot; Kol"), 'Ravenna „Dreifinger" Kol');
  assert.equal(decodeHtmlEntities("a &lt; b"), "a < b");
  assert.equal(decodeHtmlEntities("a &gt; b"), "a > b");
  assert.equal(decodeHtmlEntities("K&apos;avesh"), "K'avesh");
});

test("versteht die führenden Nullen der numerischen Apostroph-Form", () => {
  assert.equal(decodeHtmlEntities("A&#039;Tuin"), "A'Tuin");
  assert.equal(decodeHtmlEntities("A&#0039;Tuin"), "A'Tuin");
});

test("lässt Text ohne Entitäten unverändert", () => {
  for (const value of ["", "Nepurga", "Der Magisterturm", "A'Tuin", "a < b"]) {
    assert.equal(decodeHtmlEntities(value), value);
  }
});

test("entschlüsselt nur eine Ebene — &amp;lt; wird &lt;, nicht <", () => {
  // Sonst würde ein Titel, der die Zeichenfolge „&lt;" wirklich enthält, beim
  // Lesen zu „<" und fände seine Seite nicht mehr.
  assert.equal(decodeHtmlEntities("&amp;lt;"), "&lt;");
  assert.equal(decodeHtmlEntities("&amp;amp;"), "&amp;");
  assert.equal(decodeHtmlEntities("&amp;#39;"), "&#39;");
});

test("fasst Entitäten nicht an, die kein Maskierer erzeugt hat", () => {
  assert.equal(decodeHtmlEntities("Caf&eacute;"), "Caf&eacute;");
  assert.equal(decodeHtmlEntities("100&nbsp;GM"), "100&nbsp;GM");
  assert.equal(decodeHtmlEntities("&#8212;"), "&#8212;");
});
