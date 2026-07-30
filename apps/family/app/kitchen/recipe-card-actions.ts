"use server";

import { prisma } from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import { createKitchenService, formatRecipeForCard } from "@uwe/kitchen";
import { revalidatePath } from "next/cache";
import { requireFamilyAiActionAuth } from "@/src/lib/family-action-auth";

/**
 * Rezept für die Karte aufbereiten.
 *
 * Kürzt die Arbeitsschritte auf Kartenlänge, ohne Mengen, Zeiten oder
 * Temperaturen zu verlieren. Läuft über die Connector-Queue auf dem eigenen
 * Rechner; ist er aus, bleibt das Rezept unverändert — gedruckt werden kann es
 * trotzdem.
 *
 * `requireFamilyAiActionAuth` prüft zusätzlich zum Häkchen das KI-Flag des
 * Kontos (`canUseRtxAi`).
 */

function stepsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((step) => (typeof step === "string" ? step.trim() : ""))
    .filter((step) => step !== "");
}

export async function formatRecipeForCardAction(formData: FormData) {
  await requireFamilyAiActionAuth();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const kitchen = createKitchenService(familyPrisma, prisma);
  const recipe = await kitchen.getRecipe(id);
  if (!recipe) return;

  const result = await formatRecipeForCard(prisma, {
    recipe: {
      title: recipe.title,
      description: recipe.description,
      servingsBase: recipe.servingsBase,
      durationMinutes: recipe.durationMinutes,
      ingredients: recipe.ingredients.map((ingredient) => ({
        name: ingredient.name,
        amount: ingredient.amount,
        unitLabel: ingredient.unitLabel ?? ingredient.unit,
        optional: ingredient.optional,
      })),
      steps: stepsOf(recipe.steps),
    },
  });

  // Offline oder unlesbare Antwort: das Rezept bleibt, wie es ist. Ein halb
  // aufbereitetes Rezept waere schlimmer als ein unaufbereitetes.
  if (result.status !== "ok") return;

  await kitchen.updateRecipe(id, { steps: result.draft.steps });
  revalidatePath(`/kitchen/recipes/${id}`);
}
