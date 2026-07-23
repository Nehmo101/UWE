"use server";

import { revalidatePath } from "next/cache";
import { createPrismaClient } from "@uwe/database/server";
import { createAtlas3DService } from "@uwe/database/atlas3d";
import { parseCarveOps, serializeCarveOps } from "@uwe/atlas-editor/carve";
import { projectSurfacePatch, type Vec2, type Vec3 } from "@uwe/atlas-editor/geometry";
import type { Atlas3DEnvironment } from "@uwe/atlas-editor/doc";
import { requireStudioActionAuth } from "@/src/lib/studio-action-auth";
import { requireStudioWorldEdit } from "@/src/lib/authz";

/**
 * Atlas 3D server actions — separate file by design: the legacy
 * atlas-actions.ts is frozen at its size baseline and must not grow.
 * Atlas 3D content is entirely player-visible (owner decision 2026-07-21),
 * so there is no visibility handling here.
 */

export interface SaveAtlas3DTerrainResult {
  ok: boolean;
  error?: string;
}

async function requireNodeInWorld(worldSlug: string, nodeId: string) {
  const db = createPrismaClient();
  const atlas3d = createAtlas3DService(db);
  const chain = await atlas3d.getNodeChain(nodeId);
  if (!chain) throw new Error("Atlas-3D-Ebene nicht gefunden");
  const world = await db.world.findUnique({ where: { slug: worldSlug }, select: { id: true } });
  if (!world || chain.atlasWorld.worldId !== world.id) {
    throw new Error("Atlas-3D-Ebene gehört nicht zu dieser Welt");
  }
  return { db, atlas3d, chain };
}

/**
 * Persist the sculpted terrain document of a node: carve operations and the
 * sculpt heightmap (as JSON in terrain.meta until the asset pipeline lands in
 * phase 2). No revalidatePath — the editor owns the live scene; a remount
 * would reset the camera.
 */
export async function saveAtlas3DTerrainAction(formData: FormData): Promise<SaveAtlas3DTerrainResult> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const nodeId = String(formData.get("nodeId"));
  try {
    const { atlas3d } = await requireNodeInWorld(worldSlug, nodeId);

    // Round-trip through the validator: unknown/invalid ops are dropped, key
    // order is normalized — the stored list is always deterministic.
    const carveOps = parseCarveOps(JSON.parse(String(formData.get("carveOps") || "[]")));
    const heightmapRaw = String(formData.get("heightmap") || "null");
    const heightmap: unknown = JSON.parse(heightmapRaw);

    const splatRaw = String(formData.get("splat") || "null");
    const splat: unknown = JSON.parse(splatRaw);

    const splitOp = carveOps.find((op) => op.kind === "split");
    await atlas3d.saveTerrain(nodeId, {
      carveOps: JSON.parse(serializeCarveOps(carveOps)),
      meta: {
        heightmap: heightmap ?? null,
        splat: splat ?? null,
        splitGap: splitOp?.kind === "split" ? splitOp.gap : 0,
      },
    });

    // placed assets + drawn paths/labels (drill-down "region" features stay untouched)
    const objectsRaw: unknown = JSON.parse(String(formData.get("objects") || "[]"));
    if (Array.isArray(objectsRaw)) {
      await atlas3d.saveObjects(
        nodeId,
        objectsRaw
          .filter((o): o is Record<string, unknown> => typeof o === "object" && o !== null)
          .filter((o) => typeof o.assetKind === "string" && typeof o.position === "object" && o.position !== null)
          .map((o) => ({
            id: typeof o.id === "string" ? o.id : undefined,
            assetKind: o.assetKind as string,
            position: o.position as object,
            scale: typeof o.scale === "number" ? o.scale : 1,
            rotation: typeof o.rotation === "number" ? o.rotation : 0,
            tint: typeof o.tint === "string" ? o.tint : null,
          })),
      );
    }
    const featuresRaw: unknown = JSON.parse(String(formData.get("features") || "[]"));
    if (Array.isArray(featuresRaw)) {
      const editorKinds = ["river", "road", "label"] as const;
      await atlas3d.saveFeatures(
        nodeId,
        featuresRaw
          .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
          .filter((f) => (editorKinds as readonly string[]).includes(f.kind as string) && Array.isArray(f.points))
          .map((f) => ({
            id: typeof f.id === "string" ? f.id : undefined,
            kind: f.kind as string,
            geometry: { points: f.points } as object,
            labelText: typeof f.labelText === "string" ? f.labelText : null,
          })),
        { kinds: editorKinds },
      );
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Speichern fehlgeschlagen" };
  }
}

export interface CreateAtlas3DRegionResult {
  ok: boolean;
  childId?: string;
  error?: string;
}

/** Child map half-extent used by the terrain editor (see editor-app TERRAIN_SIZE). */
const CHILD_MAP_SIZE = 2;

function isPointList(value: unknown): value is [number, number, number][] {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.every(
      (p) => Array.isArray(p) && p.length === 3 && p.every((n) => typeof n === "number" && Number.isFinite(n)),
    )
  );
}

function averageUnit(vectors: readonly [number, number, number][]): Vec3 | undefined {
  const sum: [number, number, number] = [0, 0, 0];
  for (const v of vectors) {
    sum[0] += v[0];
    sum[1] += v[1];
    sum[2] += v[2];
  }
  const len = Math.hypot(sum[0], sum[1], sum[2]);
  return len > 1e-9 ? [sum[0] / len, sum[1] / len, sum[2] / len] : undefined;
}

/**
 * Drill-down: a region drawn on the parent becomes a child level. Globe
 * regions are surface patches (hull, crater floors, cut faces, tunnel walls)
 * projected into their best-fit plane; terrain regions are 2D polygons
 * re-centered on their centroid. The scaled polygon is stored as the child's
 * locked silhouette.
 */
export async function createAtlas3DRegionAction(formData: FormData): Promise<CreateAtlas3DRegionResult> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const parentNodeId = String(formData.get("parentNodeId"));
  const title = String(formData.get("title") || "").trim();
  const mode = String(formData.get("mode"));
  try {
    if (!title) throw new Error("Bitte einen Namen für die neue Ebene angeben");
    const points: unknown = JSON.parse(String(formData.get("points") || "[]"));
    if (!isPointList(points)) throw new Error("Region braucht mindestens 3 Punkte");
    // optional per-point surface normals (backward compatible: older clients omit them)
    const normalsRaw: unknown = JSON.parse(String(formData.get("normals") || "null"));
    const normals = isPointList(normalsRaw) && normalsRaw.length === points.length ? normalsRaw : null;
    const { atlas3d, db } = await requireNodeInWorld(worldSlug, parentNodeId);

    let silhouette: Vec2[];
    let extent: unknown;
    if (mode === "globe") {
      const patch = projectSurfacePatch(points, normals ? averageUnit(normals) : undefined);
      if (!patch) throw new Error("Region ist zu klein oder entartet");
      const scale = (CHILD_MAP_SIZE * 0.85) / Math.max(patch.radius, 1e-6);
      silhouette = patch.polygon.map(([x, z]): Vec2 => [x * scale, z * scale]);
      extent = { kind: "surface-patch", points, centroid: patch.centroid, normal: patch.normal, radius: patch.radius };
    } else {
      const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
      const cz = points.reduce((sum, p) => sum + p[2], 0) / points.length;
      const centered: Vec2[] = points.map((p): Vec2 => [p[0] - cx, p[2] - cz]);
      const radius = Math.max(...centered.map(([x, z]) => Math.hypot(x, z)), 1e-6);
      const scale = (CHILD_MAP_SIZE * 0.85) / radius;
      silhouette = centered.map(([x, z]): Vec2 => [x * scale, z * scale]);
      extent = { kind: "map-polygon", points: points.map((p) => [p[0], p[2]]), center: [cx, cz] };
    }

    const createdFeature = await db.atlas3DFeature.create({
      data: {
        nodeId: parentNodeId,
        kind: "region",
        geometry: { points } as object,
        labelText: title,
      },
    });

    const child = await atlas3d.createChildNode({
      parentId: parentNodeId,
      title,
      sourceFeatureId: createdFeature.id,
      extent: extent as object,
      silhouette: { points: silhouette } as object,
    });
    revalidatePath(`/worlds/${worldSlug}/atlas3d/${parentNodeId}`);
    return { ok: true, childId: child.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Ebene anlegen fehlgeschlagen" };
  }
}

/** Replace-all save of the node's camera bookmarks. */
export async function saveAtlas3DBookmarksAction(formData: FormData): Promise<SaveAtlas3DTerrainResult> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const nodeId = String(formData.get("nodeId"));
  try {
    const { atlas3d } = await requireNodeInWorld(worldSlug, nodeId);
    const raw: unknown = JSON.parse(String(formData.get("bookmarks") || "[]"));
    if (!Array.isArray(raw)) throw new Error("Ungültige Lesezeichen");
    await atlas3d.saveBookmarks(
      nodeId,
      raw
        .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
        .filter((b) => typeof b.name === "string" && typeof b.pose === "object" && b.pose !== null)
        .map((b) => ({ name: (b.name as string).slice(0, 80), pose: b.pose as object })),
    );
    revalidatePath(`/worlds/${worldSlug}/atlas3d/${nodeId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Speichern fehlgeschlagen" };
  }
}

/**
 * Inspector environment override. `value` = "inherit" clears the field (the
 * ancestor chain wins again); otherwise the field is overridden on the node.
 */
export async function setAtlas3DEnvironmentAction(formData: FormData): Promise<SaveAtlas3DTerrainResult> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const nodeId = String(formData.get("nodeId"));
  const field = String(formData.get("field"));
  const rawValue = String(formData.get("value"));
  try {
    if (field !== "waterLevel" && field !== "timeOfDay" && field !== "fogDensity") {
      throw new Error(`Unbekanntes Umgebungsfeld: ${field}`);
    }
    const { atlas3d, chain } = await requireNodeInWorld(worldSlug, nodeId);
    const node = chain.nodes[chain.nodes.length - 1];
    const environment: Atlas3DEnvironment = { ...((node.environment as Atlas3DEnvironment | null) ?? {}) };
    if (rawValue === "inherit") {
      delete environment[field];
    } else if (field === "waterLevel" || field === "fogDensity") {
      const value = Number(rawValue);
      if (!Number.isFinite(value)) throw new Error("Ungültiger Wert");
      environment[field] = field === "fogDensity" ? Math.min(1, Math.max(0, value)) : value;
    } else {
      if (!["morning", "noon", "evening", "night"].includes(rawValue)) throw new Error("Ungültige Tageszeit");
      environment.timeOfDay = rawValue as Atlas3DEnvironment["timeOfDay"];
    }
    const hasOverrides = Object.keys(environment).length > 0;
    await atlas3d.updateNode(nodeId, { environment: hasOverrides ? (environment as object) : null });
    revalidatePath(`/worlds/${worldSlug}/atlas3d/${nodeId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Speichern fehlgeschlagen" };
  }
}

/** Zweistufiger Reset: scope "edits" behält Regionen + Unter-Ebenen, "full" löscht sie mit. */
export async function resetAtlas3DNodeAction(formData: FormData): Promise<SaveAtlas3DTerrainResult> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const nodeId = String(formData.get("nodeId"));
  const scope = String(formData.get("scope"));
  try {
    if (scope !== "edits" && scope !== "full") throw new Error(`Unbekannter Reset-Umfang: ${scope}`);
    const { atlas3d } = await requireNodeInWorld(worldSlug, nodeId);
    await atlas3d.resetNode(nodeId, { includeSubtree: scope === "full" });
    revalidatePath(`/worlds/${worldSlug}/atlas3d/${nodeId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Zurücksetzen fehlgeschlagen" };
  }
}

export interface DeleteAtlas3DNodeResult {
  ok: boolean;
  parentId?: string;
  error?: string;
}

/** Löscht eine Unter-Ebene samt Teilbaum und der Region-Markierung auf der Elternebene. */
export async function deleteAtlas3DNodeAction(formData: FormData): Promise<DeleteAtlas3DNodeResult> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const nodeId = String(formData.get("nodeId"));
  try {
    const { atlas3d, chain } = await requireNodeInWorld(worldSlug, nodeId);
    const node = chain.nodes[chain.nodes.length - 1];
    if (!node.parentId) throw new Error("Die Wurzelebene (Globus) kann nicht gelöscht werden");
    await atlas3d.deleteNodeWithCleanup(nodeId);
    revalidatePath(`/worlds/${worldSlug}/atlas3d/${node.parentId}`);
    revalidatePath(`/worlds/${worldSlug}/atlas3d`);
    return { ok: true, parentId: node.parentId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Löschen fehlgeschlagen" };
  }
}

/** Löscht einen Regions-Marker OHNE die verknüpfte Unter-Ebene. */
export async function deleteAtlas3DFeatureAction(formData: FormData): Promise<SaveAtlas3DTerrainResult> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const nodeId = String(formData.get("nodeId"));
  const featureId = String(formData.get("featureId"));
  try {
    const { atlas3d, db } = await requireNodeInWorld(worldSlug, nodeId);
    const feature = await db.atlas3DFeature.findUnique({ where: { id: featureId } });
    if (!feature || feature.nodeId !== nodeId) throw new Error("Region nicht gefunden");
    if (feature.kind !== "region") throw new Error("Nur Regions-Marker können hier gelöscht werden");
    await atlas3d.deleteFeature(nodeId, featureId);
    revalidatePath(`/worlds/${worldSlug}/atlas3d/${nodeId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Löschen fehlgeschlagen" };
  }
}

/** Update node title or seed from the inspector. */
export async function updateAtlas3DNodeAction(formData: FormData): Promise<SaveAtlas3DTerrainResult> {
  await requireStudioActionAuth();
  const worldSlug = String(formData.get("worldSlug"));
  await requireStudioWorldEdit(worldSlug);

  const nodeId = String(formData.get("nodeId"));
  try {
    const { atlas3d } = await requireNodeInWorld(worldSlug, nodeId);
    const title = formData.get("title");
    const seed = formData.get("seed");
    await atlas3d.updateNode(nodeId, {
      title: title !== null ? String(title) : undefined,
      seed: seed !== null ? Number(seed) : undefined,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Speichern fehlgeschlagen" };
  }
}
