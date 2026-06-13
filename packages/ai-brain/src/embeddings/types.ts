import type { BrainAccessContext, BrainDocumentType, BrainVisibility } from "@uwe/database/server";

export type EmbeddingProviderId = "ollama" | "openai_compatible" | "mock" | "disabled";

export interface BrainEmbeddingSettings {
  enabled: boolean;
  provider: EmbeddingProviderId;
  model: string;
  baseUrl: string;
  timeoutSeconds: number;
  store: "uwe-database";
}

export interface EmbeddingHealthCheckResult {
  ok: boolean;
  provider: EmbeddingProviderId;
  message: string;
  latencyMs?: number;
}

export interface EmbeddingProvider {
  readonly id: EmbeddingProviderId;
  readonly isLocal: boolean;
  readonly model: string;
  embedText(text: string): Promise<number[]>;
  healthCheck(): Promise<EmbeddingHealthCheckResult>;
}

export interface ChunkBrainTextOptions {
  maxChars?: number;
  overlap?: number;
  includeTitle?: string;
}

export interface IndexBrainDocumentResult {
  documentId: string;
  chunkCount: number;
  embeddedCount: number;
  providerOnline: boolean;
  embeddingsEnabled: boolean;
  message: string;
}

export interface ReindexBrainWorldResult {
  worldSlug: string;
  documentCount: number;
  indexedCount: number;
  embeddedCount: number;
  failedCount: number;
  providerOnline: boolean;
  embeddingsEnabled: boolean;
  errors: Array<{ documentId: string; message: string }>;
}

export interface SemanticSearchOptions {
  query: string;
  worldSlug: string;
  limit?: number;
  minScore?: number;
  accessContext?: BrainAccessContext;
  campaignId?: string | null;
}

export interface SemanticSearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  chunkIndex: number;
  score: number;
  visibility: BrainVisibility;
  documentType: BrainDocumentType;
  matchMode: "semantic" | "keyword";
}

export class BrainEmbeddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrainEmbeddingError";
  }
}

export class BrainEmbeddingOfflineError extends BrainEmbeddingError {
  constructor(message = "Embedding-Provider offline") {
    super(message);
    this.name = "BrainEmbeddingOfflineError";
  }
}
