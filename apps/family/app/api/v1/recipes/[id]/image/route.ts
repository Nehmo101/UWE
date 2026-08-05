import fs from "node:fs";
import { NextResponse } from "next/server";
import { requireFamilyApiAuth } from "@/src/lib/family-api-auth";
import { resolveRecipeImageFile } from "@/src/lib/recipe-image-file";

/**
 * Rezeptbild für Token-Clients. Spiegel der session-gebundenen Route unter
 * `/api/kitchen/recipes/[id]/image` — dieselbe Dateiauflösung, aber mit
 * Bearer-Guard, damit ein externer Client (Kiosk) das Bild ohne Sitzung laden
 * kann. Die Session-Route bleibt unverändert für die Family-Web-UI.
 */

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const denied = await requireFamilyApiAuth(request, { scopes: ["family_read"] });
  if (denied) return denied;

  const { id } = await context.params;
  const data = await resolveRecipeImageFile(id);
  if (!data || !fs.existsSync(data.filePath)) {
    return NextResponse.json({ error: "Rezeptbild nicht gefunden." }, { status: 404 });
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
