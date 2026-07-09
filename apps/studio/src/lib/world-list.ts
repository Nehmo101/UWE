import { getAppRepository } from "@uwe/database/server";
import type { UweRepository } from "@uwe/database/server";

/**
 * Cache tag for the studio world list. Any mutation that changes which worlds
 * exist (creating a world) must call `revalidateStudioWorldList()` so the
 * cross-request cache in `world-list-cache.ts` is invalidated.
 */
export const WORLD_LIST_CACHE_TAG = "studio:world-list";

/**
 * The serialization-safe projection of a world used by the studio world list.
 * Only plain scalars (no Date fields) so it round-trips cleanly through
 * `unstable_cache`.
 */
export interface StudioWorldListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSandbox: boolean;
  /** ISO-8601 — serialization-safe for `unstable_cache`. */
  updatedAt: string;
}

type WorldRow = Awaited<ReturnType<UweRepository["listWorlds"]>>[number];

export function projectStudioWorld(world: WorldRow): StudioWorldListItem {
  return {
    id: world.id,
    name: world.name,
    slug: world.slug,
    description: world.description,
    isSandbox: world.isSandbox,
    updatedAt: world.updatedAt.toISOString(),
  };
}

/**
 * Uncached source of the studio world list. Kept free of `next/cache` so it is
 * unit-testable without the Next runtime; `world-list-cache.ts` wraps it.
 */
export async function loadStudioWorldList(
  repo: UweRepository = getAppRepository(),
): Promise<StudioWorldListItem[]> {
  const worlds = await repo.listWorlds();
  return worlds
    .map(projectStudioWorld)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
