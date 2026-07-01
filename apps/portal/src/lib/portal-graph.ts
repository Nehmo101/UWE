import type { GraphNode } from "@uwe/database/graph-types";

export function remapPortalGraphHrefs(worldSlug: string, nodes: GraphNode[]): GraphNode[] {
  return nodes.map((node) => ({
    ...node,
    href: `/auth/worlds/${worldSlug}/${node.slug}`,
  }));
}

export function portalGraphApiUrl(
  worldSlug: string,
  options?: { focusPageId?: string; mode?: string },
): string {
  const params = new URLSearchParams();
  if (options?.focusPageId) {
    params.set("focusPageId", options.focusPageId);
  }
  if (options?.mode) {
    params.set("mode", options.mode);
  }
  const query = params.toString();
  return `/api/worlds/${encodeURIComponent(worldSlug)}/graph${query ? `?${query}` : ""}`;
}
