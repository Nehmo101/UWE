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

/** Positionszeile: Name + Preis am Zeilenende, optionale Steuerklasse (A/B/*). */
const ITEM_LINE = /^(.+?)\s+(-?\d{1,4},\d{2})\s*(?:[AB*])?\s*$/;

/** Mengenzeile unter der Position: „2 x 1,99" oder „0,486 kg x 2,99 …". */
const QUANTITY_LINE = /^\s*(\d+(?:[.,]\d+)?)\s*(?:stk|stück|kg|g)?\s*[x×*]\s*\d{1,4},\d{2}/i;

/** Summenzeile: „SUMME 23,45" / „Gesamt: 23,45 EUR". */
const TOTAL_LINE = /(?:zwischensumme|summe|gesamt|total|zu zahlen)\D*?(\d{1,5},\d{2})/i;

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
    .map((line) => line.trim())
    .filter(Boolean);

  const items: ReceiptItem[] = [];
  let totalCents: number | null = null;

  for (const line of lines) {
    const totalMatch = TOTAL_LINE.exec(line);
    if (totalMatch && /(?:zwischensumme|summe|gesamt|total|zu zahlen)/i.test(line)) {
      // Die letzte Summenzeile gewinnt (Zwischensumme < Summe).
      totalCents = parseGermanAmountToCents(totalMatch[1]) ?? totalCents;
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

    const itemMatch = ITEM_LINE.exec(line);
    if (!itemMatch) continue;
    const priceCents = parseGermanAmountToCents(itemMatch[2]);
    // Negative Preise sind Rabatte/Storno — keine Ware.
    if (priceCents == null || itemMatch[2].startsWith("-")) continue;
    const name = cleanName(itemMatch[1]);
    if (!looksLikeName(name)) continue;
    items.push({ name, quantity: null, priceCents });
  }

  return { items, totalCents };
}
