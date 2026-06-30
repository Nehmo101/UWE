import { NextResponse } from "next/server";
import {
  ADMIN_SEARCH_ENTITY_LABELS,
  getAppRepository,
  prisma,
  searchAdminEntities,
} from "@uwe/database/server";
import { PAGE_TYPE_LABELS } from "@uwe/shared-ui";
import {
  parseQuery,
  requireStudioApiAuth,
  searchQuerySchema,
} from "@uwe/security";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request, { rateLimit: "search" });
  if (authError) return authError;

  const parsed = parseQuery(request.url, searchQuerySchema);
  if (!parsed.success) return parsed.response;

  const query = parsed.data.q.trim();
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const [wikiResults, adminResults] = await Promise.all([
    getAppRepository().search("dm", {
      query,
      limit: 8,
      urlMode: "studio",
    }),
    searchAdminEntities(prisma, { query, limit: 6 }),
  ]);

  return NextResponse.json({
    results: [
      ...wikiResults.map((result) => ({
        id: result.pageId,
        label: result.title,
        href: result.href,
        group: "Seiten",
        hint: `${PAGE_TYPE_LABELS[result.type]} · ${result.worldName}`,
      })),
      ...adminResults.map((item) => ({
        id: item.id,
        label: item.title,
        href: item.href,
        group: item.group,
        hint: item.snippet ?? ADMIN_SEARCH_ENTITY_LABELS[item.entityType],
      })),
    ],
  });
}
