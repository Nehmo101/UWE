import { guardStudioApiMutation, guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import fs from "node:fs";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import { resolveRecipeImageFile } from "@/app/kitchen/recipe-image-file";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const { id } = await context.params;
  const data = await resolveRecipeImageFile(id);
  if (!data || !fs.existsSync(data.filePath)) {
    return jsonError("Rezeptbild nicht gefunden", 404);
  }

  const bytes = fs.readFileSync(data.filePath);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": data.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(data.title || "rezept")}"`,
    },
  });
}
