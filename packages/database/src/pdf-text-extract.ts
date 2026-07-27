const MAX_PDF_BYTES = 10 * 1024 * 1024;

export class PdfExtractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfExtractError";
  }
}

export interface ExtractPdfTextOptions {
  /** Größenlimit in Bytes; Default bleibt das 10-MB-Limit der Markdown-Pipelines. */
  maxBytes?: number;
}

/** Extract plain text from a PDF buffer for Import-Zentrale markdown pipelines. */
export async function extractPdfText(
  buffer: Buffer,
  options: ExtractPdfTextOptions = {},
): Promise<string> {
  const maxBytes = options.maxBytes ?? MAX_PDF_BYTES;
  if (buffer.length === 0) {
    throw new PdfExtractError("PDF-Datei ist leer.");
  }
  if (buffer.length > maxBytes) {
    throw new PdfExtractError(
      `PDF-Datei ist zu groß (max. ${Math.floor(maxBytes / (1024 * 1024))} MB).`,
    );
  }

  if (!buffer.subarray(0, 4).toString("utf8").startsWith("%PDF")) {
    throw new PdfExtractError("Datei ist keine gültige PDF.");
  }

  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    const text = result.text.replace(/\r\n/g, "\n").trim();

    if (!text) {
      throw new PdfExtractError(
        "Kein Text in der PDF gefunden. Bitte gescanntes PDF mit OCR oder Markdown-Export nutzen.",
      );
    }

    return text;
  } catch (error) {
    if (error instanceof PdfExtractError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "PDF konnte nicht gelesen werden.";
    throw new PdfExtractError(message);
  }
}

export function normalizePdfTextForImport(text: string, fileName?: string | null): string {
  const title =
    fileName?.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "PDF Import";

  const trimmed = text.trim();
  if (trimmed.startsWith("---")) {
    return trimmed;
  }

  return `---
title: ${title}
source: pdf
---

${trimmed}`;
}
