/**
 * Vorratskammer-Domänenlogik der Küche (K3). Business-Logik lebt hier
 * (CLAUDE.md „Goldene Regel"), nicht in Route Handlern oder Server Actions.
 *
 * Die Vorratskammer trackt, was zuhause vorhanden ist (Ort, Menge, Ablauf) und
 * speist zwei Features: Ablauf-Warnungen und „Koche mit meinem Vorrat" — ein
 * reines Ranking bestehender Rezepte nach vorhandenen Zutaten.
 */
import type { FamilyPrismaClient as PrismaClient } from "@uwe/database/family-client";
import type { IngredientUnit, PantryLocation } from "./kitchen-types";
import { normalizeIngredientName } from "./units";

export interface PantryItemInput {
  name: string;
  location?: PantryLocation;
  amount?: number | null;
  unit?: IngredientUnit;
  unitLabel?: string | null;
  expiresAt?: Date | null;
  lowStock?: boolean;
  notes?: string;
}

export interface ListPantryOptions {
  location?: PantryLocation;
}

/** Ein Rezept mit seinen normalisierten Zutaten-Namen (Eingabe fürs Ranking). */
export interface RankableRecipe {
  id: string;
  title: string;
  ingredients: Array<{ normalizedName: string; optional?: boolean }>;
}

/** Ranking-Ergebnis: Rezept plus Trefferzahl gegen den Vorrat. */
export interface PantryRecipeMatch<R extends RankableRecipe = RankableRecipe> {
  recipe: R;
  /** Anzahl (Pflicht-)Zutaten, die im Vorrat vorhanden sind. */
  matchCount: number;
  /** Anzahl der Pflicht-Zutaten insgesamt (für „3 von 5"-Anzeige). */
  requiredCount: number;
}

export class PantryService {
  constructor(private readonly db: PrismaClient) {}

  async list(options: ListPantryOptions = {}) {
    return this.db.pantryItem.findMany({
      where: options.location ? { location: options.location } : undefined,
      orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    });
  }

  async create(input: PantryItemInput) {
    return this.db.pantryItem.create({
      data: {
        name: input.name.trim(),
        normalizedName: normalizeIngredientName(input.name),
        location: (input.location ?? "pantry") as PantryLocation,
        amount: input.amount ?? null,
        unit: (input.unit ?? "freeform") as IngredientUnit,
        unitLabel: input.unitLabel ?? null,
        expiresAt: input.expiresAt ?? null,
        lowStock: input.lowStock ?? false,
        notes: input.notes ?? "",
      },
    });
  }

  async update(id: string, patch: Partial<PantryItemInput>) {
    return this.db.pantryItem.update({
      where: { id },
      data: {
        name: patch.name === undefined ? undefined : patch.name.trim(),
        normalizedName:
          patch.name === undefined ? undefined : normalizeIngredientName(patch.name),
        location: patch.location as PantryLocation | undefined,
        amount: patch.amount === undefined ? undefined : patch.amount,
        unit: patch.unit as IngredientUnit | undefined,
        unitLabel: patch.unitLabel === undefined ? undefined : patch.unitLabel,
        expiresAt: patch.expiresAt === undefined ? undefined : patch.expiresAt,
        lowStock: patch.lowStock,
        notes: patch.notes,
      },
    });
  }

  async remove(id: string) {
    await this.db.pantryItem.delete({ where: { id } });
  }

  /**
   * Ablaufende und bereits abgelaufene Vorrats-Items, sortiert nach Ablaufdatum.
   * `withinDays` ist das Vorwarn-Fenster ab `now`; Items ohne Ablaufdatum zählen
   * nie als ablaufend.
   */
  async getExpiring(withinDays: number, now: Date = new Date()) {
    const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
    return this.db.pantryItem.findMany({
      where: { expiresAt: { not: null, lte: horizon } },
      orderBy: [{ expiresAt: { sort: "asc", nulls: "last" } }],
    });
  }
}

export function createPantryService(db: PrismaClient): PantryService {
  return new PantryService(db);
}

/**
 * Reiner Ranking-Helfer für „Koche mit meinem Vorrat": rankt Rezepte nach der
 * Anzahl ihrer Pflicht-Zutaten, die im Vorrat vorhanden sind (Match über
 * `normalizedName`). Rezepte ohne einen einzigen Treffer fallen raus. Sortiert
 * primär nach absoluter Trefferzahl, sekundär nach Deckungsgrad, dann Titel.
 */
export function rankRecipesByPantry<R extends RankableRecipe>(
  recipes: readonly R[],
  pantryNormalizedNames: readonly string[],
): PantryRecipeMatch<R>[] {
  const pantry = new Set(pantryNormalizedNames.filter(Boolean));

  const ranked: PantryRecipeMatch<R>[] = [];
  for (const recipe of recipes) {
    const required = recipe.ingredients.filter((ing) => !ing.optional && ing.normalizedName);
    const matchCount = required.filter((ing) => pantry.has(ing.normalizedName)).length;
    if (matchCount === 0) {
      continue;
    }
    ranked.push({ recipe, matchCount, requiredCount: required.length });
  }

  return ranked.sort((a, b) => {
    if (b.matchCount !== a.matchCount) {
      return b.matchCount - a.matchCount;
    }
    const coverageA = a.requiredCount === 0 ? 0 : a.matchCount / a.requiredCount;
    const coverageB = b.requiredCount === 0 ? 0 : b.matchCount / b.requiredCount;
    if (coverageB !== coverageA) {
      return coverageB - coverageA;
    }
    return a.recipe.title.localeCompare(b.recipe.title, "de");
  });
}
