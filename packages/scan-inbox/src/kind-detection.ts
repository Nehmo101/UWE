/**
 * Pure Dokumenttyp-Erkennung aus OCR-Text (deutsche Keyword-Heuristik).
 * Liefert Typ + Konfidenz; ein späterer LLM-Schritt kann verfeinern.
 */
import { extractContractFields, extractGenericFields, extractInvoiceFields, extractWarrantyFields } from "./field-extraction";
import type { ExtractedFields, ScanDocumentKind } from "./scan-types";

interface KindRule {
  kind: ScanDocumentKind;
  patterns: RegExp[];
}

const RULES: KindRule[] = [
  { kind: "invoice", patterns: [/rechnung/i, /rechnungsnummer/i, /zahlbar bis/i, /rechnungsbetrag/i] },
  { kind: "contract_doc", patterns: [/vertrag/i, /kündigungsfrist/i, /vertragsnummer/i, /laufzeit/i] },
  { kind: "warranty", patterns: [/garantie/i, /gewährleistung/i, /garantiezeit/i] },
  { kind: "receipt", patterns: [/kassenbon/i, /beleg/i, /quittung/i, /summe/i] },
  { kind: "recipe", patterns: [/zutaten/i, /zubereitung/i, /portionen/i, /backofen/i] },
  { kind: "dnd_session_note", patterns: [/session/i, /spielrunde/i, /npc/i, /quest/i, /würfel/i] },
];

export interface KindDetectionResult {
  kind: ScanDocumentKind;
  confidence: "low" | "medium" | "high";
  matchedTerms: string[];
}

/** Erkennt den Dokumenttyp anhand von Keyword-Treffern (höchste Trefferzahl gewinnt). */
export function detectKind(text: string): KindDetectionResult {
  if (!text.trim()) {
    return { kind: "unknown", confidence: "low", matchedTerms: [] };
  }

  let best: { kind: ScanDocumentKind; terms: string[] } = { kind: "unknown", terms: [] };
  for (const rule of RULES) {
    const terms = rule.patterns
      .map((pattern) => pattern.exec(text)?.[0])
      .filter((term): term is string => Boolean(term));
    if (terms.length > best.terms.length) {
      best = { kind: rule.kind, terms };
    }
  }

  const confidence = best.terms.length >= 3 ? "high" : best.terms.length === 2 ? "medium" : best.terms.length === 1 ? "low" : "low";
  return { kind: best.kind, confidence, matchedTerms: best.terms };
}

/** Wählt die passende Feld-Extraktion je erkanntem Typ. */
export function extractFieldsForKind(kind: ScanDocumentKind, text: string): ExtractedFields {
  switch (kind) {
    case "invoice":
    case "receipt":
      return extractInvoiceFields(text);
    case "contract_doc":
      return extractContractFields(text);
    case "warranty":
      return extractWarrantyFields(text);
    default:
      return extractGenericFields(text);
  }
}
