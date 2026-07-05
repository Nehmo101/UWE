import fs from "node:fs";
import path from "node:path";
import { resolveStylePreset, type AtlasStylePreset } from "@uwe/atlas/style-presets";
import { BUILTIN_GLYPHS } from "@uwe/atlas/glyphs";
import {
  createAtlasService,
  type PrismaClient,
  type UweRepository,
} from "@uwe/database/server";
import { staticExportCategoryForPageType, staticPageHref } from "./paths";
import { copyAtlasViewerScripts, renderAtlasViewerPage } from "./atlas-viewer-html";

export interface AtlasStaticExportPayload {
  worldSlug: string;
  exportedAt: string;
  rootNodeId: string | null;
  map: {
    id: string;
    title: string;
    stylePreset: string;
  } | null;
  /**
   * Terrain tile layer of the (portal-visible) map — { cols, rows, tile, cells }.
   * Taken from the filtered snapshot, so it is only present when the map itself
   * passed the portal gate.
   */
  tileLayer: unknown;
  preset: Pick<AtlasStylePreset, "colors" | "typography" | "decorations">;
  /** Canonical builtin pictogram registry (so the viewer needs no hardcoded copy). */
  builtinGlyphs: Array<{
    key: string;
    name: string;
    kind: string;
    pathData: string;
    color: string;
  }>;
  /**
   * Palette items referenced by the exported (portal-visible) objects —
   * approved-only, resolved to builtin glyph keys or inline image stamps.
   */
  paletteItems: Record<
    string,
    {
      source: string;
      builtinGlyphKey: string | null;
      imageData?: string;
      mimeType?: string;
    }
  >;
  pageLinks: Record<string, string>;
  nodes: Array<{
    id: string;
    parentId: string | null;
    level: string;
    title: string;
    parentFeatureId: string | null;
    childNodeIds: string[];
  }>;
  features: Array<{
    id: string;
    nodeId: string;
    kind: string;
    geometry: unknown;
    style: unknown;
    labelText: string | null;
    labelColor: string | null;
    childNodeId: string | null;
    linkedPageId: string | null;
    layer: number;
  }>;
  objects: Array<{
    id: string;
    nodeId: string;
    paletteItemId: string;
    x: number;
    y: number;
    scale: number;
    rotation: number;
    style: unknown;
    linkedPageId: string | null;
    layer: number;
  }>;
}

export interface AtlasStaticExportResult {
  files: string[];
}

/**
 * Write portal-filtered Atlas JSON + static HTML viewer for offline hosting.
 * Returns relative paths under outputDir, or null when no exportable atlas exists.
 */
export async function writeAtlasStaticBundle(
  db: PrismaClient,
  repo: UweRepository,
  worldSlug: string,
  outputDir: string,
  worldName: string,
): Promise<AtlasStaticExportResult | null> {
  const atlas = createAtlasService(db);
  const snapshot = await atlas.getAtlasForContext(worldSlug, "portal");
  if (!snapshot) return null;

  const pages = await repo.listPagesForContext(worldSlug, "portal");
  const pageLinks: Record<string, string> = {};
  for (const page of pages) {
    const category = staticExportCategoryForPageType(page.type);
    pageLinks[page.id] = `../${staticPageHref(category, page.slug)}`;
  }

  const rootNode =
    snapshot.nodes.find((node) => !node.parentId) ??
    snapshot.nodes.find((node) => node.level === "globe") ??
    snapshot.nodes[0] ??
    null;

  const preset = resolveStylePreset(snapshot.map.stylePreset);

  // Resolve the palette items the visible objects reference. Only approved
  // items ship — pending AI stamps/uploads must never reach the player bundle.
  const referencedPaletteIds = [
    ...new Set(snapshot.objects.map((object) => object.paletteItemId)),
  ];
  const paletteItems: AtlasStaticExportPayload["paletteItems"] = {};
  if (referencedPaletteIds.length > 0) {
    const items = await db.atlasPaletteItem.findMany({
      where: {
        id: { in: referencedPaletteIds },
        reviewStatus: "approved",
      },
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
  const approvedPaletteIds = new Set(Object.keys(paletteItems));
  const exportableObjects = snapshot.objects.filter((object) =>
    approvedPaletteIds.has(object.paletteItemId),
  );

  const payload: AtlasStaticExportPayload = {
    worldSlug,
    exportedAt: new Date().toISOString(),
    rootNodeId: rootNode?.id ?? null,
    map: {
      id: snapshot.map.id,
      title: snapshot.map.title,
      stylePreset: snapshot.map.stylePreset,
    },
    tileLayer: snapshot.map.tileLayer ?? null,
    preset: {
      colors: preset.colors,
      typography: preset.typography,
      decorations: preset.decorations,
    },
    builtinGlyphs: BUILTIN_GLYPHS.map((glyph) => ({
      key: glyph.key,
      name: glyph.name,
      kind: glyph.kind,
      pathData: glyph.pathData,
      color: glyph.color,
    })),
    paletteItems,
    pageLinks,
    nodes: snapshot.nodes.map((node) => ({
      id: node.id,
      parentId: node.parentId,
      level: node.level,
      title: node.title,
      parentFeatureId: node.parentFeatureId,
      childNodeIds: snapshot.features
        .filter((f) => f.nodeId === node.id && f.childNodeId)
        .map((f) => f.childNodeId!),
    })),
    features: snapshot.features.map((feature) => ({
      id: feature.id,
      nodeId: feature.nodeId,
      kind: feature.kind,
      geometry: feature.geometry,
      style: feature.style,
      labelText: feature.labelText,
      labelColor: feature.labelColor,
      childNodeId: feature.childNodeId,
      linkedPageId: feature.linkedPageId,
      layer: feature.layer,
    })),
    objects: exportableObjects.map((object) => ({
      id: object.id,
      nodeId: object.nodeId,
      paletteItemId: object.paletteItemId,
      x: object.x,
      y: object.y,
      scale: object.scale,
      rotation: object.rotation,
      style: object.style ?? null,
      linkedPageId: object.linkedPageId,
      layer: object.layer,
    })),
  };

  const atlasDir = path.join(outputDir, "atlas");
  fs.mkdirSync(atlasDir, { recursive: true });

  const files: string[] = [];

  const dataFile = path.join(atlasDir, "data.json");
  fs.writeFileSync(dataFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  files.push(path.relative(outputDir, dataFile));

  for (const script of copyAtlasViewerScripts(atlasDir)) {
    files.push(path.relative(outputDir, path.join(atlasDir, script)));
  }

  const indexHtml = renderAtlasViewerPage({
    worldName,
    mapTitle: snapshot.map.title,
    cssHref: "../assets/portal.css",
    homeHref: "../",
  });
  const indexFile = path.join(atlasDir, "index.html");
  fs.writeFileSync(indexFile, indexHtml, "utf8");
  files.push(path.relative(outputDir, indexFile));

  return { files };
}

/** @deprecated Use writeAtlasStaticBundle */
export async function writeAtlasStaticJson(
  db: PrismaClient,
  worldSlug: string,
  outputDir: string,
): Promise<string | null> {
  const atlas = createAtlasService(db);
  const snapshot = await atlas.getAtlasForContext(worldSlug, "portal");
  if (!snapshot) return null;

  const atlasDir = path.join(outputDir, "atlas");
  fs.mkdirSync(atlasDir, { recursive: true });
  const absoluteFile = path.join(atlasDir, "data.json");
  fs.writeFileSync(
    absoluteFile,
    `${JSON.stringify({ worldSlug, exportedAt: new Date().toISOString(), nodes: snapshot.nodes }, null, 2)}\n`,
    "utf8",
  );
  return path.relative(outputDir, absoluteFile);
}
