"use server";

import {
  createKitchenService,
  parseIngredientLines,
  type RecipeInput,
  type RecipeStatus,
} from "@uwe/kitchen";
import { prisma } from "@uwe/database/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertStudioTrusted } from "@/src/lib/authz";

function kitchen() {
  return createKitchenService(prisma);
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
