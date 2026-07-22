import { semanticSearchPersonalBrainChunks } from "@uwe/ai-brain";
import {
import { brainPrisma } from "@uwe/database/brain-client";
  createLifeAdminService,
  createPersonalBrainService,
  loadPersonalBrainPromptContext,
  type PrismaClient,
} from "@uwe/database/server";

export interface LoadStudioPersonalBrainContextOptions {
  query?: string;
  retrievalLimit?: number;
  docFallbackLimit?: number;
  factFallbackLimit?: number;
}

/**
 * Loads serialized Life-Brain prompt context for local agents (RTX).
 * Uses semantic chunk retrieval when a query is present; falls back to keyword search
 * when embeddings are unavailable.
 */
export async function loadStudioPersonalBrainPromptContext(
  db: PrismaClient,
  options: LoadStudioPersonalBrainContextOptions = {},
): Promise<string> {
  const lifeAdmin = createLifeAdminService(brainPrisma, db);
  const personalBrain = createPersonalBrainService(db);
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
