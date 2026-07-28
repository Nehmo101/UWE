/**
 * Unlimited-OCR (baidu/Unlimited-OCR, MIT) — das lokale Dokumenten-Modell für
 * UWE. Es löst `llava` & Co. als Vorgabe für Dokument-Parsing ab: llava ist ein
 * allgemeines Vision-Modell und liefert bei zweispaltigen Abenteuerbänden keine
 * belastbare Lesereihenfolge. Unlimited-OCR ist genau dafür trainiert und gibt
 * Markdown mit Überschriften, Tabellen und `<|det|>`-Boxen zurück.
 *
 * Läuft als GGUF über Ollama (llama.cpp hat die Architektur mainline), also
 * ohne Docker und ohne zusätzlichen Serving-Stack — der bestehende
 * `vision_extract`-Executor spricht es über seinen `model`-Payload an.
 */

/** Ollama-Tag der Vorgabe: ~4 GB, 32K Kontext, Text + Bild. */
export const UNLIMITED_OCR_MODEL = "frob/unlimited-ocr:q8_0";

/**
 * Prompt für eine einzelne Seite. Das Modell ist auf genau diese Formulierung
 * trainiert — freier formulierte Prompts verschlechtern die Ausgabe messbar.
 */
export const DOCUMENT_PARSING_PROMPT = "<image>document parsing.";

/** Prompt für mehrere Seiten in einem Durchlauf (One-shot Multi-Page). */
export const MULTI_PAGE_PARSING_PROMPT = "<image>Multi page parsing.";

/**
 * Erkennt Unlimited-OCR an beliebigen Tags/Forks (`frob/unlimited-ocr:q8_0`,
 * `baidu/Unlimited-OCR`, `unlimited-ocr-gguf` …). Wer ein anderes Vision-Modell
 * im `vision`-Slot stehen hat, bekommt weiterhin den generischen Pfad.
 */
export function isUnlimitedOcrModel(model: string | null | undefined): boolean {
  return typeof model === "string" && /unlimited[-_]?ocr/i.test(model);
}

/**
 * Modell für Dokument-OCR. Quelle ist der bestehende `vision`-Workflow-Slot,
 * damit die Wahl aus UWE heraus einstellbar bleibt (Command Center → Modelle)
 * und kein zusätzlicher Host-Schritt nötig ist. Ohne gesetzten Slot gilt
 * Unlimited-OCR. Bewusst pur: die Prisma-Abfrage bleibt beim Aufrufer, damit
 * dieses Package keine DB-Abhängigkeit bekommt.
 */
export function resolveDocumentOcrModel(slotModel: string | null | undefined): string {
  return slotModel?.trim() || UNLIMITED_OCR_MODEL;
}

/**
 * Prompt passend zur Seitenzahl. Mehrseitig nur, wenn das Modell es auch kann —
 * generische Vision-Modelle bekommen einen erklärenden Prompt, weil sie mit dem
 * `<image>`-Präfix nichts anfangen können.
 */
export function buildOcrPrompt(input: { pageCount: number; model?: string | null }): string {
  if (!isUnlimitedOcrModel(input.model)) {
    return (
      "Gib den vollständigen Inhalt dieser Dokumentseite als Markdown wieder. " +
      "Behalte Überschriften, Absätze, Listen und Tabellen bei. " +
      "Erfinde nichts hinzu und lasse nichts weg."
    );
  }
  return input.pageCount > 1 ? MULTI_PAGE_PARSING_PROMPT : DOCUMENT_PARSING_PROMPT;
}
