"use server";
import { familyPrisma } from "@uwe/database/family-client";

import {
  requireFamilyActionAuth,
  requireFamilyAiActionAuth,
} from "@/src/lib/family-action-auth";
import {
  createKitchenService,
  createMealPlanService,
  createPantryService,
  datesOfIsoWeek,
  daysSince,
  getRecipeHistory,
  parseIngredientLines,
  resolveDraftDate,
  suggestWeek,
  type KitchenAiPantryItem,
  type KitchenAiRecipe,
  type MealPlanGoals,
  type MealSlot,
  type WeekSuggestionDraft,
} from "@uwe/kitchen";
import { createConnectorWorkflowService, prisma } from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Server Actions rund um den KI-Wochenvorschlag (K3, Maschinenraum-lokal).
 * Aus `kitchen-actions.ts` herausgelöst: alles, was den Entwurf anfordert,
 * übernimmt oder verwirft, lebt hier — inklusive des KI-Guards.
 */

function kitchen() {
  return createKitchenService(familyPrisma, prisma);
}

function mealPlan() {
  return createMealPlanService(familyPrisma);
}

function pantry() {
  return createPantryService(familyPrisma);
}

function planRedirect(formData: FormData): string {
  const y = String(formData.get("isoYear") || "");
  const w = String(formData.get("isoWeek") || "");
  return y && w ? `/kitchen/plan?y=${y}&w=${w}` : "/kitchen/plan";
}

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Resttage bis zum Ablaufdatum (aufgerundet); negativ = bereits abgelaufen. */
function daysUntil(date: Date | null, now: Date): number | null {
  if (!date) return null;
  return Math.ceil((date.getTime() - now.getTime()) / (24 * 3600 * 1000));
}

/**
 * Modellwahl wie beim Dokumenten-OCR: der zentrale Workflow-Slot aus dem
 * Command Center (Modelle) entscheidet — hier `chat`, weil der Wochenvorschlag
 * generative Alltagsarbeit ist. Ohne Slot-Vorgabe wählt der Connector selbst.
 */
async function weekSuggestModel(): Promise<string | undefined> {
  const slotDefault = await createConnectorWorkflowService(prisma).getDefault("chat");
  return slotDefault?.model?.name ?? undefined;
}

/**
 * Fordert über die Connector-Queue (lokale Maschinenraum-Inferenz) einen KI-Wochen-
 * vorschlag an und legt ihn als Entwurf auf der Woche ab. Nie Auto-Apply —
 * der Owner übernimmt Einträge einzeln. Ist kein Maschinenraum online oder die
 * Antwort unlesbar, wird der Grund als Query-Flag zurückgereicht.
 */
export async function suggestWeekAction(formData: FormData) {
  // Löst Inferenz aus → Häkchen UND KI-Flag (canUseEngineAi), nicht nur Häkchen.
  await requireFamilyAiActionAuth();

  const isoYear = parseOptionalInt(formData.get("isoYear")) ?? 0;
  const isoWeek = parseOptionalInt(formData.get("isoWeek")) ?? 0;
  const week = await mealPlan().getOrCreateWeek(isoYear, isoWeek);

  const now = new Date();
  const [recipes, pantryItems, history, model] = await Promise.all([
    kitchen().listRecipes({ status: "active" }),
    pantry().list(),
    getRecipeHistory(familyPrisma, { now }),
    weekSuggestModel(),
  ]);

  const aiRecipes: KitchenAiRecipe[] = recipes.map((recipe) => {
    const recipeHistory = history.get(recipe.id);
    const lastUsed = recipeHistory?.lastCookedAt ?? recipeHistory?.lastPlannedAt ?? null;
    return {
      id: recipe.id,
      title: recipe.title,
      tasteRating: recipe.tasteRating,
      effortRating: recipe.effortRating,
      durationMinutes: recipe.durationMinutes,
      ingredients: recipe.ingredients
        .filter((ingredient) => !ingredient.optional)
        .map((ingredient) => ingredient.normalizedName),
      lastCookedDaysAgo: daysSince(lastUsed, now),
    };
  });
  const aiPantry: KitchenAiPantryItem[] = pantryItems.map((item) => ({
    name: item.name,
    location: item.location,
    lowStock: item.lowStock,
    expiresInDays: daysUntil(item.expiresAt, now),
  }));

  const result = await suggestWeek(prisma, {
    recipes: aiRecipes,
    pantry: aiPantry,
    goals: (week.goals ?? undefined) as MealPlanGoals | undefined,
    model,
  });

  const base = planRedirect(formData);
  const sep = base.includes("?") ? "&" : "?";
  if (result.status !== "ok") {
    redirect(`${base}${sep}ai=${result.status}`);
  }
  await mealPlan().setAiDraft(week.id, result.draft);
  revalidatePath("/kitchen/plan");
  redirect(`${base}${sep}ai=ok`);
}

/** Übernimmt einen einzelnen Tag des KI-Entwurfs als echten Wochenplan-Eintrag. */
export async function applyDraftEntryAction(formData: FormData) {
  await requireFamilyActionAuth();

  const isoYear = parseOptionalInt(formData.get("isoYear")) ?? 0;
  const isoWeek = parseOptionalInt(formData.get("isoWeek")) ?? 0;
  const rawRecipeId = String(formData.get("recipeId") || "").trim() || null;
  const date = parseOptionalDate(formData.get("date"));
  if (!date) redirect(planRedirect(formData));

  // Die KI kann eine nicht existierende Rezept-ID vorschlagen — validieren,
  // sonst als reine Notiz übernehmen (kein FK-Verstoß).
  const recipeId = rawRecipeId && (await kitchen().getRecipe(rawRecipeId)) ? rawRecipeId : null;

  const week = await mealPlan().getOrCreateWeek(isoYear, isoWeek);
  await mealPlan().setEntry({
    weekId: week.id,
    date,
    slot: String(formData.get("slot") || "dinner") as MealSlot,
    entryType: recipeId ? "recipe" : "note",
    recipeId,
    note: recipeId ? "" : String(formData.get("title") || ""),
  });
  revalidatePath("/kitchen/plan");
  redirect(planRedirect(formData));
}

/**
 * Übernimmt ein von der KI erfundenes Gericht als Rezept-Entwurf ins Kochbuch
 * und plant es am vorgeschlagenen Tag ein. Zutaten kommen aus dem persistierten
 * Entwurf der Woche, nicht aus dem Formular — dem Client wird nur der Index
 * geglaubt. Reiner DB-Write, keine Inferenz → Häkchen-Guard reicht.
 */
export async function adoptDraftRecipeAction(formData: FormData) {
  await requireFamilyActionAuth();

  const isoYear = parseOptionalInt(formData.get("isoYear")) ?? 0;
  const isoWeek = parseOptionalInt(formData.get("isoWeek")) ?? 0;
  const draftIndex = parseOptionalInt(formData.get("draftIndex"));
  const base = planRedirect(formData);

  const week = await mealPlan().getWeek(isoYear, isoWeek);
  const draft = (week?.aiDraft ?? null) as WeekSuggestionDraft | null;
  const day = draftIndex === null ? undefined : draft?.days?.[draftIndex];
  if (!week || !day || !day.invented) {
    redirect(base);
  }

  const recipe = await kitchen().createRecipe({
    title: day.title,
    // Entwurf, nicht aktiv: erst nach dem ersten Kochen (und Bewerten) bestätigen.
    status: "draft",
    description: day.note ?? "",
    notes: "Aus dem KI-Wochenvorschlag übernommen.",
    ingredients: parseIngredientLines((day.ingredients ?? []).join("\n")),
  });
  await mealPlan().setEntry({
    weekId: week.id,
    date: resolveDraftDate(day.day, datesOfIsoWeek(isoYear, isoWeek)),
    slot: day.slot,
    entryType: "recipe",
    recipeId: recipe.id,
  });
  revalidatePath("/kitchen/plan");
  revalidatePath("/kitchen/recipes");
  const sep = base.includes("?") ? "&" : "?";
  redirect(`${base}${sep}ai=adopted`);
}

/** Verwirft den KI-Entwurf einer Woche. */
export async function dismissWeekDraftAction(formData: FormData) {
  await requireFamilyActionAuth();

  const isoYear = parseOptionalInt(formData.get("isoYear")) ?? 0;
  const isoWeek = parseOptionalInt(formData.get("isoWeek")) ?? 0;
  const week = await mealPlan().getWeek(isoYear, isoWeek);
  if (week) await mealPlan().setAiDraft(week.id, null);
  revalidatePath("/kitchen/plan");
  redirect(planRedirect(formData));
}
