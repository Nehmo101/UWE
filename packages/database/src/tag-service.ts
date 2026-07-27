import type { PrismaClient } from "./client";
import type { BrainPrismaClient } from "./brain-client";
import type { EntityTagEntityType } from "./generated/prisma/client";
import { createEntityTagService } from "./entity-tag-service";
import { asMetadataRecord, parseStringArray, parseTagsFromMetadata, toPrismaJsonValue } from "./json-utils";

/** When true, tag merges update EntityTag only (Json dual-write skipped). Requires completed backfill. */
export function isEntityTagsPrimaryMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.UWE_ENTITY_TAGS_PRIMARY?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export type TagEntityType = EntityTagEntityType;

export const ENTITY_TAG_ENTITY_TYPE_LABELS: Record<EntityTagEntityType, string> = {
  page: "Wiki-Seite",
  asset: "Asset",
  soundboard_button: "Soundboard",
  personal_brain_document: "Life Brain Dokument",
  personal_brain_fact: "Life Brain Fakt",
  capture: "Capture",
  project: "Projekt",
  workshop: "Werkstatt",
  contract: "Vertrag",
  hardware: "Hardware",
  dev_idea: "Dev-Idee",
  recipe: "Rezept",
  scan_document: "Scan",
};

export interface TagReference {
  entityType: TagEntityType;
  entityId: string;
  title: string;
  worldId?: string | null;
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

export interface BackfillEntityTagsResult {
  tagsUpserted: number;
  entityTagsCreated: number;
  entityTagsSkipped: number;
  entitiesProcessed: number;
}

export interface TagCoverageTypeStats {
  entityType: EntityTagEntityType;
  totalEntities: number;
  jsonTagged: number;
  entityTagTagged: number;
}

export interface TagCoverageStats {
  types: TagCoverageTypeStats[];
  totalTags: number;
  totalEntityTags: number;
}

export interface TagBackfillVerificationMiss {
  entityId: string;
  title: string;
  worldId?: string | null;
  missingTagKeys: string[];
}

export interface TagBackfillVerificationTypeResult {
  entityType: EntityTagEntityType;
  entitiesWithJsonTags: number;
  entitiesFullyCovered: number;
  missing: TagBackfillVerificationMiss[];
}

export interface TagBackfillVerificationResult {
  ok: boolean;
  totalEntitiesWithJsonTags: number;
  totalEntitiesMissing: number;
  totalMissingLinks: number;
  types: TagBackfillVerificationTypeResult[];
}

const TAG_BACKFILL_ENTITY_TYPES = [
  "page",
  "asset",
  "soundboard_button",
  "personal_brain_document",
  "personal_brain_fact",
  "capture",
  "project",
  "workshop",
  "contract",
  "hardware",
  "dev_idea",
] as const satisfies readonly EntityTagEntityType[];

type TagBackfillEntityType = (typeof TAG_BACKFILL_ENTITY_TYPES)[number];

interface JsonTagEntityRow {
  id: string;
  title: string;
  tags: unknown;
  worldId?: string | null;
  visibility?: string | null;
}

async function loadJsonTagEntities(
  db: PrismaClient,
  brainDb: BrainPrismaClient,
  entityType: TagBackfillEntityType,
  worldId?: string,
): Promise<JsonTagEntityRow[]> {
  switch (entityType) {
    case "page":
      return db.page.findMany({
        where: worldId ? { worldId } : undefined,
        select: {
          id: true,
          title: true,
          tags: true,
          worldId: true,
          visibility: true,
        },
      });
    case "asset":
      return db.asset.findMany({
        where: worldId ? { worldId } : undefined,
        select: {
          id: true,
          title: true,
          tags: true,
          worldId: true,
          visibility: true,
        },
      });
    case "soundboard_button":
      return db.soundboardButton.findMany({
        where: worldId ? { worldId } : undefined,
        select: { id: true, title: true, tags: true, worldId: true },
      });
    case "personal_brain_document":
      return brainDb.personalBrainDocument.findMany({
        select: { id: true, title: true, tags: true },
      });
    case "personal_brain_fact":
      return brainDb.personalBrainFact.findMany({
        select: { id: true, title: true, tags: true },
      });
    case "capture":
      return brainDb.captureEntry
        .findMany({
          where: worldId ? { worldId } : undefined,
          select: { id: true, title: true, metadata: true, worldId: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            title: row.title || "Capture",
            tags: parseTagsFromMetadata(row.metadata),
            worldId: row.worldId,
          })),
        );
    case "project":
      return brainDb.personalProject
        .findMany({
          where: worldId ? { worldId } : undefined,
          select: { id: true, name: true, metadata: true, worldId: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            title: row.name,
            tags: parseTagsFromMetadata(row.metadata),
            worldId: row.worldId,
          })),
        );
    case "workshop":
      return brainDb.workshopProject
        .findMany({
          where: worldId ? { worldId } : undefined,
          select: { id: true, title: true, metadata: true, worldId: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            title: row.title,
            tags: parseTagsFromMetadata(row.metadata),
            worldId: row.worldId,
          })),
        );
    case "contract":
      return brainDb.contractExpense.findMany({
        select: { id: true, name: true, metadata: true },
      }).then((rows) =>
        rows.map((row) => ({
          id: row.id,
          title: row.name,
          tags: parseTagsFromMetadata(row.metadata),
          worldId: null,
        })),
      );
    case "hardware":
      return brainDb.hardwareDevice.findMany({
        select: { id: true, name: true, metadata: true },
      }).then((rows) =>
        rows.map((row) => ({
          id: row.id,
          title: row.name,
          tags: parseTagsFromMetadata(row.metadata),
          worldId: null,
        })),
      );
    case "dev_idea":
      return db.devIdea.findMany({
        select: { id: true, title: true, metadata: true },
      }).then((rows) =>
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          tags: parseTagsFromMetadata(row.metadata),
          worldId: null,
        })),
      );
    default:
      return [];
  }
}

/**
 * Dual-write note (Backlog F1/4.6): merge operations still write the merged
 * tag list into BOTH the legacy Json columns/metadata AND EntityTag. The Json
 * write must stay until (1) the entity save paths (repository/asset-repository/
 * soundboard/life-admin-service) write EntityTag instead of only Json, and
 * (2) the Json readers (search-service, entity read paths, portal) are moved
 * to EntityTag. Until then Json is still the system of record on entity writes
 * and `backfillEntityTagsFromJson` re-derives EntityTag from Json — dropping
 * the Json write here would let a later backfill roll back merges.
 * Completeness check: `verifyTagBackfill` / scripts/verify-tag-backfill.ts.
 */
async function syncEntityTagsForJsonEntity(
  db: PrismaClient,
  entityType: TagBackfillEntityType,
  entityId: string,
  tags: string[],
  worldId?: string | null,
): Promise<void> {
  const entityTags = createEntityTagService(db);
  await entityTags.replaceEntityTags(entityType, entityId, tags, { worldId });
}

async function resolveEntityTagsForMerge(
  db: PrismaClient,
  entityType: TagBackfillEntityType,
  entityId: string,
  legacyTags: string[],
): Promise<string[]> {
  const linked = await createEntityTagService(db).listTagsForEntity(entityType, entityId);
  if (linked.length > 0) {
    return linked.map((tag) => tag.label);
  }
  return legacyTags;
}

async function loadEntityIdsWithEntityTags(
  db: PrismaClient,
  entityType: TagBackfillEntityType,
  worldId?: string,
): Promise<Set<string>> {
  const rows = await db.entityTag.findMany({
    where: {
      entityType,
      ...(worldId ? { worldId } : {}),
    },
    select: { entityId: true },
    distinct: ["entityId"],
  });
  return new Set(rows.map((row) => row.entityId));
}

function mergeTagInventories(
  primary: TagInventoryEntry[],
  secondary: TagInventoryEntry[],
): TagInventoryEntry[] {
  const map = new Map<string, TagInventoryEntry>();

  for (const entry of [...primary, ...secondary]) {
    const existing = map.get(entry.tag);
    if (!existing) {
      map.set(entry.tag, {
        ...entry,
        references: [...entry.references],
      });
      continue;
    }

    for (const ref of entry.references) {
      const duplicate = existing.references.some(
        (candidate) => candidate.entityType === ref.entityType && candidate.entityId === ref.entityId,
      );
      if (duplicate) {
        continue;
      }
      existing.references.push(ref);
      existing.count++;
      if (true) {
        existing.onlyOnDrafts = false;
      }
      if (ref.visibility !== "dm_only") {
        existing.onlyDmOnly = false;
      }
    }
  }

  return [...map.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "de"));
}

async function collectJsonGapTagInventory(
  db: PrismaClient,
  brainDb: BrainPrismaClient,
  options: { worldId?: string } = {},
): Promise<TagInventoryEntry[]> {
  const worldId = options.worldId;
  const map = new Map<string, TagInventoryEntry>();

  const addRef = (tag: string, ref: TagReference) => {
    const normalizedKey = normalizeTagKey(tag);
    let entry = map.get(tag);
    if (!entry) {
      entry = {
        tag,
        normalizedKey,
        count: 0,
        references: [],
        onlyOnDrafts: true,
        onlyDmOnly: true,
      };
      map.set(tag, entry);
    }
    entry.count++;
    entry.references.push(ref);
    if (true) {
      entry.onlyOnDrafts = false;
    }
    if (ref.visibility !== "dm_only") {
      entry.onlyDmOnly = false;
    }
  };

  for (const entityType of TAG_BACKFILL_ENTITY_TYPES) {
    const taggedEntityIds = await loadEntityIdsWithEntityTags(db, entityType, worldId);
    const rows = await loadJsonTagEntities(db, brainDb, entityType, worldId);

    for (const row of rows) {
      if (taggedEntityIds.has(row.id)) {
        continue;
      }
      for (const tag of parseStringArray(row.tags)) {
        addRef(tag, {
          entityType,
          entityId: row.id,
          title: row.title,
          worldId: row.worldId,
          visibility: row.visibility ?? null,
        });
      }
    }
  }

  return [...map.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "de"));
}

async function mergeMetadataEntityTags(
  db: PrismaClient,
  brainDb: BrainPrismaClient,
  entityType: Extract<
    TagBackfillEntityType,
    "capture" | "project" | "workshop" | "contract" | "hardware" | "dev_idea"
  >,
  options: {
    worldId?: string;
    fromKeys: Set<string>;
    toTag: string;
  },
): Promise<number> {
  let updatedEntities = 0;
  const skipJsonWrite = isEntityTagsPrimaryMode();

  if (entityType === "capture") {
    const rows = await brainDb.captureEntry.findMany({
      where: options.worldId ? { worldId: options.worldId } : undefined,
      select: { id: true, metadata: true, worldId: true },
    });
    for (const row of rows) {
      const metadata = asMetadataRecord(row.metadata);
      const tags = await resolveEntityTagsForMerge(
        db,
        "capture",
        row.id,
        parseStringArray(metadata.tags),
      );
      const next = replaceTagsByNormalizedKeys(tags, options.fromKeys, options.toTag);
      if (!next) continue;
      if (!skipJsonWrite) {
        await brainDb.captureEntry.update({
          where: { id: row.id },
          data: { metadata: toPrismaJsonValue({ ...metadata, tags: next }) },
        });
      }
      await syncEntityTagsForJsonEntity(db, "capture", row.id, next, row.worldId);
      updatedEntities++;
    }
    return updatedEntities;
  }

  if (entityType === "project") {
    const rows = await brainDb.personalProject.findMany({
      where: options.worldId ? { worldId: options.worldId } : undefined,
      select: { id: true, metadata: true, worldId: true },
    });
    for (const row of rows) {
      const metadata = asMetadataRecord(row.metadata);
      const tags = await resolveEntityTagsForMerge(
        db,
        "project",
        row.id,
        parseStringArray(metadata.tags),
      );
      const next = replaceTagsByNormalizedKeys(tags, options.fromKeys, options.toTag);
      if (!next) continue;
      if (!skipJsonWrite) {
        await brainDb.personalProject.update({
          where: { id: row.id },
          data: { metadata: toPrismaJsonValue({ ...metadata, tags: next }) },
        });
      }
      await syncEntityTagsForJsonEntity(db, "project", row.id, next, row.worldId);
      updatedEntities++;
    }
    return updatedEntities;
  }

  if (entityType === "workshop") {
    const rows = await brainDb.workshopProject.findMany({
      where: options.worldId ? { worldId: options.worldId } : undefined,
      select: { id: true, metadata: true, worldId: true },
    });
    for (const row of rows) {
      const metadata = asMetadataRecord(row.metadata);
      const tags = await resolveEntityTagsForMerge(
        db,
        "workshop",
        row.id,
        parseStringArray(metadata.tags),
      );
      const next = replaceTagsByNormalizedKeys(tags, options.fromKeys, options.toTag);
      if (!next) continue;
      if (!skipJsonWrite) {
        await brainDb.workshopProject.update({
          where: { id: row.id },
          data: { metadata: toPrismaJsonValue({ ...metadata, tags: next }) },
        });
      }
      await syncEntityTagsForJsonEntity(db, "workshop", row.id, next, row.worldId);
      updatedEntities++;
    }
    return updatedEntities;
  }

  if (entityType === "contract") {
    const rows = await brainDb.contractExpense.findMany({
      select: { id: true, metadata: true },
    });
    for (const row of rows) {
      const metadata = asMetadataRecord(row.metadata);
      const tags = await resolveEntityTagsForMerge(
        db,
        "contract",
        row.id,
        parseStringArray(metadata.tags),
      );
      const next = replaceTagsByNormalizedKeys(tags, options.fromKeys, options.toTag);
      if (!next) continue;
      if (!skipJsonWrite) {
        await brainDb.contractExpense.update({
          where: { id: row.id },
          data: { metadata: toPrismaJsonValue({ ...metadata, tags: next }) },
        });
      }
      await syncEntityTagsForJsonEntity(db, "contract", row.id, next, null);
      updatedEntities++;
    }
    return updatedEntities;
  }

  if (entityType === "hardware") {
    const rows = await brainDb.hardwareDevice.findMany({
      select: { id: true, metadata: true },
    });
    for (const row of rows) {
      const metadata = asMetadataRecord(row.metadata);
      const tags = await resolveEntityTagsForMerge(
        db,
        "hardware",
        row.id,
        parseStringArray(metadata.tags),
      );
      const next = replaceTagsByNormalizedKeys(tags, options.fromKeys, options.toTag);
      if (!next) continue;
      if (!skipJsonWrite) {
        await brainDb.hardwareDevice.update({
          where: { id: row.id },
          data: { metadata: toPrismaJsonValue({ ...metadata, tags: next }) },
        });
      }
      await syncEntityTagsForJsonEntity(db, "hardware", row.id, next, null);
      updatedEntities++;
    }
    return updatedEntities;
  }

  const rows = await db.devIdea.findMany({
    select: { id: true, metadata: true },
  });
  for (const row of rows) {
    const metadata = asMetadataRecord(row.metadata);
    const tags = await resolveEntityTagsForMerge(
      db,
      "dev_idea",
      row.id,
      parseStringArray(metadata.tags),
    );
    const next = replaceTagsByNormalizedKeys(tags, options.fromKeys, options.toTag);
    if (!next) continue;
    if (!skipJsonWrite) {
      await db.devIdea.update({
        where: { id: row.id },
        data: { metadata: toPrismaJsonValue({ ...metadata, tags: next }) },
      });
    }
    await syncEntityTagsForJsonEntity(db, "dev_idea", row.id, next, null);
    updatedEntities++;
  }

  return updatedEntities;
}

async function collectEntityTagInventory(
  db: PrismaClient,
  brainDb: BrainPrismaClient,
  options: { worldId?: string } = {},
): Promise<TagInventoryEntry[]> {
  const worldId = options.worldId;
  const links = await db.entityTag.findMany({
    where: worldId ? { worldId } : undefined,
    include: { tag: true },
  });

  const map = new Map<string, TagInventoryEntry>();
  const entityMeta = new Map<string, JsonTagEntityRow>();

  for (const entityType of TAG_BACKFILL_ENTITY_TYPES) {
    for (const row of await loadJsonTagEntities(db, brainDb, entityType, worldId)) {
      entityMeta.set(`${entityType}:${row.id}`, row);
    }
  }

  const addRef = (tagLabel: string, ref: TagReference) => {
    const key = tagLabel;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        tag: key,
        normalizedKey: normalizeTagKey(tagLabel),
        count: 0,
        references: [],
        onlyOnDrafts: true,
        onlyDmOnly: true,
      };
      map.set(key, entry);
    }
    entry.count++;
    entry.references.push(ref);
    if (true) {
      entry.onlyOnDrafts = false;
    }
    if (ref.visibility !== "dm_only") {
      entry.onlyDmOnly = false;
    }
  };

  for (const link of links) {
    const meta = entityMeta.get(`${link.entityType}:${link.entityId}`);
    addRef(link.tag.label, {
      entityType: link.entityType as TagEntityType,
      entityId: link.entityId,
      title: meta?.title ?? link.entityId,
      worldId: link.worldId,
      visibility: meta?.visibility ?? null,
    });
  }

  return [...map.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "de"));
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
  brainDb: BrainPrismaClient,
  options: { worldId?: string } = {},
): Promise<TagInventoryEntry[]> {
  const [entityInventory, jsonGapInventory] = await Promise.all([
    collectEntityTagInventory(db, brainDb, options),
    collectJsonGapTagInventory(db, brainDb, options),
  ]);
  return mergeTagInventories(entityInventory, jsonGapInventory);
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
  brainDb: BrainPrismaClient,
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
    select: { id: true, tags: true, worldId: true },
  });
  for (const page of pages) {
    const tags = await resolveEntityTagsForMerge(db, "page", page.id, parseStringArray(page.tags));
    const next = replaceTagsByNormalizedKeys(tags, fromKeys, toTag);
    if (next) {
      if (!isEntityTagsPrimaryMode()) {
        await db.page.update({ where: { id: page.id }, data: { tags: toPrismaJsonValue(next) } });
      }
      await syncEntityTagsForJsonEntity(db, "page", page.id, next, page.worldId);
      updatedEntities++;
    }
  }

  const assets = await db.asset.findMany({
    where: options.worldId ? { worldId: options.worldId } : undefined,
    select: { id: true, tags: true, worldId: true },
  });
  for (const asset of assets) {
    const tags = await resolveEntityTagsForMerge(db, "asset", asset.id, parseStringArray(asset.tags));
    const next = replaceTagsByNormalizedKeys(tags, fromKeys, toTag);
    if (next) {
      if (!isEntityTagsPrimaryMode()) {
        await db.asset.update({ where: { id: asset.id }, data: { tags: toPrismaJsonValue(next) } });
      }
      await syncEntityTagsForJsonEntity(db, "asset", asset.id, next, asset.worldId);
      updatedEntities++;
    }
  }

  const buttons = await db.soundboardButton.findMany({
    where: options.worldId ? { worldId: options.worldId } : undefined,
    select: { id: true, tags: true, worldId: true },
  });
  for (const button of buttons) {
    const tags = await resolveEntityTagsForMerge(
      db,
      "soundboard_button",
      button.id,
      parseStringArray(button.tags),
    );
    const next = replaceTagsByNormalizedKeys(tags, fromKeys, toTag);
    if (next) {
      if (!isEntityTagsPrimaryMode()) {
        await db.soundboardButton.update({
          where: { id: button.id },
          data: { tags: toPrismaJsonValue(next) },
        });
      }
      await syncEntityTagsForJsonEntity(db, "soundboard_button", button.id, next, button.worldId);
      updatedEntities++;
    }
  }

  const brainDocs = await brainDb.personalBrainDocument.findMany({ select: { id: true, tags: true } });
  for (const doc of brainDocs) {
    const tags = await resolveEntityTagsForMerge(
      db,
      "personal_brain_document",
      doc.id,
      parseStringArray(doc.tags),
    );
    const next = replaceTagsByNormalizedKeys(tags, fromKeys, toTag);
    if (next) {
      if (!isEntityTagsPrimaryMode()) {
        await brainDb.personalBrainDocument.update({
          where: { id: doc.id },
          data: { tags: toPrismaJsonValue(next) },
        });
      }
      await syncEntityTagsForJsonEntity(db, "personal_brain_document", doc.id, next, null);
      updatedEntities++;
    }
  }

  const brainFacts = await brainDb.personalBrainFact.findMany({ select: { id: true, tags: true } });
  for (const fact of brainFacts) {
    const tags = await resolveEntityTagsForMerge(
      db,
      "personal_brain_fact",
      fact.id,
      parseStringArray(fact.tags),
    );
    const next = replaceTagsByNormalizedKeys(tags, fromKeys, toTag);
    if (next) {
      if (!isEntityTagsPrimaryMode()) {
        await brainDb.personalBrainFact.update({
          where: { id: fact.id },
          data: { tags: toPrismaJsonValue(next) },
        });
      }
      await syncEntityTagsForJsonEntity(db, "personal_brain_fact", fact.id, next, null);
      updatedEntities++;
    }
  }

  const metadataEntityTypes = [
    "capture",
    "project",
    "workshop",
    "contract",
    "hardware",
    "dev_idea",
  ] as const;
  for (const entityType of metadataEntityTypes) {
    updatedEntities += await mergeMetadataEntityTags(db, brainDb, entityType, {
      worldId: options.worldId,
      fromKeys,
      toTag,
    });
  }

  return {
    mergedFrom: options.fromTags.filter((tag) => shouldReplace(tag)),
    toTag,
    updatedEntities,
  };
}

export async function backfillEntityTagsFromJson(
  db: PrismaClient,
  brainDb: BrainPrismaClient,
  options: { worldId?: string; dryRun?: boolean } = {},
): Promise<BackfillEntityTagsResult> {
  const entityTags = createEntityTagService(db);
  const result: BackfillEntityTagsResult = {
    tagsUpserted: 0,
    entityTagsCreated: 0,
    entityTagsSkipped: 0,
    entitiesProcessed: 0,
  };

  for (const entityType of TAG_BACKFILL_ENTITY_TYPES) {
    const rows = await loadJsonTagEntities(db, brainDb, entityType, options.worldId);
    for (const row of rows) {
      const tags = parseStringArray(row.tags);
      if (tags.length === 0) continue;

      result.entitiesProcessed++;
      if (options.dryRun) {
        result.tagsUpserted += tags.length;
        result.entityTagsCreated += tags.length;
        continue;
      }

      for (const tag of tags) {
        await entityTags.upsertTag({ key: tag, label: tag });
        result.tagsUpserted++;
      }

      const existing = await db.entityTag.findMany({
        where: { entityType, entityId: row.id },
        select: { id: true },
      });
      const existingCount = existing.length;

      await syncEntityTagsForJsonEntity(db, entityType, row.id, tags, row.worldId ?? null);

      const afterCount = tags.length;
      result.entityTagsCreated += Math.max(0, afterCount - existingCount);
      result.entityTagsSkipped += existingCount;
    }
  }

  return result;
}

/**
 * Verify EntityTag backfill completeness against the legacy Json tag arrays.
 *
 * Compares every legacy Json tag (normalized via `normalizeTagKey`) with the
 * EntityTag rows of the same entity and reports each entity whose Json tags
 * are not fully represented in EntityTag. Direction is Json -> EntityTag only:
 * additional EntityTag rows (e.g. created after merges) are fine.
 *
 * Matching is done per entityType + entityId (worldId intentionally not
 * matched — completeness means "the link row exists").
 */
export async function verifyTagBackfill(
  db: PrismaClient,
  brainDb: BrainPrismaClient,
  options: { worldId?: string } = {},
): Promise<TagBackfillVerificationResult> {
  const types: TagBackfillVerificationTypeResult[] = [];
  let totalEntitiesWithJsonTags = 0;
  let totalEntitiesMissing = 0;
  let totalMissingLinks = 0;

  for (const entityType of TAG_BACKFILL_ENTITY_TYPES) {
    const rows = await loadJsonTagEntities(db, brainDb, entityType, options.worldId);
    const links = await db.entityTag.findMany({
      where: { entityType },
      select: { entityId: true, tag: { select: { key: true } } },
    });

    const linkedKeysByEntity = new Map<string, Set<string>>();
    for (const link of links) {
      let keys = linkedKeysByEntity.get(link.entityId);
      if (!keys) {
        keys = new Set<string>();
        linkedKeysByEntity.set(link.entityId, keys);
      }
      keys.add(link.tag.key);
    }

    const typeResult: TagBackfillVerificationTypeResult = {
      entityType,
      entitiesWithJsonTags: 0,
      entitiesFullyCovered: 0,
      missing: [],
    };

    for (const row of rows) {
      const jsonKeys = [
        ...new Set(parseStringArray(row.tags).map(normalizeTagKey).filter(Boolean)),
      ];
      if (jsonKeys.length === 0) continue;

      typeResult.entitiesWithJsonTags++;
      const linkedKeys = linkedKeysByEntity.get(row.id);
      const missingTagKeys = jsonKeys.filter((key) => !linkedKeys?.has(key));
      if (missingTagKeys.length === 0) {
        typeResult.entitiesFullyCovered++;
        continue;
      }

      typeResult.missing.push({
        entityId: row.id,
        title: row.title,
        worldId: row.worldId ?? null,
        missingTagKeys,
      });
      totalMissingLinks += missingTagKeys.length;
    }

    totalEntitiesWithJsonTags += typeResult.entitiesWithJsonTags;
    totalEntitiesMissing += typeResult.missing.length;
    types.push(typeResult);
  }

  return {
    ok: totalMissingLinks === 0,
    totalEntitiesWithJsonTags,
    totalEntitiesMissing,
    totalMissingLinks,
    types,
  };
}

export async function getTagCoverageStats(
  db: PrismaClient,
  brainDb: BrainPrismaClient,
  options: { worldId?: string } = {},
): Promise<TagCoverageStats> {
  const types: TagCoverageTypeStats[] = [];

  for (const entityType of TAG_BACKFILL_ENTITY_TYPES) {
    const rows = await loadJsonTagEntities(db, brainDb, entityType, options.worldId);
    const entityIds = rows.map((row) => row.id);
    const jsonTagged = rows.filter((row) => parseStringArray(row.tags).length > 0).length;

    let entityTagTagged = 0;
    if (entityIds.length > 0) {
      const taggedIds = await db.entityTag.findMany({
        where: {
          entityType,
          entityId: { in: entityIds },
        },
        select: { entityId: true },
        distinct: ["entityId"],
      });
      entityTagTagged = taggedIds.length;
    }

    types.push({
      entityType,
      totalEntities: rows.length,
      jsonTagged,
      entityTagTagged,
    });
  }

  const [totalTags, totalEntityTags] = await Promise.all([
    db.tag.count(),
    db.entityTag.count({
      where: options.worldId ? { worldId: options.worldId } : undefined,
    }),
  ]);

  return { types, totalTags, totalEntityTags };
}

export function createTagService(brainDb: BrainPrismaClient, db: PrismaClient) {
  return {
    collectInventory: (options?: { worldId?: string }) => collectTagInventory(db, brainDb, options),
    findSimilarGroups: findSimilarTagGroups,
    findUnused: findUnusedTags,
    suggestMerges: suggestTagMerges,
    merge: (options: { worldId?: string; fromTags: string[]; toTag: string }) =>
      mergeTags(db, brainDb, options),
    backfillFromJson: (options?: { worldId?: string; dryRun?: boolean }) =>
      backfillEntityTagsFromJson(db, brainDb, options),
    verifyBackfill: (options?: { worldId?: string }) => verifyTagBackfill(db, brainDb, options),
    getCoverageStats: (options?: { worldId?: string }) => getTagCoverageStats(db, brainDb, options),
    normalizeKey: normalizeTagKey,
    canonicalize: canonicalizeTag,
  };
}
