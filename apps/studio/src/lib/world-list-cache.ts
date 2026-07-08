import { unstable_cache, revalidateTag } from "next/cache";
import {
  WORLD_LIST_CACHE_TAG,
  loadStudioWorldList,
  type StudioWorldListItem,
} from "./world-list";

/**
 * Cross-request cached studio world list.
 *
 * The list of worlds changes only when a world is created, and it is the same
 * for every studio user (single-DM studio), so it is a safe, surgical target
 * for `unstable_cache`: rarely-changing and not viewer-specific. Auth-gated
 * dynamic pages are deliberately NOT cached this way.
 */
export const getStudioWorldList: () => Promise<StudioWorldListItem[]> =
  unstable_cache(loadStudioWorldList, [WORLD_LIST_CACHE_TAG], {
    tags: [WORLD_LIST_CACHE_TAG],
  });

/** Invalidate the cached world list after a world is created. */
export function revalidateStudioWorldList(): void {
  revalidateTag(WORLD_LIST_CACHE_TAG);
}
