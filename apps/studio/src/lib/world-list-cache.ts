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

/**
 * Invalidate the cached world list after a world is created.
 *
 * Next 16 macht das zweite Argument zur Pflicht. `"max"` ist der von Next
 * genannte Ersatz fuer den alten Ein-Argument-Aufruf; `updateTag` waere die
 * andere Variante, laesst sich hier aber nicht nutzen — der einzige Aufrufer
 * ist der Route Handler unter app/api/worlds, und `updateTag` wirft dort.
 */
export function revalidateStudioWorldList(): void {
  revalidateTag(WORLD_LIST_CACHE_TAG, "max");
}
