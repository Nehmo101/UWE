import { NextResponse } from "next/server";
import { prisma, renderMultiLabelHtml, renderMultiLabelPdfAsync } from "@uwe/database/server";
import { familyPrisma } from "@uwe/database/family-client";
import {
  buildRecipeCards,
  createKitchenService,
  type RecipeCardInput,
  type RecipeCardMode,
} from "@uwe/kitchen";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";

/**
 * Rezeptkarte für den 6×4-Zoll-Drucker.
 *
 * `mode=compact` liefert eine Karte, `mode=set` ein Kartenset (Zutaten, dann
 * Schritte). `format=pdf` gibt das fertige Dokument, `format=html` eine
 * Druckvorschau für den Browser.
 *
 * Der Aufbau liegt in `@uwe/kitchen` (`buildRecipeCards`), gerendert wird mit
 * den vorhandenen Etiketten-Renderern. Gespeichert wird nichts: eine
 * Rezeptkarte ist ein Ausdruck, kein Etikett in der Datenbank.
 */

export const dynamic = "force-dynamic";

function modeOf(value: string | null): RecipeCardMode {
  return value === "set" ? "set" : "compact";
}

/** `steps` liegt als JSON in der Datenbank — defensiv lesen. */
function stepsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((step) => (typeof step === "string" ? step.trim() : ""))
    .filter((step) => step !== "");
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_read"] });
  if (denied) return denied;

  const { id } = await context.params;
  const recipe = await createKitchenService(familyPrisma, prisma).getRecipe(id);
  if (!recipe) {
    return NextResponse.json({ error: "Rezept nicht gefunden." }, { status: 404 });
  }

  const url = new URL(request.url);
  const mode = modeOf(url.searchParams.get("mode"));

  const input: RecipeCardInput = {
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
  };

  const cards = buildRecipeCards(input, mode);

  if (url.searchParams.get("format") === "html") {
    return new NextResponse(renderMultiLabelHtml(cards, true), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const pdf = await renderMultiLabelPdfAsync(cards);
  const safeName = recipe.title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName || "rezept"}-${mode}.pdf"`,
    },
  });
}
