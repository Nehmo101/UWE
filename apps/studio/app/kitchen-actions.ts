"use server";

import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import {
  createKitchenService,
  createMealPlanService,
  createPantryService,
  createShoppingService,
  parseIngredientLines,
  suggestWeek,
  type IngredientUnit,
  type KitchenAiPantryItem,
  type KitchenAiRecipe,
  type MealEntryType,
  type MealPlanGoals,
  type MealSlot,
  type PantryLocation,
  type RecipeInput,
  type RecipeStatus,
} from "@uwe/kitchen";
import {
  getSystemSettings,
  prisma,
  resolveEffectiveUploadsPath,
  saveCaptureUploadFile,
} from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function kitchen() {
  return createKitchenService(prisma);
}

function mealPlan() {
  return createMealPlanService(prisma);
}

function shopping() {
  return createShoppingService(prisma);
}

function pantry() {
  return createPantryService(prisma);
}

/** Standard-Grundausstattung, die beim Listen-Erzeugen mitkommt. */
const RECURRING_BASICS = [
  { name: "Hafermilch", category: "chilled" as const },
  { name: "Nudeln", category: "dry" as const },
  { name: "Brotmehl", category: "dry" as const },
];

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

function parseOptionalFloat(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseLines(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseCommaTags(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function readRecipeForm(formData: FormData): RecipeInput {
  const status = String(formData.get("status") || "active") as RecipeStatus;
  return {
    title: String(formData.get("title") || "").trim(),
    status,
    description: String(formData.get("description") || ""),
    servingsBase: parseOptionalFloat(formData.get("servingsBase")) ?? 2,
    durationMinutes: parseOptionalInt(formData.get("durationMinutes")),
    tasteRating: parseOptionalInt(formData.get("tasteRating")),
    effortRating: parseOptionalInt(formData.get("effortRating")),
    kidRating: parseOptionalInt(formData.get("kidRating")),
    partnerRating: parseOptionalInt(formData.get("partnerRating")),
    steps: parseLines(formData.get("steps")),
    sourceUrl: String(formData.get("sourceUrl") || "").trim() || null,
    notes: String(formData.get("notes") || ""),
    ingredients: parseIngredientLines(String(formData.get("ingredients") || "")),
    tags: parseCommaTags(formData.get("tags")),
  };
}

function revalidateKitchenPaths() {
  revalidatePath("/kitchen");
  revalidatePath("/kitchen/recipes");
}

export async function createRecipeAction(formData: FormData) {
  await requireStudioActionAuth();

  const recipe = await kitchen().createRecipe(readRecipeForm(formData));
  revalidateKitchenPaths();
  redirect(`/kitchen/recipes/${recipe.id}`);
}

export async function updateRecipeAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  await kitchen().updateRecipe(id, readRecipeForm(formData));
  revalidateKitchenPaths();
  revalidatePath(`/kitchen/recipes/${id}`);
}

export async function archiveRecipeAction(formData: FormData) {
  await requireStudioActionAuth();

  await kitchen().archiveRecipe(String(formData.get("id")));
  revalidateKitchenPaths();
  redirect("/kitchen/recipes");
}

// ── Wochenplan ────────────────────────────────────────────────────

export async function addMealEntryAction(formData: FormData) {
  await requireStudioActionAuth();

  const isoYear = parseOptionalInt(formData.get("isoYear")) ?? 0;
  const isoWeek = parseOptionalInt(formData.get("isoWeek")) ?? 0;
  const recipeId = String(formData.get("recipeId") || "").trim() || null;
  const entryType = String(formData.get("entryType") || "recipe") as MealEntryType;

  const week = await mealPlan().getOrCreateWeek(isoYear, isoWeek);
  await mealPlan().setEntry({
    weekId: week.id,
    date: new Date(String(formData.get("date"))),
    slot: String(formData.get("slot") || "dinner") as MealSlot,
    entryType,
    recipeId: entryType === "recipe" ? recipeId : null,
    servings: parseOptionalFloat(formData.get("servings")),
    note: String(formData.get("note") || ""),
  });
  revalidatePath("/kitchen/plan");
  redirect(planRedirect(formData));
}

export async function removeMealEntryAction(formData: FormData) {
  await requireStudioActionAuth();

  await mealPlan().removeEntry(String(formData.get("entryId")));
  revalidatePath("/kitchen/plan");
  redirect(planRedirect(formData));
}

export async function toggleMealCookedAction(formData: FormData) {
  await requireStudioActionAuth();

  await mealPlan().toggleCooked(String(formData.get("entryId")));
  revalidatePath("/kitchen/plan");
  redirect(planRedirect(formData));
}

// ── KI-Wochenvorschlag (K3, RTX-lokal) ────────────────────────────

/**
 * Fordert über die Connector-Queue (lokale RTX-Inferenz) einen KI-Wochen-
 * vorschlag an und legt ihn als Entwurf auf der Woche ab. Nie Auto-Apply —
 * der Owner übernimmt Einträge einzeln. Ist kein RTX-Connector online oder die
 * Antwort unlesbar, wird der Grund als Query-Flag zurückgereicht.
 */
export async function suggestWeekAction(formData: FormData) {
  await requireStudioActionAuth();

  const isoYear = parseOptionalInt(formData.get("isoYear")) ?? 0;
  const isoWeek = parseOptionalInt(formData.get("isoWeek")) ?? 0;
  const week = await mealPlan().getOrCreateWeek(isoYear, isoWeek);

  const [recipes, pantryItems] = await Promise.all([
    kitchen().listRecipes({ status: "active" }),
    pantry().list(),
  ]);

  const aiRecipes: KitchenAiRecipe[] = recipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    tasteRating: recipe.tasteRating,
    effortRating: recipe.effortRating,
    durationMinutes: recipe.durationMinutes,
  }));
  const aiPantry: KitchenAiPantryItem[] = pantryItems.map((item) => ({
    name: item.name,
    location: item.location,
    lowStock: item.lowStock,
  }));

  const result = await suggestWeek(prisma, {
    recipes: aiRecipes,
    pantry: aiPantry,
    goals: (week.goals ?? undefined) as MealPlanGoals | undefined,
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
  await requireStudioActionAuth();

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

/** Verwirft den KI-Entwurf einer Woche. */
export async function dismissWeekDraftAction(formData: FormData) {
  await requireStudioActionAuth();

  const isoYear = parseOptionalInt(formData.get("isoYear")) ?? 0;
  const isoWeek = parseOptionalInt(formData.get("isoWeek")) ?? 0;
  const week = await mealPlan().getWeek(isoYear, isoWeek);
  if (week) await mealPlan().setAiDraft(week.id, null);
  revalidatePath("/kitchen/plan");
  redirect(planRedirect(formData));
}

// ── Einkaufsliste ─────────────────────────────────────────────────

export async function generateShoppingListAction(formData: FormData) {
  await requireStudioActionAuth();

  const list = await shopping().generateFromWeek(String(formData.get("weekId")), {
    recurringBasics: [...RECURRING_BASICS],
  });
  revalidatePath("/kitchen/shopping");
  redirect(`/kitchen/shopping?list=${list.id}`);
}

export async function toggleShoppingItemAction(formData: FormData) {
  await requireStudioActionAuth();

  await shopping().toggleItem(String(formData.get("itemId")));
  revalidatePath("/kitchen/shopping");
  redirect(`/kitchen/shopping?list=${String(formData.get("listId"))}`);
}

export async function addShoppingItemAction(formData: FormData) {
  await requireStudioActionAuth();

  const listId = String(formData.get("listId"));
  await shopping().addItem({
    listId,
    name: String(formData.get("name") || "").trim(),
    recurring: false,
  });
  revalidatePath("/kitchen/shopping");
  redirect(`/kitchen/shopping?list=${listId}`);
}

export async function removeShoppingItemAction(formData: FormData) {
  await requireStudioActionAuth();

  const listId = String(formData.get("listId"));
  await shopping().removeItem(String(formData.get("itemId")));
  revalidatePath("/kitchen/shopping");
  redirect(`/kitchen/shopping?list=${listId}`);
}

// ── Vorratskammer (K3) ────────────────────────────────────────────

export async function createPantryItemAction(formData: FormData) {
  await requireStudioActionAuth();

  await pantry().create({
    name: String(formData.get("name") || "").trim(),
    location: String(formData.get("location") || "pantry") as PantryLocation,
    amount: parseOptionalFloat(formData.get("amount")),
    unit: String(formData.get("unit") || "freeform") as IngredientUnit,
    unitLabel: String(formData.get("unitLabel") || "").trim() || null,
    expiresAt: parseOptionalDate(formData.get("expiresAt")),
    notes: String(formData.get("notes") || ""),
  });
  revalidatePath("/kitchen/pantry");
}

export async function updatePantryItemAction(formData: FormData) {
  await requireStudioActionAuth();

  await pantry().update(String(formData.get("id")), {
    name: String(formData.get("name") || "").trim(),
    location: String(formData.get("location") || "pantry") as PantryLocation,
    amount: parseOptionalFloat(formData.get("amount")),
    unit: String(formData.get("unit") || "freeform") as IngredientUnit,
    unitLabel: String(formData.get("unitLabel") || "").trim() || null,
    expiresAt: parseOptionalDate(formData.get("expiresAt")),
    notes: String(formData.get("notes") || ""),
  });
  revalidatePath("/kitchen/pantry");
}

export async function removePantryItemAction(formData: FormData) {
  await requireStudioActionAuth();

  await pantry().remove(String(formData.get("id")));
  revalidatePath("/kitchen/pantry");
}

export async function markPantryLowStockAction(formData: FormData) {
  await requireStudioActionAuth();

  const lowStock = String(formData.get("lowStock") || "") === "1";
  await pantry().update(String(formData.get("id")), { lowStock });
  revalidatePath("/kitchen/pantry");
}

// ── Rezept-Bild-Upload (K3) ───────────────────────────────────────

export async function uploadRecipeImageAction(formData: FormData) {
  await requireStudioActionAuth();

  const id = String(formData.get("id"));
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const settings = await getSystemSettings();
  const uploadsRoot = resolveEffectiveUploadsPath(settings);
  const validated = saveCaptureUploadFile(buffer, {
    originalFilename: file.name,
    declaredMimeType: file.type,
    uploadsRoot,
    imagesOnly: true,
  });

  await kitchen().updateRecipe(id, { imageStorageKey: validated.storageKey });
  revalidatePath(`/kitchen/recipes/${id}`);
}
