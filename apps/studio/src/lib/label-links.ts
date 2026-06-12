export type LabelSourceType =
  | "page"
  | "dungeon_room"
  | "content_block"
  | "asset"
  | "manual";

export function labelSourceRef(sourceType: LabelSourceType, sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}

export function labelNewHref(
  worldSlug: string,
  sourceType: LabelSourceType,
  sourceId: string,
  options?: { includeDmOnly?: boolean },
): string {
  const params = new URLSearchParams({
    sourceRef: labelSourceRef(sourceType, sourceId),
  });
  if (options?.includeDmOnly) {
    params.set("includeDmOnly", "1");
  }
  return `/worlds/${worldSlug}/labels/new?${params.toString()}`;
}

export function pageLabelSourceRef(pageType: string, pageId: string): string {
  return labelSourceRef(pageType === "room" ? "dungeon_room" : "page", pageId);
}

export function pageLabelNewHref(
  worldSlug: string,
  pageType: string,
  pageId: string,
  options?: { includeDmOnly?: boolean },
): string {
  const sourceType = pageType === "room" ? "dungeon_room" : "page";
  return labelNewHref(worldSlug, sourceType, pageId, options);
}
