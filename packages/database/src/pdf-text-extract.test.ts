import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePdfTextForImport, PdfExtractError, extractPdfText } from "./pdf-text-extract";

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
});
