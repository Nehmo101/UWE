import { notFound } from "next/navigation";
import {
  createAtlasService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail } from "@/src/components/shell";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import type { BreadcrumbItem } from "@/src/lib/world-breadcrumbs";
import {
  AtlasStudioWorkspace,
  buildPaletteIdMap,
  buildStudioAtlasDoc,
} from "@/src/components/atlas";
import type {
  BuildStudioAtlasDocInput,
  RegionDescribeTarget,
  StudioAtlasFeatureInput,
  StudioAtlasNodeInput,
  StudioAtlasObjectInput,
} from "@/src/components/atlas";

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
  let mapVisibility = "dm_only";
  let nodeVisibility = "dm_only";
  let tileLayer: unknown = null;
  let parentChain: StudioAtlasNodeInput[] = [];

  try {
    const hierarchy = await atlas.getNodeWithHierarchy(nodeId);
    if (!hierarchy) notFound();

    node = hierarchy.node;
    nodeVisibility = node.visibility ?? "dm_only";

    const map = await db.atlasMap.findUnique({ where: { id: node.mapId } });
    mapStylePreset = map?.stylePreset ?? null;
    mapVisibility = map?.visibility ?? "dm_only";
    tileLayer = map?.tileLayer ?? null;

    rawFeatures = await atlas.listFeaturesForNode(nodeId);
    rawObjects = await atlas.listObjectsForNode(nodeId);

    // Ensure builtin glyph palette items exist (idempotent) so the editor can
    // place builtin stamps and the save path can resolve them to real DB ids.
    await atlas.ensureBuiltinPaletteItems();
    rawPaletteItems = await atlas.listPaletteItems(world.id);

    parentChain = hierarchy.parentChain.map((a) => ({
      id: a.id,
      title: a.title,
      level: a.level,
    }));
  } finally {
    await db.$disconnect();
  }

  if (!node) notFound();

  let keySeq = 0;
  const nextKey = () => `sk-${++keySeq}`;

  const features: StudioAtlasFeatureInput[] = rawFeatures.map((f) => ({
    id: f.id,
    kind: f.kind,
    geometry: f.geometry as unknown as StudioAtlasFeatureInput["geometry"],
    style: (f.style as Record<string, unknown> | null) ?? undefined,
    labelText: f.labelText ?? null,
    labelColor: f.labelColor ?? null,
    childNodeId: f.childNodeId ?? null,
    linkedPageId: f.linkedPageId ?? null,
    layer: f.layer,
    sortOrder: f.sortOrder,
    visibility: f.visibility,
    _key: nextKey(),
  }));

  const objects: StudioAtlasObjectInput[] = rawObjects.map((o) => ({
    id: o.id,
    paletteItemId: o.paletteItemId,
    x: o.x,
    y: o.y,
    scale: o.scale,
    rotation: o.rotation,
    style: (o.style as Record<string, unknown> | null) ?? undefined,
    layer: o.layer,
    visibility: o.visibility,
    _key: nextKey(),
  }));

  const doc = buildStudioAtlasDoc({
    worldSlug,
    node: { id: node.id, title: node.title, level: node.level, visibility: nodeVisibility },
    parentChain,
    features,
    objects,
    tileLayer: (tileLayer ?? null) as BuildStudioAtlasDocInput["tileLayer"],
    stylePreset: mapStylePreset ?? undefined,
    mapVisibility,
  });

  const paletteIdMap = buildPaletteIdMap(
    rawPaletteItems.map((p) => ({ id: p.id, builtinGlyphKey: p.builtinGlyphKey ?? null })),
  );

  const regions: RegionDescribeTarget[] = features
    .filter(
      (f) =>
        f.kind === "region" ||
        f.kind === "biome" ||
        Boolean(f.labelText && f.labelText.trim()),
    )
    .map((f) => ({ labelText: f.labelText ?? null, kind: f.kind }));

  const hierarchyBreadcrumb: BreadcrumbItem[] = [
    ...worldSectionBreadcrumb(world.name, worldSlug, "Atlas", `/worlds/${worldSlug}/atlas`),
    ...parentChain.map((item): BreadcrumbItem => ({
      label: item.title,
      href: `/worlds/${worldSlug}/atlas/${item.id}`,
    })),
    { label: node.title },
  ];

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={<BreadcrumbTrail items={hierarchyBreadcrumb} />}
    >
      <AtlasStudioWorkspace
        worldSlug={worldSlug}
        nodeId={nodeId}
        doc={doc}
        paletteIdMap={paletteIdMap}
        regions={regions}
      />
    </WorldShell>
  );
}
