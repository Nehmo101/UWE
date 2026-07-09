import { revalidatePath } from "next/cache";
import { worldWikiPath } from "./world-last-route";

/** Invalidate the wiki listing after page/list mutations (#741). */
export function revalidateWorldWiki(worldSlug: string): void {
  revalidatePath(worldWikiPath(worldSlug));
}

/** Root redirect + wiki listing — use when both may be stale. */
export function revalidateWorldRootAndWiki(worldSlug: string): void {
  revalidatePath(`/worlds/${worldSlug}`);
  revalidatePath(worldWikiPath(worldSlug));
}
