import { NextResponse } from "next/server";
import { createLifeAdminService, prisma } from "@uwe/database/server";
import { requireStudioApiAuth } from "@uwe/security";

export async function GET(request: Request) {
  const authError = requireStudioApiAuth(request, { rateLimit: "search" });
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const category = searchParams.get("category")?.trim() || undefined;
  const factType = searchParams.get("factType")?.trim() || undefined;
  const tag = searchParams.get("tag")?.trim() || undefined;
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

  const service = createLifeAdminService(prisma);
  const result = await service.searchPersonalBrain({
    query: query || undefined,
    category,
    factType,
    tag,
    limit,
  });

  return NextResponse.json({
    query,
    category: category ?? null,
    factType: factType ?? null,
    tag: tag ?? null,
    documents: result.documents.map(({ item, score, matchMode }) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      category: item.category,
      score,
      matchMode,
      updatedAt: item.updatedAt?.toISOString() ?? null,
    })),
    facts: result.facts.map(({ item, score, matchMode }) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      factType: item.factType,
      score,
      matchMode,
      updatedAt: item.updatedAt?.toISOString() ?? null,
    })),
  });
}
