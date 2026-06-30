import { notFound } from "next/navigation";
import {
  createAtlasService,
  createPrismaClient,
  getAppRepository,
} from "@uwe/database/server";
import { resolveStylePreset } from "@uwe/atlas/style-presets";
import { WorldShell, BreadcrumbTrail } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { AtlasEditor } from "@/src/components/atlas";
import type { EditorFeature, EditorObject } from "@/src/components/atlas";

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
  let mapStylePreset: string | null = null;

  try {
    node = await atlas.getNode(nodeId);
    if (!node) notFound();

    const map = await db.atlasMap.findUnique({ where: { id: node.mapId } });
    mapStylePreset = map?.stylePreset ?? null;

    rawFeatures = await atlas.listFeaturesForNode(nodeId);
    rawObjects = await atlas.listObjectsForNode(nodeId);
  } finally {
    await db.$disconnect();
  }

  if (!node) notFound();

  const preset = resolveStylePreset(mapStylePreset);

  // Map DB records to editor-compatible shapes (serializable, no Prisma types)
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

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldDetailBreadcrumb(
            world.name,
            worldSlug,
            "Atlas",
            `/worlds/${worldSlug}/atlas`,
            node.title,
          )}
        />
      }
    >
      <AtlasEditor
        worldSlug={worldSlug}
        nodeId={nodeId}
        nodeTitle={node.title}
        initialFeatures={editorFeatures}
        initialObjects={editorObjects}
        preset={preset}
      />
    </WorldShell>
  );
}
