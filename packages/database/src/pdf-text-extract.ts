const MAX_PDF_BYTES = 10 * 1024 * 1024;

/**
 * Warum die Extraktion scheiterte. `empty_text` ist der einzige Fall, aus dem
 * ein Aufrufer sinnvoll auf OCR ausweichen kann — die übrigen bedeuten, dass
 * die Datei selbst nicht taugt. Vorher musste man dafür die Fehlermeldung
 * lesen; der Code macht die Unterscheidung belastbar.
 */
export type PdfExtractErrorCode = "empty_file" | "too_large" | "not_a_pdf" | "empty_text" | "parse_failed";

export class PdfExtractError extends Error {
  readonly code: PdfExtractErrorCode;

  constructor(message: string, code: PdfExtractErrorCode = "parse_failed") {
    super(message);
    this.name = "PdfExtractError";
    this.code = code;
  }
}

/** True, wenn der Fehler nur „kein Textlayer" heißt — der OCR-Pfad kann übernehmen. */
export function isMissingTextLayerError(error: unknown): boolean {
  return error instanceof PdfExtractError && error.code === "empty_text";
}

export interface ExtractPdfTextOptions {
  /** Größenlimit in Bytes; Default bleibt das 10-MB-Limit der Markdown-Pipelines. */
  maxBytes?: number;
}

/** Vorprüfungen, die für jeden Lesepfad gleich gelten. */
function assertReadablePdf(buffer: Buffer, maxBytes: number): void {
  if (buffer.length === 0) {
    throw new PdfExtractError("PDF-Datei ist leer.", "empty_file");
  }
  if (buffer.length > maxBytes) {
    throw new PdfExtractError(
      `PDF-Datei ist zu groß (max. ${Math.floor(maxBytes / (1024 * 1024))} MB).`,
      "too_large",
    );
  }
  if (!buffer.subarray(0, 4).toString("utf8").startsWith("%PDF")) {
    throw new PdfExtractError("Datei ist keine gültige PDF.", "not_a_pdf");
  }
}

/** Extract plain text from a PDF buffer for Import-Zentrale markdown pipelines. */
export async function extractPdfText(
  buffer: Buffer,
  options: ExtractPdfTextOptions = {},
): Promise<string> {
  assertReadablePdf(buffer, options.maxBytes ?? MAX_PDF_BYTES);

  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    const text = result.text.replace(/\r\n/g, "\n").trim();

    if (!text) {
      throw new PdfExtractError(
        "Kein Text in der PDF gefunden. Bitte gescanntes PDF mit OCR oder Markdown-Export nutzen.",
        "empty_text",
      );
    }

    return text;
  } catch (error) {
    if (error instanceof PdfExtractError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "PDF konnte nicht gelesen werden.";
    throw new PdfExtractError(message, "parse_failed");
  }
}

export interface PdfTextLayer {
  text: string;
  pageCount: number;
}

/**
 * Liest Textlayer und Seitenzahl, ohne bei fehlendem Text zu werfen. Der
 * OCR-Pfad braucht beides: den Text zur Qualitätsbewertung und die Seitenzahl
 * zur Planung des Renderns. Größen- und Formatprüfungen bleiben scharf.
 *
 * Bewusst ein einziger Parser-Durchlauf statt `extractPdfText` plus separater
 * Seitenzählung — Kampagnen-PDFs dürfen bis 300 MB groß sein, zweimal parsen
 * wäre dort teuer.
 */
export async function readPdfTextLayer(
  buffer: Buffer,
  options: ExtractPdfTextOptions = {},
): Promise<PdfTextLayer> {
  assertReadablePdf(buffer, options.maxBytes ?? MAX_PDF_BYTES);

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const info = await parser.getInfo();
    return {
      text: result.text.replace(/\r\n/g, "\n").trim(),
      pageCount: typeof info.total === "number" && info.total > 0 ? info.total : 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF konnte nicht gelesen werden.";
    throw new PdfExtractError(message, "parse_failed");
  } finally {
    await parser.destroy();
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
