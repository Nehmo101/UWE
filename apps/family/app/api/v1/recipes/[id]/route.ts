import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import { createKitchenService } from "@uwe/kitchen";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";

/**
 * Rezept-Detail mit Zutaten und Schritten — die Liste (`/api/v1/recipes`)
 * liefert bewusst nur Kopfzeilen; wer kocht, holt sich hier den Rest.
 */

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_read"] });
  if (denied) return denied;

  const { id } = await context.params;
  const recipe = await createKitchenService(familyPrisma, prisma).getRecipe(id);
  if (!recipe) {
    return NextResponse.json({ error: "Rezept nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({
    recipe: {
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      status: recipe.status,
      servingsBase: recipe.servingsBase,
      durationMinutes: recipe.durationMinutes,
      tasteRating: recipe.tasteRating,
      steps: recipe.steps,
      notes: recipe.notes,
      hasImage: Boolean(recipe.imageStorageKey),
      tags: recipe.tags,
      ingredients: recipe.ingredients.map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
        unitLabel: ingredient.unitLabel,
        category: ingredient.category,
        optional: ingredient.optional,
      })),
    },
  });
}
