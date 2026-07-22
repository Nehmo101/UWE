/**
 * Rezept-Domänenlogik der Küche. Business-Logik lebt hier (CLAUDE.md „Goldene
 * Regel"), nicht in Route Handlern oder Server Actions. Die Route ruft nur
 * `createKitchenService(prisma)` und delegiert.
 */
import {
  createEntityTagService,
  toPrismaJsonValue,
  type EntityTagEntityType,
  type EntityTagService,
  type PrismaClient,
} from "@uwe/database/server";
import type { BrainPrismaClient } from "@uwe/database/brain-client";
import type {
  IngredientUnit,
  RecipeIngredientInput,
  RecipeInput,
  RecipeStatus,
  ShoppingCategory,
} from "./kitchen-types";
import { normalizeIngredientName } from "./units";

/** Entity-Typ für die Tag-Verknüpfung (Wert von `EntityTagEntityType`). */
const RECIPE_ENTITY_TYPE: EntityTagEntityType = "recipe";

const RECIPE_INCLUDE = {
  ingredients: { orderBy: { sortIndex: "asc" } },
} as const;

export interface ListRecipesOptions {
  status?: RecipeStatus | RecipeStatus[];
  /** Tag-Key; leere Treffermenge ⇒ leere Liste. */
  tag?: string;
}

function toIngredientData(input: RecipeIngredientInput, index: number) {
  return {
    name: input.name.trim(),
    normalizedName: normalizeIngredientName(input.name),
    amount: input.amount ?? null,
    unit: (input.unit ?? "freeform") as IngredientUnit,
    unitLabel: input.unitLabel ?? null,
    category: (input.category ?? "other") as ShoppingCategory,
    optional: input.optional ?? false,
    sortIndex: input.sortIndex ?? index,
  };
}

export class KitchenService {
  private readonly tags: EntityTagService;

  constructor(
    private readonly brainDb: BrainPrismaClient,
    private readonly db: PrismaClient,
  ) {
    this.tags = createEntityTagService(db);
  }

  async listRecipes(options: ListRecipesOptions = {}) {
    const statusFilter = options.status
      ? Array.isArray(options.status)
        ? { in: options.status }
        : options.status
      : undefined;

    let idFilter: string[] | undefined;
    if (options.tag) {
      idFilter = await this.tags.listEntityIdsByTagKey(options.tag, RECIPE_ENTITY_TYPE);
      if (idFilter.length === 0) {
        return [];
      }
    }

    return this.brainDb.recipe.findMany({
      where: {
        status: statusFilter,
        ...(idFilter ? { id: { in: idFilter } } : {}),
      },
      orderBy: [{ title: "asc" }],
      include: RECIPE_INCLUDE,
    });
  }

  /** Rezept inklusive Zutaten und verknüpfter Tags. */
  async getRecipe(id: string) {
    const recipe = await this.brainDb.recipe.findUnique({
      where: { id },
      include: RECIPE_INCLUDE,
    });
    if (!recipe) {
      return null;
    }
    const tags = await this.tags.listTagsForEntity(RECIPE_ENTITY_TYPE, id);
    return { ...recipe, tags };
  }

  async createRecipe(input: RecipeInput) {
    const recipe = await this.brainDb.recipe.create({
      data: {
        title: input.title.trim(),
        status: (input.status ?? "active") as RecipeStatus,
        description: input.description ?? "",
        servingsBase: input.servingsBase ?? 2,
        durationMinutes: input.durationMinutes ?? null,
        effortRating: input.effortRating ?? null,
        tasteRating: input.tasteRating ?? null,
        kidRating: input.kidRating ?? null,
        partnerRating: input.partnerRating ?? null,
        steps: toPrismaJsonValue(input.steps ?? []),
        variants: toPrismaJsonValue(input.variants ?? undefined),
        imageStorageKey: input.imageStorageKey ?? null,
        sourceUrl: input.sourceUrl ?? null,
        sourceScanId: input.sourceScanId ?? null,
        notes: input.notes ?? "",
        ingredients: {
          create: (input.ingredients ?? []).map(toIngredientData),
        },
      },
      include: RECIPE_INCLUDE,
    });

    if (input.tags) {
      await this.tags.replaceEntityTags(RECIPE_ENTITY_TYPE, recipe.id, input.tags);
    }

    return recipe;
  }

  async updateRecipe(id: string, input: Partial<RecipeInput>) {
    await this.brainDb.$transaction(async (tx) => {
      await tx.recipe.update({
        where: { id },
        data: {
          title: input.title?.trim(),
          status: input.status as RecipeStatus | undefined,
          description: input.description,
          servingsBase: input.servingsBase,
          durationMinutes:
            input.durationMinutes === undefined ? undefined : input.durationMinutes,
          effortRating: input.effortRating === undefined ? undefined : input.effortRating,
          tasteRating: input.tasteRating === undefined ? undefined : input.tasteRating,
          kidRating: input.kidRating === undefined ? undefined : input.kidRating,
          partnerRating:
            input.partnerRating === undefined ? undefined : input.partnerRating,
          steps: input.steps === undefined ? undefined : toPrismaJsonValue(input.steps),
          variants:
            input.variants === undefined
              ? undefined
              : toPrismaJsonValue(input.variants ?? undefined),
          imageStorageKey:
            input.imageStorageKey === undefined ? undefined : input.imageStorageKey,
          sourceUrl: input.sourceUrl === undefined ? undefined : input.sourceUrl,
          notes: input.notes,
        },
      });

      if (input.ingredients !== undefined) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
        if (input.ingredients.length > 0) {
          await tx.recipeIngredient.createMany({
            data: input.ingredients.map((ingredient, index) => ({
              recipeId: id,
              ...toIngredientData(ingredient, index),
            })),
          });
        }
      }
    });

    if (input.tags !== undefined) {
      await this.tags.replaceEntityTags(RECIPE_ENTITY_TYPE, id, input.tags);
    }

    return this.getRecipe(id);
  }

  async archiveRecipe(id: string) {
    await this.brainDb.recipe.update({ where: { id }, data: { status: "archived" } });
    return this.getRecipe(id);
  }

  async getStatusCounts(): Promise<Record<RecipeStatus, number>> {
    const rows = await this.brainDb.recipe.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const counts: Record<RecipeStatus, number> = { draft: 0, active: 0, archived: 0 };
    for (const row of rows) {
      counts[row.status as RecipeStatus] = row._count._all;
    }
    return counts;
  }

  /** Alle Tags, die aktuell an Rezepten hängen (für Filter-Chips). */
  async listRecipeTags() {
    const links = await this.db.entityTag.findMany({
      where: { entityType: RECIPE_ENTITY_TYPE },
      include: { tag: true },
      orderBy: { tag: { label: "asc" } },
    });
    const seen = new Map<string, { key: string; label: string }>();
    for (const link of links) {
      if (!seen.has(link.tag.key)) {
        seen.set(link.tag.key, { key: link.tag.key, label: link.tag.label });
      }
    }
    return [...seen.values()];
  }
}

export function createKitchenService(brainDb: BrainPrismaClient, db: PrismaClient): KitchenService {
  return new KitchenService(brainDb, db);
}
