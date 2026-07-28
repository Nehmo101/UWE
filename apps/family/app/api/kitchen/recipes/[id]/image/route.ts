import fs from "node:fs";
import { NextResponse } from "next/server";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";
import { resolveRecipeImageFile } from "@/src/lib/recipe-image-file";

/**
 * Liefert das hinterlegte Rezeptbild aus. Lag in Studio; die Küche ist Family
 * (Abschnitt G), also steht die Route hier — hinter dem Häkchen-Guard.
 */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const authError = await requireFamilyApiAuth();
  if (authError) return authError;

  const { id } = await context.params;
  const data = await resolveRecipeImageFile(id);
  if (!data || !fs.existsSync(data.filePath)) {
    return NextResponse.json({ error: "Rezeptbild nicht gefunden" }, { status: 404 });
  }

  const bytes = await fs.promises.readFile(data.filePath);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": data.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(data.title || "rezept")}"`,
    },
  });
}
