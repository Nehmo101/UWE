import { revalidatePath } from "next/cache";
import { worldWikiPath } from "./world-last-route";

/** Root redirect + wiki listing — use when both may be stale. */
export function revalidateWorldRootAndWiki(worldSlug: string): void {
  revalidatePath(`/worlds/${worldSlug}`);
  revalidatePath(worldWikiPath(worldSlug));
}
