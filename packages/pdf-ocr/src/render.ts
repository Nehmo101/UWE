/**
 * PDF-Seite → Rasterbild. Läuft über `pdf-parse` (`getScreenshot`), das
 * `@napi-rs/canvas` bereits als harte Abhängigkeit mitbringt — es braucht also
 * weder pdfjs-dist noch mupdf noch poppler zusätzlich.
 *
 * Der Import ist dynamisch, damit `pdf-parse` nicht in Bundles landet, die es
 * nie ausführen (gleiche Handhabung wie in `extractPdfText`).
 */

export class PdfRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfRenderError";
  }
}

export interface RenderedPdfPage {
  /** 1-basierte Seitenzahl. */
  pageNumber: number;
  /** PNG-Rohdaten der gerenderten Seite. */
  png: Buffer;
  width: number;
  height: number;
}

/**
 * Renderbreite in Pixeln. 1600 entspricht dem, was
 * `downscaleImageForVision` ohnehin als Kantenlimit durchlässt — größer zu
 * rendern kostet nur Zeit und Speicher, ohne dass mehr beim Modell ankommt.
 */
export const DEFAULT_RENDER_WIDTH = 1600;

interface PdfParseModule {
  PDFParse: new (options: { data: Buffer }) => {
    getInfo(): Promise<{ total?: number }>;
    getScreenshot(params?: {
      partial?: number[];
      desiredWidth?: number;
      imageBuffer?: boolean;
      imageDataUrl?: boolean;
    }): Promise<{
      pages?: { pageNumber?: number; data?: Uint8Array; width?: number; height?: number }[];
    }>;
    destroy(): Promise<void>;
  };
}

async function loadPdfParse(): Promise<PdfParseModule> {
  return (await import("pdf-parse")) as unknown as PdfParseModule;
}

/** Seitenzahl eines PDF-Puffers, ohne den Inhalt zu rendern. */
export async function readPdfPageCount(buffer: Buffer): Promise<number> {
  const { PDFParse } = await loadPdfParse();
  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo();
    return typeof info.total === "number" && info.total > 0 ? info.total : 0;
  } finally {
    await parser.destroy();
  }
}

/**
 * Rendert die angeforderten Seiten. `pages` ist 1-basiert; eine leere Liste
 * rendert nichts (und ist kein Fehler — der Aufrufer entscheidet über Caps).
 */
export async function renderPdfPages(
  buffer: Buffer,
  options: { pages: readonly number[]; desiredWidth?: number },
): Promise<RenderedPdfPage[]> {
  if (options.pages.length === 0) {
    return [];
  }

  const { PDFParse } = await loadPdfParse();
  const parser = new PDFParse({ data: buffer });
  try {
    const shot = await parser.getScreenshot({
      partial: [...options.pages],
      desiredWidth: options.desiredWidth ?? DEFAULT_RENDER_WIDTH,
      imageBuffer: true,
      imageDataUrl: false,
    });

    const rendered: RenderedPdfPage[] = [];
    for (const [index, page] of (shot.pages ?? []).entries()) {
      if (!page?.data?.length) {
        continue;
      }
      rendered.push({
        // Fällt `pageNumber` aus, ist die Reihenfolge von `partial` maßgeblich.
        pageNumber: page.pageNumber ?? options.pages[index] ?? index + 1,
        png: Buffer.from(page.data),
        width: page.width ?? 0,
        height: page.height ?? 0,
      });
    }
    return rendered;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    throw new PdfRenderError(`PDF-Seiten konnten nicht gerendert werden: ${message}`);
  } finally {
    await parser.destroy();
  }
}
