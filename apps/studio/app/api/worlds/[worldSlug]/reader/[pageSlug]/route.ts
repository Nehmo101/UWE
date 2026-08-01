import { NextResponse } from "next/server";
import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { jsonError } from "@/src/lib/api-response";
import { parseParams, worldPageParamsSchema } from "@uwe/security";
import { buildReaderPageView } from "@/src/lib/page-reader";

/**
 * Leseansicht einer einzelnen Seite als JSON.
 *
 * Der Session-Runner lädt damit das rechte Pane nach, ohne die Seite zu
 * verlassen — genau deshalb gibt es die Route: bisher kam gerendertes
 * Seiten-HTML nur über einen vollen Seitenwechsel heraus, und der kostet am
 * Spieltisch die Leseposition im linken Pane.
 *
 * Liegt bewusst unter `reader/` statt unter `pages/`: dort steht bereits
 * `[pageId]`, und Next.js erlaubt auf demselben Pfad nur einen Segmentnamen.
 */

interface RouteParams {
  params: Promise<{ worldSlug: string; pageSlug: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const authError = await guardStudioApiRequest(request);
  if (authError) return authError;

  const parsed = await parseParams(params, worldPageParamsSchema);
  if (!parsed.success) return parsed.response;

  const { worldSlug, pageSlug } = parsed.data;
  const view = await buildReaderPageView(worldSlug, pageSlug);

  if (!view) {
    return jsonError("Page not found", 404);
  }

  return NextResponse.json(view);
}
