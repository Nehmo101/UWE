import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractPdfText,
  isMissingTextLayerError,
  normalizePdfTextForImport,
  PdfExtractError,
  readPdfTextLayer,
} from "./pdf-text-extract";

describe("pdf text extract", () => {
  it("wraps extracted text with frontmatter", () => {
    const markdown = normalizePdfTextForImport("Hello World", "my-notes.pdf");
    assert.match(markdown, /title: my notes/);
    assert.match(markdown, /Hello World/);
  });

  it("rejects invalid pdf buffer", async () => {
    await assert.rejects(
      () => extractPdfText(Buffer.from("not a pdf")),
      (error: unknown) => error instanceof PdfExtractError,
    );
  });

  it("kennzeichnet die Fehlerursache über einen Code", async () => {
    await assert.rejects(
      () => extractPdfText(Buffer.alloc(0)),
      (error: unknown) => error instanceof PdfExtractError && error.code === "empty_file",
    );
    await assert.rejects(
      () => extractPdfText(Buffer.from("not a pdf")),
      (error: unknown) => error instanceof PdfExtractError && error.code === "not_a_pdf",
    );
    await assert.rejects(
      () => extractPdfText(Buffer.from("%PDF" + "x".repeat(64)), { maxBytes: 8 }),
      (error: unknown) => error instanceof PdfExtractError && error.code === "too_large",
    );
  });

  it("erkennt nur den fehlenden Textlayer als OCR-fähigen Fall", () => {
    assert.equal(isMissingTextLayerError(new PdfExtractError("x", "empty_text")), true);
    assert.equal(isMissingTextLayerError(new PdfExtractError("x", "not_a_pdf")), false);
    assert.equal(isMissingTextLayerError(new Error("x")), false);
  });

  it("readPdfTextLayer reicht harte Dateifehler weiter, statt sie zu verschlucken", async () => {
    // Nur `empty_text` darf zu einem leeren Ergebnis werden — eine kaputte
    // Datei muss weiterhin scheitern, sonst rendert der OCR-Pfad ins Leere.
    await assert.rejects(
      () => readPdfTextLayer(Buffer.from("not a pdf")),
      (error: unknown) => error instanceof PdfExtractError && error.code === "not_a_pdf",
    );
  });
});
