/**
 * Life-Brain retrieval for the assistant's `life_brain` context mode.
 *
 * Mirrors Studio's `apps/studio/src/lib/personal-brain-ai-context.ts` — the
 * logic cannot simply be imported because packages must not depend on apps
 * (`scripts/product-boundary-check.mjs`). Semantic chunk retrieval when the
 * question is usable, keyword/recency fallback when embeddings are unavailable.
 *
 * The result only ever feeds a `contextMode: "personal_brain"` request, which
 * the router permanently blocks from reaching any cloud provider.
 */

import { semanticSearchPersonalBrainChunks } from "@uwe/ai-brain";
import type { BrainPrismaClient } from "@uwe/database/brain-client";
import {
  createLifeAdminService,
  createPersonalBrainService,
  loadPersonalBrainPromptContext,
  type PrismaClient,
} from "@uwe/database/server";

export interface LoadAssistantRagContextOptions {
  query?: string;
  retrievalLimit?: number;
  docFallbackLimit?: number;
  factFallbackLimit?: number;
}

export async function loadAssistantRagContext(
  brainDb: BrainPrismaClient,
  db: PrismaClient,
  options: LoadAssistantRagContextOptions = {},
): Promise<string> {
  const lifeAdmin = createLifeAdminService(brainDb, db);
  const personalBrain = createPersonalBrainService(brainDb);
  const query = options.query?.trim() ?? "";
  const retrievalLimit = options.retrievalLimit ?? 8;
  const docFallbackLimit = options.docFallbackLimit ?? 8;
  const factFallbackLimit = options.factFallbackLimit ?? 6;

  return loadPersonalBrainPromptContext({
    query: query || undefined,
    retrievalLimit,
    loadDocs: () =>
      lifeAdmin.listPersonalBrainDocuments({ limit: docFallbackLimit }).then((docs) =>
        docs.map((doc) => ({
          title: doc.title,
          content: doc.content,
          category: doc.category,
        })),
      ),
    loadFacts: () =>
      lifeAdmin.listPersonalBrainFacts({ limit: factFallbackLimit }).then((facts) =>
        facts.map((fact) => ({
          title: fact.title,
          content: fact.content,
          factType: fact.factType,
        })),
      ),
    searchChunks: async (searchQuery, limit) => {
      const results = await semanticSearchPersonalBrainChunks(personalBrain, {
        query: searchQuery,
        limit,
      });
      return results.map((entry) => ({
        documentTitle: entry.documentTitle,
        category: entry.category,
        content: entry.content,
        score: entry.score,
      }));
    },
  });
}
