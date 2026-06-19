import type { PersonalBrainService } from "@uwe/database/server";
import { cosineSimilarity } from "./cosine";
import { createEmbeddingProvider } from "./provider";
import { resolveBrainEmbeddingSettings } from "./settings";
import type { EmbeddingProvider } from "./types";

const DEFAULT_LIMIT = 8;
const DEFAULT_MIN_SCORE = 0.2;

export interface PersonalBrainSemanticSearchOptions {
  query: string;
  limit?: number;
  minScore?: number;
  documentIds?: string[];
}

export interface PersonalBrainSemanticSearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  category: string | null;
  content: string;
  chunkIndex: number;
  score: number;
}

export async function semanticSearchPersonalBrainChunks(
  service: PersonalBrainService,
  options: PersonalBrainSemanticSearchOptions,
  provider?: EmbeddingProvider,
): Promise<PersonalBrainSemanticSearchResult[]> {
  const query = options.query.trim();
  if (!query) {
    return [];
  }

  const settings = resolveBrainEmbeddingSettings();
  const embeddingProvider = provider ?? createEmbeddingProvider();
  const limit = options.limit ?? DEFAULT_LIMIT;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

  const chunks = await service.listSearchableChunks(options.documentIds);
  if (chunks.length === 0) {
    return [];
  }

  const indexedChunks = chunks.filter((chunk) => chunk.embedding && chunk.embedding.length > 0);
  const canUseSemantic =
    settings.enabled &&
    embeddingProvider.id !== "disabled" &&
    indexedChunks.length > 0;

  if (!canUseSemantic) {
    return keywordSearch(chunks, query, limit);
  }

  let providerOnline = false;
  try {
    const health = await embeddingProvider.healthCheck();
    providerOnline = health.ok;
  } catch {
    providerOnline = false;
  }

  if (!providerOnline) {
    return keywordSearch(chunks, query, limit);
  }

  let queryVector: number[];
  try {
    queryVector = await embeddingProvider.embedText(query);
  } catch {
    return keywordSearch(chunks, query, limit);
  }

  return indexedChunks
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryVector, chunk.embedding!),
    }))
    .filter((entry) => entry.score >= minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ chunk, score }) => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      documentTitle: chunk.document.title,
      category: chunk.document.category,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      score,
    }));
}

function keywordSearch(
  chunks: Awaited<ReturnType<PersonalBrainService["listSearchableChunks"]>>,
  query: string,
  limit: number,
): PersonalBrainSemanticSearchResult[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (terms.length === 0) {
    return [];
  }

  return chunks
    .map((chunk) => {
      const haystack = `${chunk.document.title}\n${chunk.content}`.toLowerCase();
      const hits = terms.filter((term) => haystack.includes(term)).length;
      return { chunk, score: hits / terms.length };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ chunk, score }) => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      documentTitle: chunk.document.title,
      category: chunk.document.category,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      score,
    }));
}
