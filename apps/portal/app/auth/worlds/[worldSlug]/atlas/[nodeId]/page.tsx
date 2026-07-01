import { notFound } from "next/navigation";
import {
  BreadcrumbTrail,
  PortalAuthChrome,
  PortalShell,
} from "@/src/components/shell";
import { getCurrentUser } from "@/src/lib/auth";
import { resolvePortalStudioOpenHref } from "@/src/lib/studio-link";
import { ADMIN_ACCESS_ROLES, hasAnyRole } from "@uwe/auth";
import {
  createAtlasService,
  createPrismaClient,
  isAtlasEntityAccessible,
  PORTAL_PAGE_VISIBILITIES,
} from "@uwe/database/server";
import { resolveStylePreset } from "@uwe/atlas/style-presets";
import { AtlasViewer } from "@/src/components/atlas/AtlasViewer";
import type { ViewerFeature, ViewerObject, NodeAncestorItem, PageLinkMap, PaletteItemMap } from "@/src/components/atlas/AtlasViewer";

interface Props {
  params: Promise<{ worldSlug: string; nodeId: string }>;
}

export default async function PortalAtlasNodePage({ params }: Props) {
  const { worldSlug, nodeId } = await params;
  const user = await getCurrentUser();
  const canAccessStudio = user ? hasAnyRole(user, ADMIN_ACCESS_ROLES) : false;
  const studioUrl = canAccessStudio ? resolvePortalStudioOpenHref() : null;

  const db = createPrismaClient();
  const atlas = createAtlasService(db);

  let worldName = worldSlug;
  let nodeTitle = "";
  let nodeLevel: string | undefined;
  let viewerFeatures: ViewerFeature[] = [];
  let viewerObjects: ViewerObject[] = [];
  let parentChainItems: NodeAncestorItem[] = [];
  let parentSilhouette: [number, number][][] | undefined;
  let mapStylePreset: string | null = null;
  const pageLinkMap: PageLinkMap = {};
  const paletteItems: PaletteItemMap = {};

  let keySeq = 0;
  function nextKey() { return `vk-${++keySeq}`; }

  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { name: true },
    });
    if (!world) notFound();
    worldName = world.name;

    // Fetch atlas with portal context — this filters dm_only nodes/features/objects
    const atlasData = await atlas.getAtlasForContext(worldSlug, "portal");
    if (!atlasData) notFound();

    // Verify the requested node exists and is portal-visible
    const nodeRecord = atlasData.nodes.find((n) => n.id === nodeId);
    if (!nodeRecord) notFound();

    nodeTitle = nodeRecord.title;
    nodeLevel = nodeRecord.level;

    // Get the atlas map style preset
    const map = await db.atlasMap.findUnique({ where: { id: nodeRecord.mapId } });
    mapStylePreset = map?.stylePreset ?? null;

    // Get hierarchy for breadcrumb + parent silhouette
    const hierarchy = await atlas.getNodeWithHierarchy(nodeId);
    if (!hierarchy) notFound();

    // Filter parent chain to only portal-visible ancestors
    const visibleNodeIds = new Set(atlasData.nodes.map((n) => n.id));
    parentChainItems = hierarchy.parentChain
      .filter((a) => visibleNodeIds.has(a.id))
      .map((a) => ({ id: a.id, title: a.title, level: a.level }));

    // Parent silhouette from parent feature geometry — only when the parent
    // feature is portal-visible, so dm_only parent geometry never leaks.
    if (
      hierarchy.parentFeature &&
      isAtlasEntityAccessible(hierarchy.parentFeature, "portal")
    ) {
      const geo = hierarchy.parentFeature.geometry as {
        type?: string;
        rings?: [number, number][][];
      } | null;
      if (geo?.type === "Polygon" && Array.isArray(geo.rings)) {
        parentSilhouette = geo.rings as [number, number][][];
      }
    }

    // Filter features and objects to those belonging to this node
    const rawFeatures = atlasData.features.filter((f) => f.nodeId === nodeId);
    const rawObjects = atlasData.objects.filter((o) => o.nodeId === nodeId);

    viewerFeatures = rawFeatures.map((f) => ({
      id: f.id,
      kind: f.kind as ViewerFeature["kind"],
      geometry: f.geometry as unknown as ViewerFeature["geometry"],
      style: f.style as Record<string, unknown> | undefined,
      labelText: f.labelText ?? null,
      labelColor: (f.labelColor as ViewerFeature["labelColor"]) ?? null,
      childNodeId: f.childNodeId ?? null,
      linkedPageId: f.linkedPageId ?? null,
      layer: f.layer,
      _key: nextKey(),
    }));

    viewerObjects = rawObjects.map((o) => ({
      id: o.id,
      paletteItemId: o.paletteItemId,
      x: o.x,
      y: o.y,
      scale: o.scale,
      rotation: o.rotation,
      layer: o.layer,
      linkedPageId: o.linkedPageId ?? null,
      _key: nextKey(),
    }));

    // Resolve the palette items referenced by the visible objects so the viewer
    // can render builtin glyphs (by builtinGlyphKey) and AI/upload image stamps.
    const paletteItemIds = [
      ...new Set(viewerObjects.map((o) => o.paletteItemId)),
    ];

    if (paletteItemIds.length > 0) {
      const items = await db.atlasPaletteItem.findMany({
        where: { id: { in: paletteItemIds } },
        select: {
          id: true,
          source: true,
          builtinGlyphKey: true,
          styleTags: true,
        },
      });
      for (const item of items) {
        const tags = (item.styleTags ?? {}) as {
          imageData?: string;
          mimeType?: string;
        };
        paletteItems[item.id] = {
          source: item.source,
          builtinGlyphKey: item.builtinGlyphKey ?? null,
          imageData: tags.imageData,
          mimeType: tags.mimeType,
        };
      }
    }

    // Resolve linkedPageIds → portal page slugs for wiki links
    const pageIds = [
      ...new Set([
        ...rawFeatures.map((f) => f.linkedPageId).filter(Boolean) as string[],
        ...rawObjects.map((o) => o.linkedPageId).filter(Boolean) as string[],
      ]),
    ];

    if (pageIds.length > 0) {
      const pages = await db.page.findMany({
        where: {
          id: { in: pageIds },
          visibility: { in: PORTAL_PAGE_VISIBILITIES },
          publishStatus: "published",
        },
        select: { id: true, slug: true },
      });
      for (const page of pages) {
        pageLinkMap[page.id] = page.slug;
      }
    }
  } finally {
    await db.$disconnect();
  }

  if (!nodeTitle) notFound();

  const preset = resolveStylePreset(mapStylePreset);

  // Build breadcrumb
  const breadcrumbItems = [
    { label: "Meine Welten", href: "/auth/worlds" },
    { label: worldName, href: `/auth/worlds/${worldSlug}` },
    { label: "Atlas", href: `/auth/worlds/${worldSlug}/atlas` },
    ...parentChainItems.map((item) => ({
      label: item.title,
      href: `/auth/worlds/${worldSlug}/atlas/${item.id}`,
    })),
    { label: nodeTitle },
  ];

  return (
    <PortalShell
      worldSlug={worldSlug}
      worldName={worldName}
      headerActions={
        <PortalAuthChrome
          user={user}
          canAccessStudio={canAccessStudio}
          studioUrl={studioUrl}
        />
      }
      breadcrumb={<BreadcrumbTrail items={breadcrumbItems} />}
    >
      <section className="portal-content-card">
        <a href={`/auth/worlds/${worldSlug}/atlas`} className="uwe-back-link">
          ← Zurück zum Atlas
        </a>

        <AtlasViewer
          worldSlug={worldSlug}
          nodeId={nodeId}
          nodeTitle={nodeTitle}
          nodeLevel={nodeLevel}
          features={viewerFeatures}
          objects={viewerObjects}
          preset={preset}
          parentChainItems={parentChainItems}
          parentSilhouette={parentSilhouette}
          pageLinkMap={pageLinkMap}
          paletteItems={paletteItems}
        />
      </section>
    </PortalShell>
  );
}
