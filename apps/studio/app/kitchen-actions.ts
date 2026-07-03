"use server";

import {
  createKitchenService,
  createMealPlanService,
  createPantryService,
  createShoppingService,
  parseIngredientLines,
  type IngredientUnit,
  type MealEntryType,
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
import { assertStudioTrusted } from "@/src/lib/authz";

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
  assertStudioTrusted();

  const recipe = await kitchen().createRecipe(readRecipeForm(formData));
  revalidateKitchenPaths();
  redirect(`/kitchen/recipes/${recipe.id}`);
}

export async function updateRecipeAction(formData: FormData) {
  assertStudioTrusted();

  const id = String(formData.get("id"));
  await kitchen().updateRecipe(id, readRecipeForm(formData));
  revalidateKitchenPaths();
  revalidatePath(`/kitchen/recipes/${id}`);
}

export async function archiveRecipeAction(formData: FormData) {
  assertStudioTrusted();

  await kitchen().archiveRecipe(String(formData.get("id")));
  revalidateKitchenPaths();
  redirect("/kitchen/recipes");
}

// ── Wochenplan ────────────────────────────────────────────────────

export async function addMealEntryAction(formData: FormData) {
  assertStudioTrusted();

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
  assertStudioTrusted();

  await mealPlan().removeEntry(String(formData.get("entryId")));
  revalidatePath("/kitchen/plan");
  redirect(planRedirect(formData));
}

export async function toggleMealCookedAction(formData: FormData) {
  assertStudioTrusted();

  await mealPlan().toggleCooked(String(formData.get("entryId")));
  revalidatePath("/kitchen/plan");
  redirect(planRedirect(formData));
}

// ── Einkaufsliste ─────────────────────────────────────────────────

export async function generateShoppingListAction(formData: FormData) {
  assertStudioTrusted();

  const list = await shopping().generateFromWeek(String(formData.get("weekId")), {
    recurringBasics: [...RECURRING_BASICS],
  });
  revalidatePath("/kitchen/shopping");
  redirect(`/kitchen/shopping?list=${list.id}`);
}

export async function toggleShoppingItemAction(formData: FormData) {
  assertStudioTrusted();

  await shopping().toggleItem(String(formData.get("itemId")));
  revalidatePath("/kitchen/shopping");
  redirect(`/kitchen/shopping?list=${String(formData.get("listId"))}`);
}

export async function addShoppingItemAction(formData: FormData) {
  assertStudioTrusted();

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
  assertStudioTrusted();

  const listId = String(formData.get("listId"));
  await shopping().removeItem(String(formData.get("itemId")));
  revalidatePath("/kitchen/shopping");
  redirect(`/kitchen/shopping?list=${listId}`);
}

// ── Vorratskammer (K3) ────────────────────────────────────────────

export async function createPantryItemAction(formData: FormData) {
  assertStudioTrusted();

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
  assertStudioTrusted();

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
  assertStudioTrusted();

  await pantry().remove(String(formData.get("id")));
  revalidatePath("/kitchen/pantry");
}

export async function markPantryLowStockAction(formData: FormData) {
  assertStudioTrusted();

  const lowStock = String(formData.get("lowStock") || "") === "1";
  await pantry().update(String(formData.get("id")), { lowStock });
  revalidatePath("/kitchen/pantry");
}

// ── Rezept-Bild-Upload (K3) ───────────────────────────────────────

export async function uploadRecipeImageAction(formData: FormData) {
  assertStudioTrusted();

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
