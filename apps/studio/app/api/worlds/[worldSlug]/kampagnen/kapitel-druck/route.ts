import { guardStudioApiRequest } from "@/src/lib/studio-admin-auth";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/lib/api-response";
import {
  buildWorldWikiIndex,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import { getWorldWikiGraph } from "@uwe/database/page-service";
import {
  buildChapterPrintHtml,
  buildChapterPrintMarkdown,
  getChapterPrintData,
} from "@uwe/campaign-cockpit";
import { chapterPrintQuerySchema, parseQuery } from "@uwe/security";
import { requireStudioWorldRead } from "@/src/lib/authz";

/**
 * Kapitel-Druck (Kampagnen-Cockpit): eigenständiges Druck-HTML bzw.
 * Markdown-Export. `variante=spieler` schneidet DM-Bereiche serverseitig —
 * derselbe Parser wie im Portal, per Test abgesichert.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ worldSlug: string }> },
) {
  const authError = await guardStudioApiRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const { worldSlug } = await context.params;
    await requireStudioWorldRead(worldSlug);

    const parsed = parseQuery(request.url, chapterPrintQuerySchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const repo = getAppRepository();
    const world = await repo.getWorldBySlug(worldSlug);
    if (!world) {
      return jsonError("Welt nicht gefunden.", 404);
    }

    const variant = parsed.data.variante ?? "dm";
    const db = createPrismaClient();
    try {
      const [wikiIndex, graph] = await Promise.all([
        buildWorldWikiIndex(repo, worldSlug),
        getWorldWikiGraph(repo, worldSlug),
      ]);
      const data = await getChapterPrintData(db, worldSlug, parsed.data.kapitelId, {
        variant,
        wikiIndex,
        graph,
      });
      if (!data) {
        return jsonError("Kapitel nicht gefunden.", 404);
      }

      if (parsed.data.format === "markdown") {
        return new NextResponse(buildChapterPrintMarkdown(data), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `inline; filename="${data.chapterTitle}-kapitel.md"`,
          },
        });
      }

      return new NextResponse(buildChapterPrintHtml(data), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } finally {
      await db.$disconnect();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Druckansicht fehlgeschlagen.";
    return jsonError(message, 403);
  }
}
