/**
 * Pure Konsolidierungs-Logik für Einkaufslisten.
 *
 * Kernaufgabe: Zutaten aus mehreren (skalierten) Rezepten zu einer Liste
 * zusammenführen — gleiche Zutat in gleicher Einheit addieren (2× 400 g → 800 g),
 * inkompatible Einheiten getrennt lassen (200 g Tomaten ≠ 2 Stück Tomaten).
 * Framework-agnostisch, keine DB-Imports — vollständig testbar.
 */
import type { ShoppingCategory } from "./kitchen-types";
import { normalizeIngredientName, unitGroup, type UnitGroup } from "./units";
import type { IngredientUnit } from "./kitchen-types";

export interface MergeableIngredient {
  name: string;
  normalizedName?: string;
  amount?: number | null;
  unit?: IngredientUnit;
  unitLabel?: string | null;
  category?: ShoppingCategory;
  sourceRecipeIds?: string[];
}

export interface ConsolidatedIngredient {
  name: string;
  normalizedName: string;
  amount: number | null;
  unit: IngredientUnit;
  unitLabel: string | null;
  category: ShoppingCategory;
  sourceRecipeIds: string[];
}

/**
 * Skaliert eine Menge um `factor`. `null`/undefinierte Mengen bleiben `null`
 * (z. B. „etwas Salz" wird nicht plötzlich zu einer Zahl).
 */
export function scaleAmount(
  amount: number | null | undefined,
  factor: number,
): number | null {
  if (amount == null || !Number.isFinite(amount) || !Number.isFinite(factor)) {
    return null;
  }
  return Math.round(amount * factor * 1000) / 1000;
}

/**
 * Merge-Schlüssel: normalisierter Name + Einheit. Einheiten werden bewusst NICHT
 * gruppenübergreifend gemischt; innerhalb einer Gruppe sind `gram`/`milliliter`/
 * `piece` jeweils schon die kanonische Einheit (kg/l existieren nur als Anzeige).
 * `freeform` mit unterschiedlichem `unitLabel` bleibt getrennt.
 */
function mergeKey(item: MergeableIngredient): string {
  const normalized = item.normalizedName?.trim() || normalizeIngredientName(item.name);
  const unit: IngredientUnit = item.unit ?? "freeform";
  const group: UnitGroup = unitGroup(unit);
  const labelPart = unit === "freeform" ? `|${(item.unitLabel ?? "").trim().toLowerCase()}` : "";
  return `${normalized}|${group === "other" ? unit : group}${labelPart}`;
}

/**
 * Führt Zutaten zusammen. Gleicher Merge-Key → Mengen addiert (sofern alle eine
 * Menge haben; ist mindestens eine mengenlos, bleibt das Ergebnis mengenlos, weil
 * sich „etwas" und „400 g" nicht sinnvoll addieren). Reihenfolge des ersten
 * Auftretens bleibt erhalten.
 */
export function consolidateIngredients(
  items: MergeableIngredient[],
): ConsolidatedIngredient[] {
  const order: string[] = [];
  const byKey = new Map<string, ConsolidatedIngredient & { amountKnown: boolean }>();

  for (const item of items) {
    if (!item.name?.trim()) continue;
    const key = mergeKey(item);
    const normalized = item.normalizedName?.trim() || normalizeIngredientName(item.name);
    const sources = item.sourceRecipeIds ?? [];

    const existing = byKey.get(key);
    if (!existing) {
      order.push(key);
      byKey.set(key, {
        name: item.name.trim(),
        normalizedName: normalized,
        amount: item.amount ?? null,
        amountKnown: item.amount != null && Number.isFinite(item.amount),
        unit: item.unit ?? "freeform",
        unitLabel: item.unitLabel ?? null,
        category: item.category ?? "other",
        sourceRecipeIds: [...new Set(sources)],
      });
      continue;
    }

    // Mengen zusammenführen.
    const hasAmount = item.amount != null && Number.isFinite(item.amount);
    if (existing.amountKnown && hasAmount) {
      existing.amount = (existing.amount ?? 0) + (item.amount as number);
    } else {
      existing.amount = null;
      existing.amountKnown = false;
    }
    if (existing.category === "other" && item.category && item.category !== "other") {
      existing.category = item.category;
    }
    existing.sourceRecipeIds = [...new Set([...existing.sourceRecipeIds, ...sources])];
  }

  return order.map((key) => {
    const { amountKnown: _amountKnown, ...rest } = byKey.get(key)!;
    return rest;
  });
}

/** Gruppiert konsolidierte Zutaten nach Einkaufs-Kategorie (Reihenfolge stabil). */
export function groupByCategory(
  items: ConsolidatedIngredient[],
): { category: ShoppingCategory; items: ConsolidatedIngredient[] }[] {
  const order: ShoppingCategory[] = [];
  const byCategory = new Map<ShoppingCategory, ConsolidatedIngredient[]>();

  for (const item of items) {
    const bucket = byCategory.get(item.category);
    if (bucket) {
      bucket.push(item);
    } else {
      order.push(item.category);
      byCategory.set(item.category, [item]);
    }
  }

  return order.map((category) => ({ category, items: byCategory.get(category)! }));
}
