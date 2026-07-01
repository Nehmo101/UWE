import type { PrismaClient } from "./client";
import { parseStringArray } from "./json-utils";
import { loadEntityTagsByEntityIds } from "./entity-tag-search-service";

export interface StudioMediaSearchResult {
  id: string;
  entityType: "asset" | "soundboard_button";
  title: string;
  snippet: string | null;
  href: string;
  worldSlug: string;
  worldName: string;
  score: number;
}

export interface StudioMediaSearchOptions {
  query: string;
  worldSlug?: string;
  limit?: number;
}

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase("de");
}

function scoreMatch(text: string | null | undefined, query: string): number {
  if (!text) return 0;
  const lower = text.toLocaleLowerCase("de");
  if (lower === query) return 100;
  if (lower.startsWith(query)) return 80;
  if (lower.includes(query)) return 50;
  return 0;
}

function bestScore(fields: Array<string | null | undefined>, query: string): number {
  return fields.reduce((max, field) => Math.max(max, scoreMatch(field, query)), 0);
}

function snippetFrom(text: string | null | undefined, query: string, maxLength = 120): string | null {
  if (!text?.trim()) return null;
  const lower = text.toLocaleLowerCase("de");
  const index = lower.indexOf(query);
  if (index < 0) {
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
  }
  const start = Math.max(0, index - 30);
  const excerpt = text.slice(start, start + maxLength);
  return start > 0 ? `…${excerpt}` : excerpt;
}

export async function searchStudioMedia(
  db: PrismaClient,
  options: StudioMediaSearchOptions,
): Promise<StudioMediaSearchResult[]> {
  const query = normalizeQuery(options.query);
  if (query.length < 2) {
    return [];
  }

  const limit = Math.min(Math.max(options.limit ?? 24, 1), 50);
  const perTypeLimit = Math.max(limit, 12);
  const results: StudioMediaSearchResult[] = [];

  const assets = await db.asset.findMany({
    where: {
      ...(options.worldSlug ? { world: { slug: options.worldSlug } } : {}),
      OR: [
        { title: { contains: query } },
        { description: { contains: query } },
        { storageKey: { contains: query } },
      ],
    },
    include: { world: { select: { slug: true, name: true } } },
    orderBy: [{ updatedAt: "desc" }],
    take: perTypeLimit,
  });

  const assetIds = assets.map((asset) => asset.id);
  const assetTags = await loadEntityTagsByEntityIds(db, "asset", assetIds);

  for (const asset of assets) {
    const jsonTags = parseStringArray(asset.tags);
    const entityTags = assetTags.get(asset.id) ?? [];
    const score = bestScore(
      [asset.title, asset.description, asset.storageKey, ...jsonTags, ...entityTags],
      query,
    );
    if (score <= 0) continue;
    results.push({
      id: asset.id,
      entityType: "asset",
      title: asset.title,
      snippet: snippetFrom(asset.description || asset.storageKey, query),
      href: `/worlds/${asset.world.slug}/assets`,
      worldSlug: asset.world.slug,
      worldName: asset.world.name,
      score,
    });
  }

  const buttons = await db.soundboardButton.findMany({
    where: {
      ...(options.worldSlug ? { world: { slug: options.worldSlug } } : {}),
      OR: [{ title: { contains: query } }, { sourceUrl: { contains: query } }],
    },
    include: { world: { select: { slug: true, name: true } } },
    orderBy: [{ sortOrder: "asc" }],
    take: perTypeLimit,
  });

  const buttonIds = buttons.map((button) => button.id);
  const buttonTags = await loadEntityTagsByEntityIds(db, "soundboard_button", buttonIds);

  for (const button of buttons) {
    const jsonTags = parseStringArray(button.tags);
    const entityTags = buttonTags.get(button.id) ?? [];
    const score = bestScore([button.title, button.sourceUrl, ...jsonTags, ...entityTags], query);
    if (score <= 0) continue;
    results.push({
      id: button.id,
      entityType: "soundboard_button",
      title: button.title,
      snippet: snippetFrom(button.sourceUrl, query),
      href: `/worlds/${button.world.slug}/soundboard`,
      worldSlug: button.world.slug,
      worldName: button.world.name,
      score,
    });
  }

  return results
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, "de"))
    .slice(0, limit);
}
