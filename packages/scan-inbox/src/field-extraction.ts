/**
 * Pure Heuristiken zur Feld-Extraktion aus OCR-Text (deutsche Dokumente).
 * Bewusst regelbasiert und framework-agnostisch — voll testbar ohne KI/DB.
 * Ein späterer LLM-Schritt kann die Ergebnisse anreichern, ersetzt sie aber nicht.
 */
import type { ExtractedFields } from "./scan-types";

const MONTHS = 12;

/** „1.234,56" / „84,99" / „1234.56" → Cents (integer) oder null. */
export function parseGermanAmountToCents(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(",")) {
    // Deutsches Format: Punkt = Tausender, Komma = Dezimal.
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  }
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Erster Geldbetrag mit €/EUR → { amountCents, currency }. */
export function extractAmountCents(text: string): { amountCents: number; currency: string } | null {
  const match = /(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+,\d{2}|\d+(?:\.\d{2})?)\s*(?:€|EUR|Euro)/i.exec(text);
  if (!match) return null;
  const cents = parseGermanAmountToCents(match[1]);
  if (cents == null) return null;
  return { amountCents: cents, currency: "EUR" };
}

/** Alle vollständigen Daten DD.MM.YYYY als ISO (YYYY-MM-DD). */
export function extractDates(text: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();
  const re = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (month < 1 || month > MONTHS || day < 1 || day > 31) continue;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!seen.has(iso)) {
      seen.add(iso);
      results.push(iso);
    }
  }
  return results;
}

/** IBAN (DE… oder generisch), Leerzeichen entfernt. */
export function extractIban(text: string): string | null {
  const match = /\b([A-Z]{2}\d{2}(?:[ ]?\d{4}){2,7}(?:[ ]?\d{1,3})?)\b/.exec(text.toUpperCase());
  if (!match) return null;
  const iban = match[1].replace(/\s+/g, "");
  return iban.length >= 15 && iban.length <= 34 ? iban : null;
}

/** Wert hinter einem Label wie „Kundennummer: 12345" (erste Zahl/Kennung). */
export function extractLabeledValue(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(`${label}[\\s:.#-]*([A-Z0-9][A-Z0-9/\\-]{2,})`, "i");
    const match = re.exec(text);
    if (match) return match[1].trim();
  }
  return null;
}

/** Zeilen, die eine Frist/Fälligkeit signalisieren. */
export function extractDeadlines(text: string): string[] {
  const keywords = /(kündigungsfrist|kündbar|fällig|zahlbar bis|frist|verlängert sich|läuft ab|gültig bis|garantie bis)/i;
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && keywords.test(line));
}

function firstNonEmptyLine(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 3);
}

export function extractInvoiceFields(text: string): ExtractedFields {
  const amount = extractAmountCents(text);
  const dates = extractDates(text);
  return {
    ...(amount ? { amountCents: amount.amountCents, currency: amount.currency } : {}),
    ...(dates[0] ? { dueDate: dates[0] } : {}),
    invoiceNumber: extractLabeledValue(text, ["Rechnungsnummer", "Rechnungs-Nr", "Rg-Nr"]) ?? undefined,
    customerNumber: extractLabeledValue(text, ["Kundennummer", "Kunden-Nr", "Kd-Nr"]) ?? undefined,
    iban: extractIban(text) ?? undefined,
    vendor: firstNonEmptyLine(text),
  };
}

export function extractContractFields(text: string): ExtractedFields {
  const amount = extractAmountCents(text);
  const dates = extractDates(text);
  const deadlines = extractDeadlines(text);
  return {
    ...(amount ? { amountCents: amount.amountCents, currency: amount.currency } : {}),
    contractNumber: extractLabeledValue(text, ["Vertragsnummer", "Vertrags-Nr"]) ?? undefined,
    customerNumber: extractLabeledValue(text, ["Kundennummer", "Kunden-Nr"]) ?? undefined,
    ...(dates[0] ? { startDate: dates[0] } : {}),
    ...(deadlines.length > 0 ? { deadlines } : {}),
    vendor: firstNonEmptyLine(text),
  };
}

export function extractWarrantyFields(text: string): ExtractedFields {
  const dates = extractDates(text);
  return {
    warrantyEndDate: dates.length > 0 ? dates[dates.length - 1] : undefined,
    product: firstNonEmptyLine(text),
    vendor: extractLabeledValue(text, ["Hersteller", "Verkäufer"]) ?? undefined,
  };
}

export function extractGenericFields(text: string): ExtractedFields {
  const deadlines = extractDeadlines(text);
  return {
    summary: firstNonEmptyLine(text),
    ...(deadlines.length > 0 ? { deadlines } : {}),
  };
}
