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

export interface PersonalBrainRetrievedChunk {
  documentTitle: string;
  category: string | null;
  content: string;
  score?: number;
}

export interface LoadPersonalBrainContextOptions {
  query?: string;
  retrievalLimit?: number;
  loadDocs?: () => Promise<PersonalBrainDocSlice[]>;
  loadFacts?: () => Promise<PersonalBrainFactSlice[]>;
  searchChunks?: (query: string, limit: number) => Promise<PersonalBrainRetrievedChunk[]>;
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

export function filterPersonalBrainFactsByQuery(
  facts: PersonalBrainFactSlice[],
  query: string,
  limit = 8,
): PersonalBrainFactSlice[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (terms.length === 0) {
    return facts.slice(0, limit);
  }

  return facts
    .map((fact) => {
      const haystack = `${fact.title}\n${fact.content}`.toLowerCase();
      const hits = terms.filter((term) => haystack.includes(term)).length;
      return { fact, hits };
    })
    .filter((entry) => entry.hits > 0)
    .sort((left, right) => right.hits - left.hits)
    .slice(0, limit)
    .map((entry) => entry.fact);
}

export function serializePersonalBrainRetrievalForPrompt(
  chunks: PersonalBrainRetrievedChunk[],
  facts: PersonalBrainFactSlice[],
): string {
  const parts: string[] = [];

  if (chunks.length > 0) {
    parts.push("# Persönliches Life-Brain — relevante Ausschnitte");
    for (const chunk of chunks) {
      const category = chunk.category?.trim();
      parts.push(
        [`## ${chunk.documentTitle}`, category ? `Kategorie: ${category}` : "", chunk.content]
          .filter(Boolean)
          .join("\n"),
      );
    }
  }

  if (facts.length > 0) {
    parts.push("# Persönliches Life-Brain — relevante Fakten");
    for (const fact of facts) {
      parts.push(`- **${fact.title}** (${fact.factType}): ${fact.content}`);
    }
  }

  return parts.join("\n\n");
}

export async function loadPersonalBrainPromptContext(
  loadDocsOrOptions:
    | (() => Promise<PersonalBrainDocSlice[]>)
    | LoadPersonalBrainContextOptions,
  loadFactsArg?: () => Promise<PersonalBrainFactSlice[]>,
): Promise<string> {
  const options: LoadPersonalBrainContextOptions =
    typeof loadDocsOrOptions === "function"
      ? {
          loadDocs: loadDocsOrOptions,
          loadFacts: loadFactsArg,
        }
      : loadDocsOrOptions;

  const query = options.query?.trim() ?? "";

  if (query && options.searchChunks) {
    const limit = options.retrievalLimit ?? 8;
    const [chunks, allFacts] = await Promise.all([
      options.searchChunks(query, limit),
      options.loadFacts?.() ?? Promise.resolve([]),
    ]);
    const facts = filterPersonalBrainFactsByQuery(allFacts, query, Math.min(6, limit));
    const serialized = serializePersonalBrainRetrievalForPrompt(chunks, facts);
    if (serialized.trim()) {
      return serialized;
    }
  }

  const [docs, facts] = await Promise.all([
    options.loadDocs?.() ?? Promise.resolve([]),
    options.loadFacts?.() ?? Promise.resolve([]),
  ]);

  return serializePersonalBrainForPrompt(docs, facts);
}
