import type { PrismaClient } from "./client";
import type { BrainPrismaClient } from "./brain-client";
import type { EntityTagEntityType, PageType } from "./generated/prisma/client";
import { buildPageUrl } from "./page-types";
import { ENTITY_TAG_ENTITY_TYPE_LABELS, normalizeTagKey } from "./tag-service";
// Die Family-Modelle (Vertraege, Dokumente, Kueche, Haushalt, Kalender,
// Scan-Eingang) liegen seit Abschnitt G in uwe-family.db. Der Singleton statt
// eines weiteren Konstruktor-Parameters: sonst muesste jede Aufrufstelle im
// Repo einen dritten Client durchreichen.
import { familyPrisma } from "./family-client";

export interface EntityTagSearchResult {
  id: string;
  entityType: EntityTagEntityType;
  title: string;
  matchedTags: string[];
  href: string;
  group: string;
  worldSlug?: string | null;
  worldName?: string | null;
  score: number;
}

export interface EntityTagSearchOptions {
  query: string;
  worldId?: string;
  entityTypes?: EntityTagEntityType[];
  limit?: number;
}

interface EntitySummary {
  title: string;
  worldSlug?: string | null;
  worldName?: string | null;
  pageSlug?: string | null;
  pageType?: PageType | null;
}

function studioHrefForEntityType(
  entityType: EntityTagEntityType,
  entityId: string,
  summary: EntitySummary,
): string {
  switch (entityType) {
    case "page":
      if (summary.worldSlug && summary.pageSlug && summary.pageType) {
        return buildPageUrl(summary.worldSlug, summary.pageType, summary.pageSlug);
      }
      return summary.worldSlug ? `/worlds/${summary.worldSlug}` : "/search";
    case "asset":
      return summary.worldSlug ? `/worlds/${summary.worldSlug}/assets` : "/search";
    case "soundboard_button":
      return summary.worldSlug ? `/worlds/${summary.worldSlug}/soundboard` : "/search";
    case "capture":
      return `/capture/${entityId}`;
    case "project":
      return `/projects/${entityId}`;
    case "workshop":
      return `/workshop/${entityId}`;
    case "contract":
      return "/contracts";
    case "hardware":
      return "/hardware";
    case "dev_idea":
      return `/ideas?idea=${entityId}`;
    case "personal_brain_document":
      return `/life-brain/documents/${entityId}`;
    case "personal_brain_fact":
      return `/life-brain/facts/${entityId}`;
    default:
      return "/search";
  }
}

function groupForEntityType(entityType: EntityTagEntityType): string {
  switch (entityType) {
    case "page":
    case "asset":
    case "soundboard_button":
      return "Welten · Tags";
    case "capture":
      return "Persönlich · Capture";
    case "project":
      return "Persönlich · Projekte";
    case "workshop":
      return "Persönlich · Werkstatt";
    case "contract":
      return "Persönlich · Verträge";
    case "hardware":
      return "Persönlich · Hardware";
    case "dev_idea":
      return "Persönlich · Dev-Ideen";
    case "personal_brain_document":
    case "personal_brain_fact":
      return "Persönlich · Life Brain";
    default:
      return ENTITY_TAG_ENTITY_TYPE_LABELS[entityType] ?? entityType;
  }
}

async function loadEntitySummaries(
  db: PrismaClient,
  brainDb: BrainPrismaClient,
  entityType: EntityTagEntityType,
  entityIds: string[],
): Promise<Map<string, EntitySummary>> {
  const map = new Map<string, EntitySummary>();
  if (entityIds.length === 0) return map;

  switch (entityType) {
    case "page": {
      const rows = await db.page.findMany({
        where: { id: { in: entityIds } },
        select: {
          id: true,
          title: true,
          slug: true,
          type: true,
          world: { select: { slug: true, name: true } },
        },
      });
      for (const row of rows) {
        map.set(row.id, {
          title: row.title,
          worldSlug: row.world.slug,
          worldName: row.world.name,
          pageSlug: row.slug,
          pageType: row.type,
        });
      }
      break;
    }
    case "asset": {
      const rows = await db.asset.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, title: true, world: { select: { slug: true, name: true } } },
      });
      for (const row of rows) {
        map.set(row.id, {
          title: row.title,
          worldSlug: row.world.slug,
          worldName: row.world.name,
        });
      }
      break;
    }
    case "soundboard_button": {
      const rows = await db.soundboardButton.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, title: true, world: { select: { slug: true, name: true } } },
      });
      for (const row of rows) {
        map.set(row.id, {
          title: row.title,
          worldSlug: row.world.slug,
          worldName: row.world.name,
        });
      }
      break;
    }
    case "capture": {
      const rows = await brainDb.captureEntry.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, title: true },
      });
      for (const row of rows) {
        map.set(row.id, { title: row.title || "Capture" });
      }
      break;
    }
    case "project": {
      const rows = await brainDb.personalProject.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, name: true },
      });
      for (const row of rows) {
        map.set(row.id, { title: row.name });
      }
      break;
    }
    case "workshop": {
      const rows = await brainDb.workshopProject.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, title: true },
      });
      for (const row of rows) {
        map.set(row.id, { title: row.title });
      }
      break;
    }
    case "contract": {
      const rows = await familyPrisma.contractExpense.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, name: true },
      });
      for (const row of rows) {
        map.set(row.id, { title: row.name });
      }
      break;
    }
    case "hardware": {
      const rows = await brainDb.hardwareDevice.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, name: true },
      });
      for (const row of rows) {
        map.set(row.id, { title: row.name });
      }
      break;
    }
    case "dev_idea": {
      const rows = await db.devIdea.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, title: true },
      });
      for (const row of rows) {
        map.set(row.id, { title: row.title });
      }
      break;
    }
    case "personal_brain_document": {
      const rows = await brainDb.personalBrainDocument.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, title: true },
      });
      for (const row of rows) {
        map.set(row.id, { title: row.title });
      }
      break;
    }
    case "personal_brain_fact": {
      const rows = await brainDb.personalBrainFact.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, title: true },
      });
      for (const row of rows) {
        map.set(row.id, { title: row.title });
      }
      break;
    }
  }

  return map;
}

export async function searchEntitiesByTagQuery(
  db: PrismaClient,
  brainDb: BrainPrismaClient,
  options: EntityTagSearchOptions,
): Promise<EntityTagSearchResult[]> {
  const query = options.query.trim().toLocaleLowerCase("de");
  if (query.length < 2) {
    return [];
  }

  const normalized = normalizeTagKey(query);
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);

  const tags = await db.tag.findMany({
    where: {
      OR: [
        { label: { contains: query } },
        ...(normalized ? [{ key: { contains: normalized } }] : []),
      ],
    },
    take: 40,
    orderBy: { label: "asc" },
  });

  if (tags.length === 0) {
    return [];
  }

  const tagIds = tags.map((tag) => tag.id);
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));

  const links = await db.entityTag.findMany({
    where: {
      tagId: { in: tagIds },
      ...(options.worldId ? { worldId: options.worldId } : {}),
      ...(options.entityTypes?.length ? { entityType: { in: options.entityTypes } } : {}),
    },
    orderBy: [{ entityType: "asc" }, { entityId: "asc" }],
    take: limit * 3,
  });

  const grouped = new Map<
    string,
    { entityType: EntityTagEntityType; entityId: string; matchedTags: string[]; worldId: string | null }
  >();

  for (const link of links) {
    const tag = tagById.get(link.tagId);
    if (!tag) continue;
    const key = `${link.entityType}:${link.entityId}`;
    const entry = grouped.get(key) ?? {
      entityType: link.entityType,
      entityId: link.entityId,
      matchedTags: [],
      worldId: link.worldId,
    };
    if (!entry.matchedTags.includes(tag.label)) {
      entry.matchedTags.push(tag.label);
    }
    grouped.set(key, entry);
  }

  const byType = new Map<EntityTagEntityType, string[]>();
  for (const entry of grouped.values()) {
    const ids = byType.get(entry.entityType) ?? [];
    ids.push(entry.entityId);
    byType.set(entry.entityType, ids);
  }

  const summaries = new Map<string, EntitySummary>();
  for (const [entityType, entityIds] of byType.entries()) {
    const loaded = await loadEntitySummaries(db, brainDb, entityType, [...new Set(entityIds)]);
    for (const [entityId, summary] of loaded.entries()) {
      summaries.set(`${entityType}:${entityId}`, summary);
    }
  }

  const results: EntityTagSearchResult[] = [];
  for (const entry of grouped.values()) {
    const summary = summaries.get(`${entry.entityType}:${entry.entityId}`);
    if (!summary) continue;

    results.push({
      id: entry.entityId,
      entityType: entry.entityType,
      title: summary.title,
      matchedTags: entry.matchedTags.sort((a, b) => a.localeCompare(b, "de")),
      href: studioHrefForEntityType(entry.entityType, entry.entityId, summary),
      group: groupForEntityType(entry.entityType),
      worldSlug: summary.worldSlug,
      worldName: summary.worldName,
      score: 85,
    });
  }

  return results
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, "de"))
    .slice(0, limit);
}

export async function loadEntityTagsByEntityIds(
  db: PrismaClient,
  entityType: EntityTagEntityType,
  entityIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (entityIds.length === 0) return map;

  const links = await db.entityTag.findMany({
    where: { entityType, entityId: { in: entityIds } },
    include: { tag: true },
    orderBy: { tag: { label: "asc" } },
  });

  for (const link of links) {
    const list = map.get(link.entityId) ?? [];
    list.push(link.tag.label);
    map.set(link.entityId, list);
  }

  return map;
}
