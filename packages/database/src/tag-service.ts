import type { PrismaClient } from "./client";
import { parseStringArray, toPrismaJsonValue } from "./json-utils";

export type TagEntityType =
  | "page"
  | "asset"
  | "soundboard_button"
  | "personal_brain_document"
  | "personal_brain_fact";

export interface TagReference {
  entityType: TagEntityType;
  entityId: string;
  title: string;
  worldId?: string | null;
  publishStatus?: string | null;
  visibility?: string | null;
}

export interface TagInventoryEntry {
  tag: string;
  normalizedKey: string;
  count: number;
  references: TagReference[];
  onlyOnDrafts: boolean;
  onlyDmOnly: boolean;
}

export interface SimilarTagGroup {
  canonical: string;
  variants: string[];
  reason: "normalized_match" | "near_duplicate";
}

export interface TagMergeSuggestion {
  targetTag: string;
  sourceTags: string[];
  totalReferences: number;
  reason: string;
}

export interface TagMergeResult {
  mergedFrom: string[];
  toTag: string;
  updatedEntities: number;
}

/** Normalize tag for comparison (lowercase, umlaut folding, whitespace). */
export function normalizeTagKey(tag: string): string {
  return tag
    .trim()
    .toLocaleLowerCase("de")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[\s_]+/g, "-");
}

/** Canonical display form: trimmed, lowercased. */
export function canonicalizeTag(tag: string): string {
  return tag.trim().toLocaleLowerCase("de");
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  return matrix[b.length]![a.length]!;
}

function replaceTagsByNormalizedKeys(
  tags: string[],
  fromKeys: Set<string>,
  toTag: string,
): string[] | null {
  const shouldReplace = (tag: string) =>
    fromKeys.has(normalizeTagKey(tag)) && tag !== toTag;
  let changed = false;
  const result: string[] = [];
  const seen = new Set<string>();

  for (const tag of tags) {
    const replacement = shouldReplace(tag) ? toTag : tag;
    if (shouldReplace(tag)) changed = true;
    if (!seen.has(replacement)) {
      seen.add(replacement);
      result.push(replacement);
    }
  }

  return changed ? result : null;
}

export async function collectTagInventory(
  db: PrismaClient,
  options: { worldId?: string } = {},
): Promise<TagInventoryEntry[]> {
  const worldId = options.worldId;
  const map = new Map<string, TagInventoryEntry>();

  const addRef = (tag: string, ref: TagReference) => {
    const normalizedKey = normalizeTagKey(tag);
    const key = tag;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        tag: key,
        normalizedKey,
        count: 0,
        references: [],
        onlyOnDrafts: true,
        onlyDmOnly: true,
      };
      map.set(key, entry);
    }
    entry.count++;
    entry.references.push(ref);
    if (ref.publishStatus !== "draft") {
      entry.onlyOnDrafts = false;
    }
    if (ref.visibility !== "dm_only") {
      entry.onlyDmOnly = false;
    }
  };

  const pages = await db.page.findMany({
    where: worldId ? { worldId } : undefined,
    select: {
      id: true,
      title: true,
      worldId: true,
      publishStatus: true,
      visibility: true,
      tags: true,
    },
  });
  for (const page of pages) {
    for (const tag of parseStringArray(page.tags)) {
      addRef(tag, {
        entityType: "page",
        entityId: page.id,
        title: page.title,
        worldId: page.worldId,
        publishStatus: page.publishStatus,
        visibility: page.visibility,
      });
    }
  }

  const assets = await db.asset.findMany({
    where: worldId ? { worldId } : undefined,
    select: {
      id: true,
      title: true,
      worldId: true,
      visibility: true,
      tags: true,
    },
  });
  for (const asset of assets) {
    for (const tag of parseStringArray(asset.tags)) {
      addRef(tag, {
        entityType: "asset",
        entityId: asset.id,
        title: asset.title,
        worldId: asset.worldId,
        visibility: asset.visibility,
      });
    }
  }

  const buttons = await db.soundboardButton.findMany({
    where: worldId ? { worldId } : undefined,
    select: { id: true, title: true, worldId: true, tags: true },
  });
  for (const button of buttons) {
    for (const tag of parseStringArray(button.tags)) {
      addRef(tag, {
        entityType: "soundboard_button",
        entityId: button.id,
        title: button.title,
        worldId: button.worldId,
      });
    }
  }

  const brainDocs = await db.personalBrainDocument.findMany({
    select: { id: true, title: true, tags: true },
  });
  for (const doc of brainDocs) {
    for (const tag of parseStringArray(doc.tags)) {
      addRef(tag, {
        entityType: "personal_brain_document",
        entityId: doc.id,
        title: doc.title,
      });
    }
  }

  const brainFacts = await db.personalBrainFact.findMany({
    select: { id: true, title: true, tags: true },
  });
  for (const fact of brainFacts) {
    for (const tag of parseStringArray(fact.tags)) {
      addRef(tag, {
        entityType: "personal_brain_fact",
        entityId: fact.id,
        title: fact.title,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "de"));
}

export function findSimilarTagGroups(inventory: TagInventoryEntry[]): SimilarTagGroup[] {
  const groups: SimilarTagGroup[] = [];
  const byNormalized = new Map<string, string[]>();

  for (const entry of inventory) {
    const list = byNormalized.get(entry.normalizedKey) ?? [];
    list.push(entry.tag);
    byNormalized.set(entry.normalizedKey, list);
  }

  for (const variants of byNormalized.values()) {
    const unique = [...new Set(variants)];
    if (unique.length > 1) {
      const canonical = unique.reduce((best, tag) =>
        inventory.find((e) => e.tag === tag)!.count >
        inventory.find((e) => e.tag === best)!.count
          ? tag
          : best,
      );
      groups.push({
        canonical,
        variants: unique.filter((tag) => tag !== canonical),
        reason: "normalized_match",
      });
    }
  }

  const tags = inventory.map((e) => e.tag);
  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      const a = tags[i]!;
      const b = tags[j]!;
      if (normalizeTagKey(a) === normalizeTagKey(b)) continue;
      const dist = levenshtein(normalizeTagKey(a), normalizeTagKey(b));
      if (dist <= 1 && a.length >= 3 && b.length >= 3) {
        const existing = groups.find(
          (g) => g.variants.includes(a) || g.variants.includes(b) || g.canonical === a || g.canonical === b,
        );
        if (!existing) {
          const countA = inventory.find((e) => e.tag === a)!.count;
          const countB = inventory.find((e) => e.tag === b)!.count;
          const canonical = countA >= countB ? a : b;
          const variant = canonical === a ? b : a;
          groups.push({
            canonical,
            variants: [variant],
            reason: "near_duplicate",
          });
        }
      }
    }
  }

  return groups;
}

export function findUnusedTags(inventory: TagInventoryEntry[]): TagInventoryEntry[] {
  return inventory.filter((entry) => entry.onlyOnDrafts || entry.onlyDmOnly);
}

export function suggestTagMerges(inventory: TagInventoryEntry[]): TagMergeSuggestion[] {
  const suggestions: TagMergeSuggestion[] = [];

  for (const group of findSimilarTagGroups(inventory)) {
    const allTags = [group.canonical, ...group.variants];
    const totalReferences = allTags.reduce(
      (sum, tag) => sum + (inventory.find((e) => e.tag === tag)?.count ?? 0),
      0,
    );
    suggestions.push({
      targetTag: canonicalizeTag(group.canonical),
      sourceTags: group.variants.map(canonicalizeTag),
      totalReferences,
      reason:
        group.reason === "normalized_match"
          ? "Gleiche Schreibweise nach Normalisierung"
          : "Ähnliche Schreibweise (Levenshtein)",
    });
  }

  return suggestions.sort((a, b) => b.totalReferences - a.totalReferences);
}

export async function mergeTags(
  db: PrismaClient,
  options: {
    worldId?: string;
    fromTags: string[];
    toTag: string;
  },
): Promise<TagMergeResult> {
  const toTag = canonicalizeTag(options.toTag);
  const fromKeys = new Set(options.fromTags.map((tag) => normalizeTagKey(tag)));

  if (fromKeys.size === 0) {
    return { mergedFrom: [], toTag, updatedEntities: 0 };
  }

  const shouldReplace = (tag: string) =>
    fromKeys.has(normalizeTagKey(tag)) && tag !== toTag;

  let updatedEntities = 0;

  const pages = await db.page.findMany({
    where: options.worldId ? { worldId: options.worldId } : undefined,
    select: { id: true, tags: true },
  });
  for (const page of pages) {
    const tags = parseStringArray(page.tags);
    const next = replaceTagsByNormalizedKeys(tags, fromKeys, toTag);
    if (next) {
      await db.page.update({ where: { id: page.id }, data: { tags: toPrismaJsonValue(next) } });
      updatedEntities++;
    }
  }

  const assets = await db.asset.findMany({
    where: options.worldId ? { worldId: options.worldId } : undefined,
    select: { id: true, tags: true },
  });
  for (const asset of assets) {
    const tags = parseStringArray(asset.tags);
    const next = replaceTagsByNormalizedKeys(tags, fromKeys, toTag);
    if (next) {
      await db.asset.update({ where: { id: asset.id }, data: { tags: toPrismaJsonValue(next) } });
      updatedEntities++;
    }
  }

  const buttons = await db.soundboardButton.findMany({
    where: options.worldId ? { worldId: options.worldId } : undefined,
    select: { id: true, tags: true },
  });
  for (const button of buttons) {
    const tags = parseStringArray(button.tags);
    const next = replaceTagsByNormalizedKeys(tags, fromKeys, toTag);
    if (next) {
      await db.soundboardButton.update({
        where: { id: button.id },
        data: { tags: toPrismaJsonValue(next) },
      });
      updatedEntities++;
    }
  }

  const brainDocs = await db.personalBrainDocument.findMany({ select: { id: true, tags: true } });
  for (const doc of brainDocs) {
    const tags = parseStringArray(doc.tags);
    const next = replaceTagsByNormalizedKeys(tags, fromKeys, toTag);
    if (next) {
      await db.personalBrainDocument.update({
        where: { id: doc.id },
        data: { tags: toPrismaJsonValue(next) },
      });
      updatedEntities++;
    }
  }

  const brainFacts = await db.personalBrainFact.findMany({ select: { id: true, tags: true } });
  for (const fact of brainFacts) {
    const tags = parseStringArray(fact.tags);
    const next = replaceTagsByNormalizedKeys(tags, fromKeys, toTag);
    if (next) {
      await db.personalBrainFact.update({
        where: { id: fact.id },
        data: { tags: toPrismaJsonValue(next) },
      });
      updatedEntities++;
    }
  }

  return {
    mergedFrom: options.fromTags.filter((tag) => shouldReplace(tag)),
    toTag,
    updatedEntities,
  };
}

export function createTagService(db: PrismaClient) {
  return {
    collectInventory: (options?: { worldId?: string }) => collectTagInventory(db, options),
    findSimilarGroups: findSimilarTagGroups,
    findUnused: findUnusedTags,
    suggestMerges: suggestTagMerges,
    merge: (options: { worldId?: string; fromTags: string[]; toTag: string }) =>
      mergeTags(db, options),
    normalizeKey: normalizeTagKey,
    canonicalize: canonicalizeTag,
  };
}
