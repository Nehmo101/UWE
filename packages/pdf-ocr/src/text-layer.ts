/**
 * Entscheidet, ob eine PDF über OCR laufen muss. Nicht nur „gar kein Text" —
 * eingescannte Bände tragen oft einen dünnen, unbrauchbaren Textlayer (Kopf-
 * zeilen, Seitenzahlen, ein OCR-Rest aus dem Scanner), der `extractPdfText`
 * zwar durchgehen lässt, aus dem die lokale KI aber nichts bauen kann.
 */

/** Unter so vielen Zeichen pro Seite ist ein Textlayer praktisch leer. */
export const MIN_CHARS_PER_PAGE = 180;

/** Anteil lesbarer Zeichen, unter dem der Layer als Schrott gilt. */
export const MIN_PRINTABLE_RATIO = 0.5;

export type TextLayerVerdict = "usable" | "absent" | "sparse" | "garbled";

export interface TextLayerAssessment {
  verdict: TextLayerVerdict;
  /** true, wenn der Aufrufer auf OCR ausweichen sollte. */
  needsOcr: boolean;
  charsPerPage: number;
  /** Menschenlesbare Begründung für Logs und die Vorschau-Anzeige. */
  reason: string;
}

const REPLACEMENT_CHARACTER = 0xfffd;
const TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const FIRST_PRINTABLE = 0x20;

/**
 * Ersatzzeichen und Steuerzeichen (außer Tab/LF/CR) sind das typische Muster
 * kaputter Font-Encodings in gescannten oder schlecht exportierten PDFs.
 */
function isBrokenCharacter(code: number): boolean {
  if (code === REPLACEMENT_CHARACTER) return true;
  if (code === TAB || code === LINE_FEED || code === CARRIAGE_RETURN) return false;
  return code < FIRST_PRINTABLE;
}

function printableRatio(text: string): number {
  if (!text.length) return 0;
  let broken = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (isBrokenCharacter(text.charCodeAt(index))) {
      broken += 1;
    }
  }
  return 1 - broken / text.length;
}

export function assessTextLayer(input: {
  text: string;
  pageCount: number;
}): TextLayerAssessment {
  const text = input.text.trim();
  const pageCount = Math.max(1, input.pageCount);
  const charsPerPage = Math.round(text.length / pageCount);

  if (!text) {
    return {
      verdict: "absent",
      needsOcr: true,
      charsPerPage: 0,
      reason: "Die PDF hat keinen Textlayer — vermutlich ein Scan.",
    };
  }

  if (printableRatio(text) < MIN_PRINTABLE_RATIO) {
    return {
      verdict: "garbled",
      needsOcr: true,
      charsPerPage,
      reason: "Der Textlayer ist unlesbar (kaputte Zeichenkodierung).",
    };
  }

  if (charsPerPage < MIN_CHARS_PER_PAGE) {
    return {
      verdict: "sparse",
      needsOcr: true,
      charsPerPage,
      reason: `Der Textlayer ist zu dünn (${charsPerPage} Zeichen pro Seite) — vermutlich ein Scan mit Kopfzeilen.`,
    };
  }

  return {
    verdict: "usable",
    needsOcr: false,
    charsPerPage,
    reason: `Textlayer nutzbar (${charsPerPage} Zeichen pro Seite).`,
  };
}
