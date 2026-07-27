import { NextResponse } from "next/server";
import { semanticSearchPersonalBrainChunks } from "@uwe/ai-brain";
import { brainPrisma } from "@uwe/database/brain-client";
import {
  createLifeAdminService,
  createPersonalBrainService,
  prisma,
} from "@uwe/database/server";
import { requireBrainOwnerAuth } from "@/src/lib/owner-auth";
import { checkRateLimit, clientIpFromHeaders, RATE_LIMIT_PRESETS } from "@/src/lib/rate-limit";

/**
 * Suche im Personal Brain — Dokumente, Fakten und semantische Chunk-Treffer.
 *
 * Lag in Studio (`/api/life-brain/search`). Das persönliche Wissen gehört zu
 * Brain (Abschnitt H2), also liegt die Route jetzt hier — hinter demselben
 * Häkchen-Guard wie jede andere Brain-Route. Der MCP-Brain-Server liest sie
 * ebenfalls hier; sein `dataApi` zeigt nicht mehr auf Studio.
 */

export async function GET(request: Request) {
  const authError = await requireBrainOwnerAuth();
  if (authError) return authError;

  const ip = clientIpFromHeaders(request.headers);
  const limitCheck = checkRateLimit(`brain-search:${ip}`, RATE_LIMIT_PRESETS.search);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "Retry-After": String(limitCheck.retryAfterSeconds) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const category = searchParams.get("category")?.trim() || undefined;
  const factType = searchParams.get("factType")?.trim() || undefined;
  const tag = searchParams.get("tag")?.trim() || undefined;
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

  const service = createLifeAdminService(brainPrisma, prisma);
  const result = await service.searchPersonalBrain({
    query: query || undefined,
    category,
    factType,
    tag,
    limit,
  });

  let chunks: Array<{
    chunkId: string;
    documentId: string;
    documentTitle: string;
    category: string | null;
    content: string;
    score: number;
  }> = [];
  let matchMode: "semantic" | "keyword" | "filter" = "filter";

  if (query.length >= 2 && !factType && !tag) {
    const personalBrain = createPersonalBrainService(brainPrisma);
    let documentIds: string[] | undefined;
    if (category) {
      const docs = await service.listPersonalBrainDocuments({ category, limit: 200 });
      documentIds = docs.map((doc) => doc.id);
    }

    if (!category || (documentIds && documentIds.length > 0)) {
      const semanticResults = await semanticSearchPersonalBrainChunks(personalBrain, {
        query,
        limit: Math.min(limit, 20),
        documentIds,
      });
      chunks = semanticResults.map((entry) => ({
        chunkId: entry.chunkId,
        documentId: entry.documentId,
        documentTitle: entry.documentTitle,
        category: entry.category,
        content: entry.content,
        score: entry.score,
      }));
      matchMode = chunks.some((entry) => entry.score >= 0.35) ? "semantic" : "keyword";
    }
  } else if (query.length >= 2) {
    matchMode = "keyword";
  }

  return NextResponse.json({
    query,
    category: category ?? null,
    factType: factType ?? null,
    tag: tag ?? null,
    matchMode,
    documents: result.documents.map(({ item, score, matchMode: docMatchMode }) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      category: item.category,
      score,
      matchMode: docMatchMode,
      updatedAt: item.updatedAt?.toISOString() ?? null,
    })),
    facts: result.facts.map(({ item, score, matchMode: factMatchMode }) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      factType: item.factType,
      score,
      matchMode: factMatchMode,
      updatedAt: item.updatedAt?.toISOString() ?? null,
    })),
    chunks,
  });
}
