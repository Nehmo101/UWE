import assert from "node:assert/strict";
import test from "node:test";
import { assessTextLayer } from "./text-layer";

test("dichter Textlayer braucht kein OCR", () => {
  const result = assessTextLayer({ text: "Wort ".repeat(200), pageCount: 2 });

  assert.equal(result.verdict, "usable");
  assert.equal(result.needsOcr, false);
});

test("leerer Textlayer verlangt OCR", () => {
  const result = assessTextLayer({ text: "   \n\n ", pageCount: 40 });

  assert.equal(result.verdict, "absent");
  assert.equal(result.needsOcr, true);
  assert.equal(result.charsPerPage, 0);
});

test("dünner Scan-Textlayer verlangt OCR", () => {
  // Nur eine Kopfzeile pro Seite — geht heute durch extractPdfText, ist für
  // die Entitäts-Extraktion aber wertlos.
  const result = assessTextLayer({ text: "Kapitel 1\n".repeat(20), pageCount: 40 });

  assert.equal(result.verdict, "sparse");
  assert.equal(result.needsOcr, true);
});

test("kaputte Zeichenkodierung verlangt OCR", () => {
  const broken = String.fromCharCode(0xfffd).repeat(600);
  const result = assessTextLayer({ text: broken + "echter Text", pageCount: 1 });

  assert.equal(result.verdict, "garbled");
  assert.equal(result.needsOcr, true);
});

test("Tab und Zeilenumbruch gelten nicht als kaputt", () => {
  const result = assessTextLayer({ text: "Zeile\tmit\tTabs\n".repeat(40), pageCount: 1 });

  assert.equal(result.verdict, "usable");
});

test("pageCount 0 wird als eine Seite gewertet, statt durch Null zu teilen", () => {
  const result = assessTextLayer({ text: "x".repeat(500), pageCount: 0 });

  assert.equal(result.charsPerPage, 500);
  assert.equal(Number.isFinite(result.charsPerPage), true);
});
