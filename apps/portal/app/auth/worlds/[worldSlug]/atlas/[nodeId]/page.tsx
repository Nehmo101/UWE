import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  createAtlasService,
  createPrismaClient,
  isAtlasEntityAccessible,
} from "@uwe/database/server";
import { filterPagesForViewer } from "@uwe/auth";
import { resolveStylePreset } from "@uwe/atlas/style-presets";
import { validateRtxAtlasAssetProposal } from "@uwe/atlas/rtx-asset-proposal";
import { AtlasViewer } from "@/src/components/atlas/AtlasViewer";
import { getAccessContextForWorld } from "@/src/lib/auth";
import { assertPortalCanReadWorld } from "@/src/lib/authz";
import type { ViewerFeature, ViewerObject, NodeAncestorItem, PageLinkMap, PaletteItemMap, ViewerTileLayer } from "@/src/components/atlas/AtlasViewer";

interface Props {
  params: Promise<{ worldSlug: string; nodeId: string }>;
}

export default async function PortalAtlasNodePage({ params }: Props) {
  const { worldSlug, nodeId } = await params;
  const ctx = await getAccessContextForWorld(worldSlug);
  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const atlas = createAtlasService(db);

  let nodeTitle = "";
  let nodeLevel: string | undefined;
  let viewerFeatures: ViewerFeature[] = [];
  let viewerObjects: ViewerObject[] = [];
  let parentChainItems: NodeAncestorItem[] = [];
  let parentSilhouette: [number, number][][] | undefined;
  let mapStylePreset: string | null = null;
  let tileLayer: ViewerTileLayer | null = null;
  const pageLinkMap: PageLinkMap = {};
  const paletteItems: PaletteItemMap = {};

  let keySeq = 0;
  function nextKey() { return `vk-${++keySeq}`; }

  try {
    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { id: true, name: true },
    });
    if (!world) notFound();

    try {
      assertPortalCanReadWorld(ctx, world.id);
    } catch {
      notFound();
    }

    const atlasData = await atlas.getAtlasForContext(worldSlug, "portal");
    if (!atlasData) notFound();

    const nodeRecord = atlasData.nodes.find((n) => n.id === nodeId);
    if (!nodeRecord) notFound();

    nodeTitle = nodeRecord.title;
    nodeLevel = nodeRecord.level;

    const map = await db.atlasMap.findUnique({ where: { id: nodeRecord.mapId } });
    mapStylePreset = map?.stylePreset ?? null;
    const rawTileLayer = map?.tileLayer as {
      cols?: number;
      rows?: number;
      cells?: Record<string, string>;
      intensity?: Record<string, number>;
      blendWidth?: number;
      elevation?: Record<string, number>;
      parallaxStrength?: number;
      contoursEnabled?: boolean;
      contourSteps?: number;
      lightDir?: string;
      climateEnabled?: boolean;
    } | null;
    if (
      rawTileLayer &&
      typeof rawTileLayer.cols === "number" &&
      typeof rawTileLayer.rows === "number" &&
      rawTileLayer.cells &&
      typeof rawTileLayer.cells === "object"
    ) {
      tileLayer = {
        cols: rawTileLayer.cols,
        rows: rawTileLayer.rows,
        cells: rawTileLayer.cells,
        intensity: rawTileLayer.intensity ?? null,
        blendWidth: rawTileLayer.blendWidth ?? null,
        elevation: rawTileLayer.elevation ?? null,
        parallaxStrength: rawTileLayer.parallaxStrength ?? null,
        contoursEnabled: rawTileLayer.contoursEnabled ?? null,
        contourSteps: rawTileLayer.contourSteps ?? null,
        lightDir: rawTileLayer.lightDir ?? null,
        climateEnabled: rawTileLayer.climateEnabled ?? null,
      };
    }

    const hierarchy = await atlas.getNodeWithHierarchy(nodeId);
    if (!hierarchy) notFound();

    const visibleNodeIds = new Set(atlasData.nodes.map((n) => n.id));
    parentChainItems = hierarchy.parentChain
      .filter((a) => visibleNodeIds.has(a.id))
      .map((a) => ({ id: a.id, title: a.title, level: a.level }));

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
      style: o.style as ViewerObject["style"],
      _key: nextKey(),
    }));

    const paletteItemIds = [
      ...new Set(viewerObjects.map((o) => o.paletteItemId)),
    ];

    if (paletteItemIds.length > 0) {
      const items = await db.atlasPaletteItem.findMany({
        where: { id: { in: paletteItemIds }, reviewStatus: "approved" },
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
          rtxAssetProposal?: unknown;
        };
        if (tags.rtxAssetProposal !== undefined) {
          const validation = validateRtxAtlasAssetProposal(tags.rtxAssetProposal);
          if (!validation.ok || validation.proposal.outputType !== "json-recipe") continue;
          paletteItems[item.id] = {
            source: item.source,
            builtinGlyphKey: item.builtinGlyphKey ?? null,
            recipe: validation.proposal.recipe,
          };
          continue;
        }
        paletteItems[item.id] = {
          source: item.source,
          builtinGlyphKey: item.builtinGlyphKey ?? null,
          imageData: tags.imageData,
          mimeType: tags.mimeType,
        };
      }
    }

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
        },
        select: {
          id: true,
          slug: true,
          visibility: true,
          publishStatus: true,
          secretLevel: true,
          revealState: true,
        },
      });
      for (const page of filterPagesForViewer(ctx, pages)) {
        pageLinkMap[page.id] = page.slug;
      }
    }
  } finally {
    await db.$disconnect();
  }

  if (!nodeTitle) notFound();

  const preset = resolveStylePreset(mapStylePreset);

  return (
    <section className="grid gap-4">
      <Link
        href={`/auth/worlds/${worldSlug}/atlas`}
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Zurück zum Atlas
      </Link>

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
        tileLayer={tileLayer}
      />
    </section>
  );
}
