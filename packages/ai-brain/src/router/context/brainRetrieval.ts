import type { BrainStoreService } from "@uwe/database/server";
import { createDbBrainKnowledgeSource } from "../../context/db-brain-knowledge-source";
import {
  emptyBrainKnowledgeSource,
  type BrainKnowledgeSource,
} from "../../context/brain-knowledge-source";

export interface BrainRetrievalAdapterOptions {
  /** When false, returns an empty source (no brain context). */
  enabled?: boolean;
}

/**
 * Adapter that reuses the existing DB-backed brain knowledge source.
 * No duplicate retrieval logic — wraps createDbBrainKnowledgeSource.
 */
export function createBrainRetrievalAdapter(
  brainStore: BrainStoreService,
  worldSlug: string,
  options?: BrainRetrievalAdapterOptions,
): BrainKnowledgeSource {
  if (options?.enabled === false) {
    return emptyBrainKnowledgeSource;
  }

  return createDbBrainKnowledgeSource(brainStore, worldSlug);
}

export { createDbBrainKnowledgeSource } from "../../context/db-brain-knowledge-source";
export type {
  BrainKnowledgeSource,
  BrainKnowledgeEntry,
  BrainKnowledgeQuery,
} from "../../context/brain-knowledge-source";
