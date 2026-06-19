import { parseStringArray } from "./json-utils";

export interface PersonalBrainSearchableDoc {
  id: string;
  title: string;
  content: string;
  category?: string | null;
  tags?: unknown;
  updatedAt?: Date;
}

export interface PersonalBrainSearchableFact {
  id: string;
  title: string;
  content: string;
  factType: string;
  tags?: unknown;
  updatedAt?: Date;
}

export interface PersonalBrainSearchOptions {
  query?: string;
  category?: string;
  factType?: string;
  tag?: string;
  limit?: number;
  minScore?: number;
}

export interface PersonalBrainSearchHit<T> {
  item: T;
  score: number;
  matchMode: "keyword" | "filter";
}

export interface PersonalBrainSearchResult {
  documents: PersonalBrainSearchHit<PersonalBrainSearchableDoc>[];
  facts: PersonalBrainSearchHit<PersonalBrainSearchableFact>[];
}

const DEFAULT_LIMIT = 20;
const DEFAULT_MIN_SCORE = 0.2;

export function parsePersonalBrainTags(tags: unknown): string[] {
  return parseStringArray(tags).map((tag) => tag.trim()).filter(Boolean);
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function matchesTagFilter(itemTags: unknown, tagFilter?: string): boolean {
  if (!tagFilter?.trim()) {
    return true;
  }
  const needle = normalizeTag(tagFilter);
  return parsePersonalBrainTags(itemTags).some((tag) => normalizeTag(tag) === needle);
}

function scoreKeywordMatch(
  title: string,
  content: string,
  extraFields: string[],
  query: string,
): number {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (terms.length === 0) {
    return 1;
  }

  const haystack = [title, content, ...extraFields]
    .join("\n")
    .toLowerCase();

  const hits = terms.filter((term) => haystack.includes(term)).length;
  return hits / terms.length;
}

export function searchPersonalBrainDocuments(
  documents: PersonalBrainSearchableDoc[],
  options: PersonalBrainSearchOptions = {},
): PersonalBrainSearchHit<PersonalBrainSearchableDoc>[] {
  const query = options.query?.trim() ?? "";
  const limit = options.limit ?? DEFAULT_LIMIT;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

  const filtered = documents.filter((doc) => {
    if (options.category && doc.category !== options.category) {
      return false;
    }
    return matchesTagFilter(doc.tags, options.tag);
  });

  if (!query) {
    return filtered
      .sort((left, right) => {
        const leftTime = left.updatedAt?.getTime() ?? 0;
        const rightTime = right.updatedAt?.getTime() ?? 0;
        return rightTime - leftTime;
      })
      .slice(0, limit)
      .map((item) => ({ item, score: 1, matchMode: "filter" as const }));
  }

  return filtered
    .map((item) => {
      const tagFields = parsePersonalBrainTags(item.tags);
      const score = scoreKeywordMatch(
        item.title,
        item.content,
        [item.category ?? "", ...tagFields],
        query,
      );
      return { item, score, matchMode: "keyword" as const };
    })
    .filter((entry) => entry.score >= minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function searchPersonalBrainFacts(
  facts: PersonalBrainSearchableFact[],
  options: PersonalBrainSearchOptions = {},
): PersonalBrainSearchHit<PersonalBrainSearchableFact>[] {
  const query = options.query?.trim() ?? "";
  const limit = options.limit ?? DEFAULT_LIMIT;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

  const filtered = facts.filter((fact) => {
    if (options.factType && fact.factType !== options.factType) {
      return false;
    }
    return matchesTagFilter(fact.tags, options.tag);
  });

  if (!query) {
    return filtered
      .sort((left, right) => {
        const leftTime = left.updatedAt?.getTime() ?? 0;
        const rightTime = right.updatedAt?.getTime() ?? 0;
        return rightTime - leftTime;
      })
      .slice(0, limit)
      .map((item) => ({ item, score: 1, matchMode: "filter" as const }));
  }

  return filtered
    .map((item) => {
      const tagFields = parsePersonalBrainTags(item.tags);
      const score = scoreKeywordMatch(
        item.title,
        item.content,
        [item.factType, ...tagFields],
        query,
      );
      return { item, score, matchMode: "keyword" as const };
    })
    .filter((entry) => entry.score >= minScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function searchPersonalBrain(
  documents: PersonalBrainSearchableDoc[],
  facts: PersonalBrainSearchableFact[],
  options: PersonalBrainSearchOptions = {},
): PersonalBrainSearchResult {
  return {
    documents: searchPersonalBrainDocuments(documents, options),
    facts: searchPersonalBrainFacts(facts, options),
  };
}

export function collectPersonalBrainTags(
  documents: PersonalBrainSearchableDoc[],
  facts: PersonalBrainSearchableFact[],
): string[] {
  const tags = new Set<string>();
  for (const doc of documents) {
    for (const tag of parsePersonalBrainTags(doc.tags)) {
      tags.add(tag);
    }
  }
  for (const fact of facts) {
    for (const tag of parsePersonalBrainTags(fact.tags)) {
      tags.add(tag);
    }
  }
  return [...tags].sort((left, right) => left.localeCompare(right, "de"));
}
