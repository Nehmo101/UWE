import fs from "node:fs";
import path from "node:path";
import { createAtlasService, type PrismaClient } from "@uwe/database/server";

export interface AtlasStaticExportPayload {
  worldSlug: string;
  exportedAt: string;
  map: {
    id: string;
    title: string;
    stylePreset: string;
  } | null;
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
    labelText: string | null;
    labelColor: string | null;
    childNodeId: string | null;
    linkedPageId: string | null;
  }>;
  objects: Array<{
    id: string;
    nodeId: string;
    paletteItemId: string;
    x: number;
    y: number;
    scale: number;
    rotation: number;
  }>;
}

/**
 * Write portal-filtered Atlas data as JSON for static hosting.
 * Returns relative path under outputDir, or null when no exportable atlas exists.
 */
export async function writeAtlasStaticJson(
  db: PrismaClient,
  worldSlug: string,
  outputDir: string,
): Promise<string | null> {
  const atlas = createAtlasService(db);
  const snapshot = await atlas.getAtlasForContext(worldSlug, "portal");
  if (!snapshot) return null;

  const payload: AtlasStaticExportPayload = {
    worldSlug,
    exportedAt: new Date().toISOString(),
    map: {
      id: snapshot.map.id,
      title: snapshot.map.title,
      stylePreset: snapshot.map.stylePreset,
    },
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
      labelText: feature.labelText,
      labelColor: feature.labelColor,
      childNodeId: feature.childNodeId,
      linkedPageId: feature.linkedPageId,
    })),
    objects: snapshot.objects.map((object) => ({
      id: object.id,
      nodeId: object.nodeId,
      paletteItemId: object.paletteItemId,
      x: object.x,
      y: object.y,
      scale: object.scale,
      rotation: object.rotation,
    })),
  };

  const atlasDir = path.join(outputDir, "atlas");
  fs.mkdirSync(atlasDir, { recursive: true });
  const absoluteFile = path.join(atlasDir, "data.json");
  fs.writeFileSync(absoluteFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return path.relative(outputDir, absoluteFile);
}
