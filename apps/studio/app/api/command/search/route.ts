import { NextResponse } from "next/server";
import { getAppRepository } from "@uwe/database/server";
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

  const results = await getAppRepository().search("dm", {
    query,
    limit: 8,
    urlMode: "studio",
  });

  return NextResponse.json({
    results: results.map((result) => ({
      id: result.pageId,
      label: result.title,
      href: result.href,
      group: "Seiten",
      hint: `${PAGE_TYPE_LABELS[result.type]} · ${result.worldName}`,
    })),
  });
}
