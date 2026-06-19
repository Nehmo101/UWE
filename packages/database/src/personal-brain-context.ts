export interface PersonalBrainDocSlice {
  title: string;
  content: string;
  category?: string | null;
}

export interface PersonalBrainFactSlice {
  title: string;
  content: string;
  factType: string;
}

export function serializePersonalBrainForPrompt(
  docs: PersonalBrainDocSlice[],
  facts: PersonalBrainFactSlice[],
): string {
  const parts: string[] = [];

  if (docs.length > 0) {
    parts.push("# Persönliches Life-Brain — Dokumente");
    for (const doc of docs) {
      const category = doc.category?.trim();
      parts.push(
        [`## ${doc.title}`, category ? `Kategorie: ${category}` : "", doc.content]
          .filter(Boolean)
          .join("\n"),
      );
    }
  }

  if (facts.length > 0) {
    parts.push("# Persönliches Life-Brain — Fakten");
    for (const fact of facts) {
      parts.push(`- **${fact.title}** (${fact.factType}): ${fact.content}`);
    }
  }

  return parts.join("\n\n");
}

export async function loadPersonalBrainPromptContext(
  loadDocs: () => Promise<PersonalBrainDocSlice[]>,
  loadFacts: () => Promise<PersonalBrainFactSlice[]>,
): Promise<string> {
  const [docs, facts] = await Promise.all([loadDocs(), loadFacts()]);
  return serializePersonalBrainForPrompt(docs, facts);
}

export interface PersonalBrainAgentContextOptions {
  query?: string;
  limit?: number;
}

/**
 * Loads a query-focused Life-Brain context block for local agents (RTX/Ollama).
 * Falls back to recent entries when no query is provided.
 */
export async function loadPersonalBrainAgentContext(
  loadDocs: (query?: string, limit?: number) => Promise<PersonalBrainDocSlice[]>,
  loadFacts: (query?: string, limit?: number) => Promise<PersonalBrainFactSlice[]>,
  options: PersonalBrainAgentContextOptions = {},
): Promise<string> {
  const limit = options.limit ?? 12;
  const query = options.query?.trim();

  const [docs, facts] = await Promise.all([
    loadDocs(query, limit),
    loadFacts(query, limit),
  ]);

  return serializePersonalBrainForPrompt(docs, facts);
}
