import type { BrainStoreService } from "@uwe/database/server";
import { cosineSimilarity } from "./cosine";
import { createEmbeddingProvider } from "./provider";
import { resolveBrainEmbeddingSettings } from "./settings";
import type { EmbeddingProvider, SemanticSearchOptions, SemanticSearchResult } from "./types";

const DEFAULT_LIMIT = 8;
const DEFAULT_MIN_SCORE = 0.2;

export async function semanticSearchBrainChunks(
  brainStore: BrainStoreService,
  options: SemanticSearchOptions,
  provider?: EmbeddingProvider,
): Promise<SemanticSearchResult[]> {
  const query = options.query.trim();
  if (!query) {
    return [];
  }

  const settings = resolveBrainEmbeddingSettings();
  const embeddingProvider = provider ?? createEmbeddingProvider();
  const limit = options.limit ?? DEFAULT_LIMIT;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

  const chunks = await brainStore.listSearchableChunks(options.worldSlug, {
    campaignId: options.campaignId,
  });

  if (chunks.length === 0) {
    return [];
  }

  const indexedChunks = chunks.filter((chunk) => chunk.embedding && chunk.embedding.length > 0);
  const canUseSemantic =
    settings.enabled &&
    embeddingProvider.id !== "disabled" &&
    indexedChunks.length > 0;

  if (!canUseSemantic) {
    return keywordSearch(chunks, query, limit, minScore);
  }

  let providerOnline = false;
  try {
    const health = await embeddingProvider.healthCheck();
    providerOnline = health.ok;
  } catch {
    providerOnline = false;
  }

  if (!providerOnline) {
    return keywordSearch(chunks, query, limit, minScore);
  }

  let queryVector: number[];
  try {
    queryVector = await embeddingProvider.embedText(query);
  } catch (error) {
    console.warn(
      "[uwe/ai-brain] brain embedding failed, falling back to keyword search",
      error,
    );
    return keywordSearch(chunks, query, limit, minScore);
  }

  const scored = indexedChunks
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryVector, chunk.embedding!),
    }))
    .filter((entry) => entry.score >= minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  return scored.map(({ chunk, score }) => ({
    chunkId: chunk.id,
    documentId: chunk.documentId,
    documentTitle: chunk.document.title,
    content: chunk.content,
    chunkIndex: chunk.chunkIndex,
    score,
    documentType: chunk.document.documentType,
    matchMode: "semantic" as const,
  }));
}

function keywordSearch(
  chunks: Awaited<ReturnType<BrainStoreService["listSearchableChunks"]>>,
  query: string,
  limit: number,
  minScore: number,
): SemanticSearchResult[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (terms.length === 0) {
    return [];
  }

  const scored = chunks
    .map((chunk) => {
      const haystack = `${chunk.document.title}\n${chunk.content}`.toLowerCase();
      const hits = terms.filter((term) => haystack.includes(term)).length;
      const score = hits / terms.length;
      return { chunk, score };
    })
    .filter((entry) => entry.score >= minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  return scored.map(({ chunk, score }) => ({
    chunkId: chunk.id,
    documentId: chunk.documentId,
    documentTitle: chunk.document.title,
    content: chunk.content,
    chunkIndex: chunk.chunkIndex,
    score,
    documentType: chunk.document.documentType,
    matchMode: "keyword" as const,
  }));
}
