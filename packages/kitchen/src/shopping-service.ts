/**
 * Einkaufslisten-Domänenlogik: aus einem Wochenplan eine konsolidierte,
 * kategorisierte Liste erzeugen. Die eigentliche Zusammenführung ist pure Logik
 * in `ingredient-merge.ts`; hier kommt nur die Persistenz + Skalierung dazu.
 */
import { toPrismaJsonValue } from "@uwe/database/server";
import type { FamilyPrismaClient as PrismaClient } from "@uwe/database/family-client";
import type {
  IngredientUnit,
  MealPlanGoals,
  ShoppingCategory,
  ShoppingTrip,
} from "./kitchen-types";
import {
  consolidateIngredients,
  scaleAmount,
  type MergeableIngredient,
} from "./ingredient-merge";
import { datesOfIsoWeek } from "./meal-plan-service";
import { assignShoppingTrip } from "./shopping-split";

export interface RecurringBasic {
  name: string;
  category?: ShoppingCategory;
}

export interface GenerateShoppingListOptions {
  title?: string;
  /** Grundausstattung, die immer auf die Liste kommt (Hafermilch, Nudeln …). */
  recurringBasics?: RecurringBasic[];
}

const LIST_INCLUDE = {
  items: { orderBy: [{ category: "asc" as const }, { sortIndex: "asc" as const }] },
};

export class ShoppingService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Baut aus einer Woche eine Einkaufsliste: alle Rezept-Zutaten auf die
   * geplante Portionszahl skaliert (`entry.servings` ?? `householdFactor`,
   * relativ zu `recipe.servingsBase`), konsolidiert und kategorisiert.
   * Verderbliches, das erst ab dem Frische-Tag (Default Donnerstag) gebraucht
   * wird, landet im Abschnitt `fresh` — der kleine zweite Einkauf.
   */
  async generateFromWeek(
    weekId: string,
    options: GenerateShoppingListOptions = {},
  ) {
    const week = await this.db.mealPlanWeek.findUnique({
      where: { id: weekId },
      include: {
        entries: {
          where: { entryType: "recipe", recipeId: { not: null } },
          include: { recipe: { include: { ingredients: true } } },
        },
      },
    });
    if (!week) throw new Error("Woche nicht gefunden.");

    const collected: MergeableIngredient[] = [];
    for (const entry of week.entries) {
      const recipe = entry.recipe;
      if (!recipe) continue;
      const base = recipe.servingsBase || 1;
      const target = entry.servings ?? week.householdFactor;
      const factor = target / base;
      for (const ingredient of recipe.ingredients) {
        collected.push({
          name: ingredient.name,
          normalizedName: ingredient.normalizedName,
          amount: scaleAmount(ingredient.amount, factor),
          unit: ingredient.unit as IngredientUnit,
          unitLabel: ingredient.unitLabel,
          category: ingredient.category as ShoppingCategory,
          sourceRecipeIds: [recipe.id],
          firstUseDate: entry.date,
        });
      }
    }

    const consolidated = consolidateIngredients(collected);
    const weekDates = datesOfIsoWeek(week.isoYear, week.isoWeek);
    const freshWeekday = (week.goals as MealPlanGoals | null)?.freshWeekday;
    const tripOf = (item: (typeof consolidated)[number]): ShoppingTrip =>
      assignShoppingTrip(
        { category: item.category, firstUseDate: item.firstUseDate },
        weekDates,
        freshWeekday,
      );

    const basics = options.recurringBasics ?? [];
    const list = await this.db.shoppingList.create({
      data: {
        weekId,
        title: options.title ?? `Einkauf KW ${week.isoWeek}/${week.isoYear}`,
        items: {
          create: [
            ...consolidated.map((item, index) => ({
              name: item.name,
              normalizedName: item.normalizedName,
              amount: item.amount,
              unit: item.unit,
              unitLabel: item.unitLabel,
              category: item.category,
              trip: tripOf(item),
              recurring: false,
              sourceRecipeIds: toPrismaJsonValue(item.sourceRecipeIds),
              sortIndex: index,
            })),
            ...basics.map((basic, index) => ({
              name: basic.name,
              normalizedName: basic.name.trim().toLowerCase(),
              category: basic.category ?? "other",
              recurring: true,
              sortIndex: consolidated.length + index,
            })),
          ],
        },
      },
      include: LIST_INCLUDE,
    });
    return list;
  }

  /**
   * Legt eine leere, manuell befüllbare Liste an (ohne Wochenbezug) — für den
   * spontanen Einkauf zwischendurch, unabhängig vom Essensplan.
   */
  async createManualList(title?: string) {
    const trimmed = title?.trim();
    return this.db.shoppingList.create({
      data: { title: trimmed || "Einkauf (manuell)" },
      include: LIST_INCLUDE,
    });
  }

  /**
   * Häufig verwendete Positionsnamen aus der gesamten Historie — als
   * Autocomplete-Vorschläge („was schon mal auf der Liste stand"), absteigend
   * nach Häufigkeit.
   */
  async getItemSuggestions(limit = 50): Promise<string[]> {
    const rows = await this.db.shoppingListItem.groupBy({
      by: ["name"],
      _count: { name: true },
      orderBy: { _count: { name: "desc" } },
      take: limit,
    });
    return rows.map((row) => row.name);
  }

  async getList(id: string) {
    return this.db.shoppingList.findUnique({ where: { id }, include: LIST_INCLUDE });
  }

  async listLists() {
    return this.db.shoppingList.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, done: true, createdAt: true },
    });
  }

  async toggleItem(itemId: string) {
    const item = await this.db.shoppingListItem.findUnique({ where: { id: itemId } });
    if (!item) throw new Error("Position nicht gefunden.");
    return this.db.shoppingListItem.update({
      where: { id: itemId },
      data: { checked: !item.checked },
    });
  }

  async addItem(input: {
    listId: string;
    name: string;
    amount?: number | null;
    unit?: IngredientUnit;
    unitLabel?: string | null;
    category?: ShoppingCategory;
    recurring?: boolean;
  }) {
    const count = await this.db.shoppingListItem.count({ where: { listId: input.listId } });
    return this.db.shoppingListItem.create({
      data: {
        listId: input.listId,
        name: input.name.trim(),
        normalizedName: input.name.trim().toLowerCase(),
        amount: input.amount ?? null,
        unit: input.unit ?? "freeform",
        unitLabel: input.unitLabel ?? null,
        category: input.category ?? "other",
        recurring: input.recurring ?? false,
        sortIndex: count,
      },
    });
  }

  async removeItem(itemId: string) {
    await this.db.shoppingListItem.delete({ where: { id: itemId } });
  }

  async setDone(listId: string, done: boolean) {
    return this.db.shoppingList.update({ where: { id: listId }, data: { done } });
  }
}

export function createShoppingService(db: PrismaClient): ShoppingService {
  return new ShoppingService(db);
}
