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
import { copyAtlasViewerScript, renderAtlasViewerPage } from "./atlas-viewer-html";

export interface AtlasStaticExportPayload {
  worldSlug: string;
  exportedAt: string;
  rootNodeId: string | null;
  map: {
    id: string;
    title: string;
    stylePreset: string;
  } | null;
  preset: Pick<AtlasStylePreset, "colors" | "typography" | "decorations">;
  /** Canonical builtin pictogram registry (so the viewer needs no hardcoded copy). */
  builtinGlyphs: Array<{
    key: string;
    name: string;
    kind: string;
    pathData: string;
    color: string;
  }>;
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

  const payload: AtlasStaticExportPayload = {
    worldSlug,
    exportedAt: new Date().toISOString(),
    rootNodeId: rootNode?.id ?? null,
    map: {
      id: snapshot.map.id,
      title: snapshot.map.title,
      stylePreset: snapshot.map.stylePreset,
    },
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
    objects: snapshot.objects.map((object) => ({
      id: object.id,
      nodeId: object.nodeId,
      paletteItemId: object.paletteItemId,
      x: object.x,
      y: object.y,
      scale: object.scale,
      rotation: object.rotation,
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

  const viewerScript = copyAtlasViewerScript(atlasDir);
  files.push(path.relative(outputDir, path.join(atlasDir, viewerScript)));

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
