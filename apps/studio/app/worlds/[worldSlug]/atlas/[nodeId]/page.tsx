import { notFound } from "next/navigation";
import {
  createAtlasService,
  createPrismaClient,
  getAppRepository,
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
  let parentChainItems: NodeAncestorItem[] = [];
  let parentSilhouette: [number, number][][] | undefined;

  try {
    const hierarchy = await atlas.getNodeWithHierarchy(nodeId);
    if (!hierarchy) notFound();

    node = hierarchy.node;

    const map = await db.atlasMap.findUnique({ where: { id: node.mapId } });
    mapStylePreset = map?.stylePreset ?? null;

    rawFeatures = await atlas.listFeaturesForNode(nodeId);
    rawObjects = await atlas.listObjectsForNode(nodeId);
    rawPaletteItems = await atlas.listPaletteItems(world.id);

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
    .filter((p) => p.source === "ai" || p.source === "upload")
    .map((p) => {
      const tags = (p.styleTags ?? {}) as StyleTagsRecord;
      return {
        id: p.id,
        name: p.name,
        kind: p.kind,
        source: p.source as "builtin" | "ai" | "upload",
        reviewStatus: p.reviewStatus as "approved" | "pending",
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
        initialPaletteItems={editorPaletteItems}
      />
    </WorldShell>
  );
}
