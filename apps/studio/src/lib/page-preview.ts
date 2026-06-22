import { buildPageUrl, type PageType } from "@uwe/database/server";

export function pagePreviewHref(worldSlug: string, type: PageType, slug: string) {
  return `${buildPageUrl(worldSlug, type, slug)}?preview=player`;
}
