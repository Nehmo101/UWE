/**
 * Seitenplanung für den OCR-Lauf. OCR ist GPU-Arbeit in einer Lane mit
 * `LANE_CONCURRENCY.gpu = 1` — ein 400-Seiten-Band blockiert den Connector
 * sonst für alle anderen Aufgaben. Der Cap ist deshalb hart und wird dem
 * Nutzer in der Vorschau angezeigt, statt still zu greifen.
 */

/** Obergrenze pro Import. Darüber wird abgeschnitten und gemeldet. */
export const MAX_OCR_PAGES = 120;

/**
 * Wie viele Seiten in einen `vision_extract`-Job gehen.
 *
 * Eine Seite pro Job, obwohl das Modell mehrseitig könnte: nur so lässt sich
 * jede Ausgabe — und damit jede erkannte Bildbox — eindeutig einer PDF-Seite
 * zuordnen. Das ist die Voraussetzung dafür, Karten und Abbildungen später der
 * richtigen Wiki-Seite anzuhängen. Nebeneffekte: der Fortschritt zählt echte
 * Seiten, und die Base64-Payload pro Queue-Job bleibt klein.
 *
 * Die GPU-Lane arbeitet ohnehin seriell, der Mehraufwand ist also Queue-
 * Latenz pro Seite — klein gegen die Inferenzzeit einer Buchseite.
 */
export const OCR_PAGES_PER_JOB = 1;

export interface OcrPagePlan {
  /** 1-basierte Seiten, die tatsächlich durch OCR gehen. */
  pages: number[];
  /** In Jobs gruppiert, in Seitenreihenfolge. */
  batches: number[][];
  /** true, wenn wegen `MAX_OCR_PAGES` Seiten wegfallen. */
  truncated: boolean;
  totalPages: number;
  skippedPages: number;
}

export function planOcrPages(
  totalPages: number,
  options: { maxPages?: number; pagesPerJob?: number } = {},
): OcrPagePlan {
  const maxPages = Math.max(0, options.maxPages ?? MAX_OCR_PAGES);
  const pagesPerJob = Math.max(1, options.pagesPerJob ?? OCR_PAGES_PER_JOB);
  const total = Math.max(0, Math.floor(totalPages));
  const count = Math.min(total, maxPages);

  const pages = Array.from({ length: count }, (_page, index) => index + 1);
  const batches: number[][] = [];
  for (let index = 0; index < pages.length; index += pagesPerJob) {
    batches.push(pages.slice(index, index + pagesPerJob));
  }

  return {
    pages,
    batches,
    truncated: total > count,
    totalPages: total,
    skippedPages: total - count,
  };
}
