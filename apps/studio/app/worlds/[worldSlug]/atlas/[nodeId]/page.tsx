import { notFound } from "next/navigation";
import {
  createAtlasService,
  createPrismaClient,
  getAppRepository,
  buildPageUrl,
} from "@uwe/database/server";
import { resolveStylePreset } from "@uwe/atlas/style-presets";
import { WorldShell, BreadcrumbTrail } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import type { BreadcrumbItem } from "@/src/lib/world-breadcrumbs";
import { AtlasEditor } from "@/src/components/atlas";
import type { EditorFeature, EditorObject, EditorPaletteItem, NodeAncestorItem } from "@/src/components/atlas";

interface Props {
  params: Promise<{ worldSlug: string; nodeId: string }>;
}

export default async function AtlasNodeEditorPage({ params }: Props) {
  const { worldSlug, nodeId } = await params;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const db = createPrismaClient();
  const atlas = createAtlasService(db);

  let node: Awaited<ReturnType<typeof atlas.getNode>> | null = null;
  let rawFeatures: Awaited<ReturnType<typeof atlas.listFeaturesForNode>> = [];
  let rawObjects: Awaited<ReturnType<typeof atlas.listObjectsForNode>> = [];
  let rawPaletteItems: Awaited<ReturnType<typeof atlas.listPaletteItems>> = [];
  let mapStylePreset: string | null = null;
  let mapVisibility: string = "dm_only";
  let nodeVisibility: string = "dm_only";
  let parentChainItems: NodeAncestorItem[] = [];
  let parentSilhouette: [number, number][][] | undefined;
  let backgroundAssetId: string | null = null;
  let linkedPageHrefById: Record<string, string> = {};

  try {
    const hierarchy = await atlas.getNodeWithHierarchy(nodeId);
    if (!hierarchy) notFound();

    node = hierarchy.node;
    backgroundAssetId = node.backgroundAssetId ?? null;
    nodeVisibility = node.visibility ?? "dm_only";

    const map = await db.atlasMap.findUnique({ where: { id: node.mapId } });
    mapStylePreset = map?.stylePreset ?? null;
    mapVisibility = map?.visibility ?? "dm_only";

    rawFeatures = await atlas.listFeaturesForNode(nodeId);
    rawObjects = await atlas.listObjectsForNode(nodeId);

    // Ensure builtin glyph palette items exist (idempotent) so older atlases
    // can place builtin stamps with a real palette item id.
    await atlas.ensureBuiltinPaletteItems();
    rawPaletteItems = await atlas.listPaletteItems(world.id);

    // Resolve linked wiki pages to their correct Studio URLs (by slug/type).
    const linkedPageIds = Array.from(
      new Set(
        rawFeatures
          .map((f) => f.linkedPageId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (linkedPageIds.length > 0) {
      const pages = await db.page.findMany({
        where: { id: { in: linkedPageIds } },
        select: { id: true, type: true, slug: true },
      });
      linkedPageHrefById = Object.fromEntries(
        pages.map((p) => [p.id, buildPageUrl(worldSlug, p.type, p.slug)]),
      );
    }

    // Build parent chain items for breadcrumb/hierarchy display.
    parentChainItems = hierarchy.parentChain.map((a) => ({
      id: a.id,
      title: a.title,
      level: a.level,
    }));

    // Extract parent silhouette from the parent feature geometry.
    if (hierarchy.parentFeature) {
      const geo = hierarchy.parentFeature.geometry as {
        type?: string;
        rings?: [number, number][][];
      } | null;
      if (geo?.type === "Polygon" && Array.isArray(geo.rings)) {
        parentSilhouette = geo.rings as [number, number][][];
      }
    }
  } finally {
    await db.$disconnect();
  }

  if (!node) notFound();

  const preset = resolveStylePreset(mapStylePreset);

  let keySeq = 0;
  function nextKey() {
    return `sk-${++keySeq}`;
  }

  const editorFeatures: EditorFeature[] = rawFeatures.map((f) => ({
    id: f.id,
    kind: f.kind as EditorFeature["kind"],
    geometry: f.geometry as unknown as EditorFeature["geometry"],
    style: f.style as EditorFeature["style"] | undefined,
    labelText: f.labelText ?? null,
    labelColor: (f.labelColor as EditorFeature["labelColor"]) ?? null,
    childNodeId: f.childNodeId ?? null,
    linkedPageId: f.linkedPageId ?? null,
    linkedPageHref: f.linkedPageId ? (linkedPageHrefById[f.linkedPageId] ?? null) : null,
    layer: f.layer,
    sortOrder: f.sortOrder,
    visibility: f.visibility,
    _key: nextKey(),
  }));

  const editorObjects: EditorObject[] = rawObjects.map((o) => ({
    id: o.id,
    paletteItemId: o.paletteItemId,
    x: o.x,
    y: o.y,
    scale: o.scale,
    rotation: o.rotation,
    layer: o.layer,
    visibility: o.visibility,
    _key: nextKey(),
  }));

  type StyleTagsRecord = {
    imageData?: string;
    mimeType?: string;
    prompt?: string;
    keyword?: string;
  };

  const editorPaletteItems: EditorPaletteItem[] = rawPaletteItems
    .filter((p) => p.source === "ai" || p.source === "upload" || p.source === "builtin")
    .map((p) => {
      const tags = (p.styleTags ?? {}) as StyleTagsRecord;
      return {
        id: p.id,
        name: p.name,
        kind: p.kind,
        source: p.source as "builtin" | "ai" | "upload",
        reviewStatus: p.reviewStatus as "approved" | "pending",
        builtinGlyphKey: p.builtinGlyphKey ?? null,
        imageData: tags.imageData,
        mimeType: tags.mimeType,
      };
    });

  // Build a richer breadcrumb using the parent chain.
  const hierarchyBreadcrumb: BreadcrumbItem[] = [
    ...worldSectionBreadcrumb(world.name, worldSlug, "Atlas", `/worlds/${worldSlug}/atlas`),
    ...parentChainItems.map((item): BreadcrumbItem => ({
      label: item.title,
      href: `/worlds/${worldSlug}/atlas/${item.id}`,
    })),
    { label: node.title },
  ];

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail items={hierarchyBreadcrumb} />
      }
    >
      <AtlasEditor
        worldSlug={worldSlug}
        nodeId={nodeId}
        nodeTitle={node.title}
        nodeLevel={node.level}
        initialFeatures={editorFeatures}
        initialObjects={editorObjects}
        preset={preset}
        parentChainItems={parentChainItems}
        parentSilhouette={parentSilhouette}
        backgroundAssetId={backgroundAssetId}
        initialPaletteItems={editorPaletteItems}
        nodeVisibility={nodeVisibility}
        mapVisibility={mapVisibility}
      />
    </WorldShell>
  );
}
