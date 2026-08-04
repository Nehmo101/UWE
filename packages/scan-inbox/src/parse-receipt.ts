/**
 * Heuristische Extraktion von Kassenbon-Positionen aus OCR-Text (deutsche
 * Bons: REWE, ALDI, LIDL, EDEKA …). Reiner, testbarer Parser ohne
 * Seiteneffekte — Muster wie `parse-recipe.ts`: findet er nichts Belastbares,
 * bleibt die Liste leer (kein Fehlversuch), und der Owner pflegt von Hand nach.
 *
 * Erkannt wird die typische Positionszeile „NAME … 1,99 A" (Preis am
 * Zeilenende, optionale Steuerklasse), die Mengenzeile darunter („2 x 1,99",
 * „0,486 kg x 2,99 /kg") und die Summenzeile. Pfand, Rabatte, Zahlarten und
 * Kopf-/Fußzeilen werden übersprungen.
 */
import { parseGermanAmountToCents } from "./field-extraction";
import type { ReceiptItem } from "./scan-types";

export interface ParsedReceipt {
  items: ReceiptItem[];
  totalCents: number | null;
}

/** Zeilen, die keine Warenposition sind (Summen, Pfand, Zahlung, Meta). */
const SKIP_LINE = new RegExp(
  [
    "zwischensumme",
    "summe",
    "gesamt",
    "total",
    "pfand",
    "leergut",
    "rabatt",
    "coupon",
    "aktion",
    "mwst",
    "ust",
    "steuer",
    "netto",
    "brutto",
    "\\bbar\\b",
    "karte",
    "girocard",
    "\\bec\\b",
    "kredit",
    "rückgeld",
    "zu zahlen",
    "gegeben",
    "kassenbon",
    "beleg",
    "quittung",
    "datum",
    "uhrzeit",
    "\\buhr\\b",
    "kasse",
    "bon-?nr",
    "filiale",
    "vielen dank",
    "danke",
    "öffnungszeiten",
    "www\\.",
    "tel\\.",
  ].join("|"),
  "i",
);

/**
 * Alle Muster hier sind bewusst backtracking-frei (CodeQL: polynomial regex on
 * uncontrolled data — OCR-Text ist Fremdeingabe). Deshalb: Whitespace wird pro
 * Zeile einmal auf einfache Leerzeichen normalisiert, die Muster verwenden nur
 * literale/optionale Einzel-Leerzeichen statt `\s*`-Ketten, und der Preis wird
 * als eindeutiger Zeilen-Schwanz gematcht statt über ein lazy `(.+?)`.
 */

/** Preis am Zeilenende, optionale Steuerklasse (A/B/*): „… 1,99 A". */
const PRICE_TAIL = /(-?\d{1,4},\d{2})(?: ?[AB*])?$/;

/** Mengenzeile unter der Position: „2 x 1,99" oder „0,486 kg x 2,99 …". */
const QUANTITY_LINE = /^(\d+(?:[.,]\d+)?) ?(?:stk|stück|kg|g)? ?[x×*] ?\d{1,4},\d{2}/i;

/** Summenzeile beginnt mit dem Schlüsselwort: „SUMME 23,45" / „Gesamt: 23,45". */
const TOTAL_KEY = /^(?:zwischensumme|summe|gesamt|total|zu zahlen)\b/i;

/** Erster Geldbetrag einer (Summen-)Zeile. */
const AMOUNT = /(\d{1,5},\d{2})/;

/** Enthält die Zeile genug Buchstaben, um ein Produktname zu sein? */
function looksLikeName(raw: string): boolean {
  const letters = raw.replace(/[^A-Za-zÄÖÜäöüß]/g, "");
  return letters.length >= 2;
}

function cleanName(raw: string): string {
  return raw
    .replace(/[*#•·]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseReceiptText(ocrText: string): ParsedReceipt {
  const lines = ocrText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const items: ReceiptItem[] = [];
  let totalCents: number | null = null;

  for (const line of lines) {
    if (TOTAL_KEY.test(line)) {
      // Die letzte Summenzeile gewinnt (Zwischensumme < Summe).
      const amount = AMOUNT.exec(line);
      if (amount) {
        totalCents = parseGermanAmountToCents(amount[1]) ?? totalCents;
      }
      continue;
    }
    if (SKIP_LINE.test(line)) continue;

    // Mengenzeile gehört zur vorigen Position.
    const quantityMatch = QUANTITY_LINE.exec(line);
    if (quantityMatch && items.length > 0) {
      const quantity = Number.parseFloat(quantityMatch[1].replace(",", "."));
      if (Number.isFinite(quantity) && quantity > 0) {
        items[items.length - 1].quantity = quantity;
      }
      continue;
    }

    const priceMatch = PRICE_TAIL.exec(line);
    // `index === 0` heißt: die Zeile IST nur der Preis — keine Position.
    if (!priceMatch || priceMatch.index === 0) continue;
    const priceCents = parseGermanAmountToCents(priceMatch[1]);
    // Negative Preise sind Rabatte/Storno — keine Ware.
    if (priceCents == null || priceMatch[1].startsWith("-")) continue;
    const name = cleanName(line.slice(0, priceMatch.index));
    if (!looksLikeName(name)) continue;
    items.push({ name, quantity: null, priceCents });
  }

  return { items, totalCents };
}
