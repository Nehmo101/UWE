import { NextResponse } from "next/server";
import { prisma } from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import { createKitchenService } from "@uwe/kitchen";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";

/** Rezepte auflisten — nur lesend, gepflegt wird in der Küche. */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_read"] });
  if (denied) return denied;

  const url = new URL(request.url);
  const tag = url.searchParams.get("tag") ?? undefined;

  const recipes = await createKitchenService(familyPrisma, prisma).listRecipes(
    tag ? { tag } : {},
  );

  return NextResponse.json({
    recipes: recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      servingsBase: recipe.servingsBase,
      durationMinutes: recipe.durationMinutes,
      tasteRating: recipe.tasteRating,
      status: recipe.status,
      ingredientCount: recipe.ingredients.length,
    })),
  });
}
