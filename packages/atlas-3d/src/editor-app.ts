/**
 * Atlas 3D editor viewport — the framework-agnostic three.js application.
 *
 * Two modes share one contract:
 *  - "globe": orbit camera around the SDF planet (world lighting).
 *  - "terrain": top-down 3D over a flat level (pan/zoom, shift = tilt,
 *    map-fixed lighting) with the inherited silhouette as locked underlay.
 *
 * The React shell owns undo/redo and persistence; committed edits arrive via
 * `onCommit` as serializable snapshots, undo/redo re-enters via `applyExternal`.
 */

import * as THREE from "three";
import { parseCarveOps, type CarveOp } from "@uwe/atlas-editor/carve";
import { parsePolygon, type Vec2 } from "@uwe/atlas-editor/geometry";
import {
  applyHeightBrush,
  createHeightmap,
  createPlanetField,
  heightmapFromJson,
  heightmapToJson,
  type BrushMode,
  type HeightmapGrid,
  type HeightmapJson,
} from "./planet-field";
import { buildPlanetMeshData } from "./planet-mesh";
import { applyPlanarBrush, createTerrainField, type TerrainField } from "./terrain-field";
import { buildTerrainMeshData } from "./terrain-mesh";
import { applySplatBrush, createSplat, splatFromJson, splatToJson, type SplatGrid, type SplatJson } from "./splat";
import { applySceneEnvironment, buildFlatGeometry, buildInkMeshGroup, type InkMeshGroup } from "./ink-style";
import { buildWorldRootBridge } from "./world-root";
import { splitGapOf, splitRootsOf, withSplitGap, withSplitRoots } from "./split-ops";
import { INK_ASSET_DEFAULT_TINT, type InkAssetKind, type InkTint } from "./assets-ink";
import { findTerrainPath, type PathKind } from "./terrain-path";
import { generateSettlement3D } from "./settlement3d";
import {
  parseDocFeatures,
  parseDocObjects,
  SceneObjectLayer,
  type DocFeatureState,
  type DocObjectState,
} from "./scene-objects";
import { EditorDecor } from "./editor-decor";
import { OrbitRig } from "./viewport-rig";

export type Atlas3DEditorMode = "globe" | "terrain";

export type Atlas3DEditorTool =
  | "orbit"
  | "raise"
  | "lower"
  | "smooth"
  | "bite"
  | "tunnel"
  | "biome"
  | "region"
  | "asset"
  | "select"
  | "river"
  | "road"
  | "label"
  | "settlement";

export interface Atlas3DEditorDocState {
  seed: number;
  carveOps: CarveOp[];
  heightmap: HeightmapJson | null;
  splat: SplatJson | null;
  splitGap: number;
  /** World-root count bridging the split gap (renderer default when no split). */
  worldRoots: number;
  objects: DocObjectState[];
  features: DocFeatureState[];
}

export type Atlas3DCommitKind = "sculpt" | "carve" | "split" | "biome" | "objects" | "features";

export interface Atlas3DRegionDraft {
  /** Globe: unit directions on the sphere. Terrain: [x, 0, z] map points. */
  points: [number, number, number][];
  mode: Atlas3DEditorMode;
}

export interface Atlas3DEditorAppOptions {
  mode: Atlas3DEditorMode;
  seed: number;
  carveOps?: unknown;
  heightmap?: unknown;
  splat?: unknown;
  objects?: unknown;
  features?: unknown;
  /** Terrain mode: inherited parent silhouette (2D polygon json) + water level. */
  silhouette?: unknown;
  waterLevel?: number;
  /** Inherited atmosphere: time-of-day key + fog density [0..1]. */
  environment?: { timeOfDay?: string; fogDensity?: number };
  /** Portal viewer: orbit/pan only, no editing tools, no commits. */
  readOnly?: boolean;
  resolution?: number;
  editResolution?: number;
  worldRootCount?: number;
  onCommit?: (kind: Atlas3DCommitKind, doc: Atlas3DEditorDocState) => void;
  onRegionDraftChange?: (pointCount: number) => void;
  onSelectionChange?: (count: number) => void;
  onReady?: (info: { webgl: boolean }) => void;
}

export interface Atlas3DEditorApp {
  readonly webglAvailable: boolean;
  readonly mode: Atlas3DEditorMode;
  setTool(tool: Atlas3DEditorTool): void;
  setBrush(brush: { radius?: number; strength?: number }): void;
  setBiome(biome: number): void;
  setAsset(asset: { kind?: InkAssetKind; tint?: InkTint }): void;
  setLabelText(text: string): void;
  deleteSelection(): void;
  /** Live split previews (gap + world-root sliders) — call commitSplit() on release. */
  setSplitGap(gap: number): void;
  setWorldRoots(count: number): void;
  commitSplit(): void;
  /** Visual water level (inherited/overridden via inspector — not undoable here). */
  setWaterLevel(level: number): void;
  /** Live atmosphere preview (inherited/overridden via inspector). */
  setEnvironmentVisuals(environment: { timeOfDay?: string; fogDensity?: number }): void;
  getCameraPose(): { theta: number; phi: number; distance: number; target: [number, number, number] };
  flyTo(pose: { theta?: number; phi?: number; distance?: number; target?: [number, number, number] }, durationMs?: number): void;
  getRegionDraft(): Atlas3DRegionDraft | null;
  clearRegionDraft(): void;
  /** Fresh render → PNG data URL (null without WebGL). */
  exportImage(): string | null;
  applyExternal(doc: Atlas3DEditorDocState): void;
  getDocSnapshot(): Atlas3DEditorDocState;
  dispose(): void;
}

// grid sizes: globe heightmap/splat are equirect 128×64, flat levels 128×128
const GLOBE_GRID = [128, 64] as const;
const PLANAR_GRID = [128, 128] as const;
const TERRAIN_SIZE = 2;

export function createAtlas3DEditorApp(canvas: HTMLCanvasElement, options: Atlas3DEditorAppOptions): Atlas3DEditorApp {
  const mode = options.mode;
  const restResolution = options.resolution ?? (mode === "globe" ? 52 : 64);
  const editResolution = options.editResolution ?? (mode === "globe" ? 36 : 44);
  const worldRootCount = options.worldRootCount ?? 6;
  const silhouette: Vec2[] | null = mode === "terrain" ? parsePolygon(options.silhouette ?? null) : null;

  let carveOps: CarveOp[] = parseCarveOps(options.carveOps ?? []);
  let heightmap: HeightmapGrid =
    heightmapFromJson(options.heightmap ?? null) ??
    (mode === "globe" ? createHeightmap(...GLOBE_GRID) : createHeightmap(...PLANAR_GRID));
  let splat: SplatGrid =
    splatFromJson(options.splat ?? null) ??
    (mode === "globe" ? createSplat(...GLOBE_GRID) : createSplat(...PLANAR_GRID));
  let waterLevel = options.waterLevel ?? 0;
  const seed = options.seed;

  let tool: Atlas3DEditorTool = "orbit";
  let brushRadius = 0.28;
  let brushStrength = 0.02;
  let activeBiome = 1;
  let tunnelEntry: THREE.Vector3 | null = null;
  let objects: DocObjectState[] = parseDocObjects(options.objects ?? []);
  let features: DocFeatureState[] = parseDocFeatures(options.features ?? []);
  let assetKind: InkAssetKind = "tree";
  let assetTint: InkTint = INK_ASSET_DEFAULT_TINT.tree;
  let labelText = "";
  let pathStart: { x: number; z: number } | null = null;
  let localSeq = objects.length + features.length + 1;
  const selection = new Set<string>();
  let currentTerrainField: TerrainField | null = null;
  let currentPlanetElevation: ((dir: THREE.Vector3) => number) | null = null;

  // --- renderer (graceful without WebGL so e2e/headless can still mount) ---
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1);
  } catch {
    renderer = null;
  }
  const webglAvailable = renderer !== null;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 100);
  const rig = new OrbitRig(mode === "globe" ? { theta: 0.6, phi: 1.15, distance: 3.4 } : { theta: 0, phi: 0.5, distance: 3.6 });
  const raycaster = new THREE.Raycaster();

  let planet: InkMeshGroup | null = null;
  let roots: { group: THREE.Group; dispose(): void } | null = null;
  let disposed = false;
  const decor = new EditorDecor(scene, mode, TERRAIN_SIZE);
  const readOnly = options.readOnly === true;
  let envTimeOfDay: string = options.environment?.timeOfDay ?? "noon";
  let envFogDensity: number = options.environment?.fogDensity ?? 0;

  function applyEnvironment(): void {
    applySceneEnvironment(scene, envTimeOfDay, envFogDensity);
  }

  // region draft (drill-down)
  const regionPoints: THREE.Vector3[] = [];

  function updateCamera(): void {
    rig.apply(camera);
  }

  const objectLayer = new SceneObjectLayer({
    mode,
    surfaceHeight: (x, z) => currentTerrainField?.height(x, z) ?? 0,
    globeRadiusAt: (dir) => {
      const elevation = currentPlanetElevation?.(dir) ?? 0;
      return 1 + Math.max(0, elevation);
    },
  });

  function syncObjects(): void {
    objectLayer.setSelection(selection);
    objectLayer.sync(objects, features, performance.now() / 1000);
    options.onSelectionChange?.(selection.size);
    applyEnvironment();
  }

  function rebuild(resolution: number): void {
    let data;
    if (mode === "globe") {
      const field = createPlanetField({ seed, heightmap, carveOps });
      currentPlanetElevation = (dir) => field.elevation([dir.x, dir.y, dir.z]);
      data = buildPlanetMeshData(field, { resolution, splat });
    } else {
      const field = createTerrainField({ seed, size: TERRAIN_SIZE, heightmap, carveOps, silhouette, waterLevel });
      currentTerrainField = field;
      data = buildTerrainMeshData(field, { resolution, splat });
    }
    const geometry = buildFlatGeometry(data);
    if (planet) {
      scene.remove(planet.group);
      planet.dispose();
    }
    planet = buildInkMeshGroup(geometry, {
      objectSpaceLight: mode === "terrain" ? 1 : 0,
      outlineWidth: mode === "globe" ? 0.014 : 0.008,
    });
    scene.add(planet.group);

    if (roots) {
      scene.remove(roots.group);
      roots.dispose();
      roots = null;
    }
    const gap = splitGapOf(carveOps);
    if (mode === "globe" && gap > 0.01) {
      roots = buildWorldRootBridge({
        normal: new THREE.Vector3(1, 0, 0),
        gap,
        planetRadius: 1,
        count: splitRootsOf(carveOps) ?? worldRootCount,
        seed,
      });
      scene.add(roots.group);
    }
    applyEnvironment();
  }

  function snapshot(): Atlas3DEditorDocState {
    return {
      seed,
      carveOps: parseCarveOps(JSON.parse(JSON.stringify(carveOps))),
      heightmap: heightmapToJson(heightmap),
      splat: splatToJson(splat),
      splitGap: splitGapOf(carveOps),
      worldRoots: splitRootsOf(carveOps) ?? worldRootCount,
      objects: JSON.parse(JSON.stringify(objects)) as DocObjectState[],
      features: JSON.parse(JSON.stringify(features)) as DocFeatureState[],
    };
  }

  function commit(kind: Atlas3DCommitKind): void {
    options.onCommit?.(kind, snapshot());
  }

  // --- picking & tools ---
  function pointerNdc(event: PointerEvent): THREE.Vector2 {
    const rect = canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
  }

  function pickSurface(event: PointerEvent): THREE.Vector3 | null {
    if (!planet) return null;
    raycaster.setFromCamera(pointerNdc(event), camera);
    const hits = raycaster.intersectObject(planet.fill, false);
    return hits.length > 0 ? hits[0].point.clone() : null;
  }

  let sculpting = false;
  let painting = false;
  let strokeDirty = false;
  let lastRemesh = 0;

  function throttledRemesh(): void {
    strokeDirty = true;
    const now = performance.now();
    if (now - lastRemesh > 130) {
      lastRemesh = now;
      rebuild(editResolution);
    }
  }

  function applySculptAt(point: THREE.Vector3, brushMode: BrushMode): void {
    if (mode === "globe") {
      const dir = point.clone().normalize();
      applyHeightBrush(heightmap, [dir.x, dir.y, dir.z], brushRadius, brushStrength, brushMode);
    } else {
      applyPlanarBrush(heightmap, TERRAIN_SIZE, [point.x, point.z], brushRadius, brushStrength, brushMode);
    }
    throttledRemesh();
  }

  function applyBiomeAt(point: THREE.Vector3): void {
    if (mode === "globe") {
      const dir = point.clone().normalize();
      const u = (Math.atan2(dir.z, dir.x) / (Math.PI * 2) + 0.5) % 1;
      const v = Math.acos(Math.min(1, Math.max(-1, dir.y))) / Math.PI;
      applySplatBrush(splat, u, v, brushRadius / Math.PI, activeBiome);
    } else {
      const u = (point.x / TERRAIN_SIZE + 1) / 2;
      const v = (point.z / TERRAIN_SIZE + 1) / 2;
      applySplatBrush(splat, u, v, brushRadius / (TERRAIN_SIZE * 2), activeBiome);
    }
    throttledRemesh();
  }

  function pickObject(event: PointerEvent): string | null {
    raycaster.setFromCamera(pointerNdc(event), camera);
    const hits = raycaster.intersectObjects(objectLayer.pickables as THREE.Object3D[], true);
    for (const hit of hits) {
      let walker: THREE.Object3D | null = hit.object;
      while (walker) {
        if (typeof walker.userData.localId === "string") return walker.userData.localId;
        walker = walker.parent;
      }
    }
    return null;
  }

  function placeAsset(point: THREE.Vector3): void {
    const localId = `neu-${localSeq++}`;
    let position: Record<string, unknown>;
    if (assetKind === "asteroid" && mode === "globe") {
      const flat = Math.max(1.6, Math.hypot(point.x, point.z) + 0.6);
      position = { orbit: { radius: flat, inclination: point.y * 0.4, phase: Math.atan2(point.z, point.x), speed: 0.12 } };
    } else if (mode === "globe") {
      const dir = point.clone().normalize();
      position = { dir: [dir.x, dir.y, dir.z] };
    } else {
      position = { x: point.x, z: point.z };
    }
    objects = [...objects, { localId, assetKind, tint: assetTint, position, scale: 1, rotation: 0 }];
    syncObjects();
    commit("objects");
  }

  function handlePathClick(point: THREE.Vector3, kind: PathKind): void {
    if (mode !== "terrain" || !currentTerrainField) return;
    if (!pathStart) {
      pathStart = { x: point.x, z: point.z };
      return;
    }
    const routed = findTerrainPath(currentTerrainField, pathStart, { x: point.x, z: point.z }, { kind });
    pathStart = null;
    if (!routed) return;
    features = [
      ...features,
      { localId: `neu-${localSeq++}`, kind, points: routed.map((p) => ({ x: p.x, z: p.z })) },
    ];
    syncObjects();
    commit("features");
  }

  function handleToolPointerDown(event: PointerEvent): boolean {
    if (tool === "orbit") return false;
    if (tool === "select") {
      const hit = pickObject(event);
      if (!event.shiftKey) selection.clear();
      if (hit) {
        if (event.shiftKey && selection.has(hit)) selection.delete(hit);
        else selection.add(hit);
      }
      syncObjects();
      return hit !== null;
    }
    const point = pickSurface(event);
    if (!point) return false;
    if (tool === "asset") {
      placeAsset(point);
      return true;
    }
    if (tool === "river" || tool === "road") {
      handlePathClick(point, tool);
      return true;
    }
    if (tool === "settlement" && mode === "terrain") {
      const layoutSeed = seed + Math.round(point.x * 997) * 31 + Math.round(point.z * 997);
      const settlement = generateSettlement3D({
        center: { x: point.x, z: point.z },
        seed: layoutSeed,
        idPrefix: `neu-${localSeq++}`,
      });
      objects = [...objects, ...settlement.objects];
      features = [...features, ...settlement.features];
      syncObjects();
      commit("objects");
      return true;
    }
    if (tool === "label") {
      features = [
        ...features,
        { localId: `neu-${localSeq++}`, kind: "label", points: [{ x: point.x, z: point.z }], labelText },
      ];
      syncObjects();
      commit("features");
      return true;
    }
    if (tool === "raise" || tool === "lower" || tool === "smooth") {
      sculpting = true;
      applySculptAt(point, tool);
      return true;
    }
    if (tool === "biome") {
      painting = true;
      applyBiomeAt(point);
      return true;
    }
    if (tool === "region") {
      const stored = mode === "globe" ? point.clone().normalize() : new THREE.Vector3(point.x, point.y, point.z);
      regionPoints.push(stored);
      decor.updateRegionMarkers(regionPoints);
      options.onRegionDraftChange?.(regionPoints.length);
      return true;
    }
    if (tool === "bite") {
      carveOps = [
        ...carveOps,
        {
          id: `biss-${Date.now().toString(36)}-${carveOps.length}`,
          kind: "bite",
          center: [point.x, point.y, point.z],
          radius: Math.max(0.12, brushRadius),
        },
      ];
      rebuild(restResolution);
      commit("carve");
      return true;
    }
    if (tool === "tunnel") {
      if (!tunnelEntry) {
        tunnelEntry = point;
        return true;
      }
      carveOps = [
        ...carveOps,
        {
          id: `tunnel-${Date.now().toString(36)}-${carveOps.length}`,
          kind: "tunnel",
          from: [tunnelEntry.x, tunnelEntry.y, tunnelEntry.z],
          to: [point.x, point.y, point.z],
          radius: Math.max(0.08, brushRadius * 0.5),
        },
      ];
      tunnelEntry = null;
      rebuild(restResolution);
      commit("carve");
      return true;
    }
    return false;
  }

  // --- pointer & wheel handlers ---
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function onPointerDown(event: PointerEvent): void {
    canvas.setPointerCapture(event.pointerId);
    const usedByTool = !readOnly && event.button === 0 && !event.shiftKey && handleToolPointerDown(event);
    if (!usedByTool) {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (sculpting && (tool === "raise" || tool === "lower" || tool === "smooth")) {
      const point = pickSurface(event);
      if (point) applySculptAt(point, tool);
      return;
    }
    if (painting && tool === "biome") {
      const point = pickSurface(event);
      if (point) applyBiomeAt(point);
      return;
    }
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (mode === "terrain" && !event.shiftKey) {
      // top-down standard view: primary drag pans the map
      rig.pan(dx, dy, TERRAIN_SIZE * 1.2);
    } else {
      rig.rotate(dx, dy, mode === "terrain" ? 0.2 : 0.15, mode === "terrain" ? 1.1 : Math.PI - 0.15);
    }
    updateCamera();
  }

  function onPointerUp(): void {
    dragging = false;
    const wasStroke = sculpting || painting;
    const wasSculpt = sculpting;
    sculpting = false;
    painting = false;
    if (wasStroke && strokeDirty) {
      strokeDirty = false;
      rebuild(restResolution);
      commit(wasSculpt ? "sculpt" : "biome");
    }
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    rig.zoom(Math.sign(event.deltaY), mode === "terrain" ? 1.0 : 1.6);
    updateCamera();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  // --- resize & render loop ---
  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer?.setSize(width, height, false);
  }
  const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(canvas);

  let frame = 0;
  function loop(time: number): void {
    if (disposed) return;
    if (rig.tick(time)) updateCamera();
    objectLayer.updateTime(time / 1000);
    renderer?.render(scene, camera);
    frame = requestAnimationFrame(loop);
  }

  scene.add(objectLayer.group);
  rebuild(restResolution);
  syncObjects();
  decor.updateWater(waterLevel);
  decor.updateSilhouette(silhouette, waterLevel);
  applyEnvironment();
  updateCamera();
  resize();
  if (webglAvailable) frame = requestAnimationFrame(loop);
  options.onReady?.({ webgl: webglAvailable });

  return {
    webglAvailable,
    mode,
    setTool(next) {
      tool = next;
      tunnelEntry = null;
      if (next !== "region" && regionPoints.length > 0) {
        regionPoints.length = 0;
        decor.updateRegionMarkers(regionPoints);
        options.onRegionDraftChange?.(0);
      }
    },
    setBrush(brush) {
      if (brush.radius !== undefined) brushRadius = Math.min(1.2, Math.max(0.05, brush.radius));
      if (brush.strength !== undefined) brushStrength = Math.min(0.2, Math.max(0.002, brush.strength));
    },
    setBiome(biome) {
      activeBiome = Math.max(0, Math.floor(biome));
    },
    setAsset(asset) {
      if (asset.kind !== undefined) {
        assetKind = asset.kind;
        assetTint = INK_ASSET_DEFAULT_TINT[asset.kind];
      }
      if (asset.tint !== undefined) assetTint = asset.tint;
    },
    setLabelText(text) {
      labelText = text;
    },
    deleteSelection() {
      if (selection.size === 0) return;
      objects = objects.filter((o) => !selection.has(o.localId));
      features = features.filter((f) => !selection.has(f.localId));
      selection.clear();
      syncObjects();
      commit("objects");
    },
    setSplitGap(gap) {
      carveOps = withSplitGap(carveOps, gap);
      rebuild(editResolution);
    },
    setWorldRoots(count) {
      carveOps = withSplitRoots(carveOps, count);
      rebuild(editResolution);
    },
    commitSplit() {
      rebuild(restResolution);
      commit("split");
    },
    setWaterLevel(level) {
      waterLevel = level;
      decor.updateWater(waterLevel);
      decor.updateSilhouette(silhouette, waterLevel);
      if (mode === "terrain") rebuild(restResolution);
      applyEnvironment();
    },
    setEnvironmentVisuals(environment) {
      if (environment.timeOfDay !== undefined) envTimeOfDay = environment.timeOfDay;
      if (environment.fogDensity !== undefined) envFogDensity = environment.fogDensity;
      applyEnvironment();
    },
    getCameraPose() {
      return rig.pose();
    },
    flyTo(pose, durationMs = 700) {
      // without WebGL there is no render loop — jump straight to the pose
      rig.flyTo(pose, durationMs, !webglAvailable);
      if (!webglAvailable) updateCamera();
    },
    getRegionDraft() {
      if (regionPoints.length < 3) return null;
      return { mode, points: regionPoints.map((p) => [p.x, p.y, p.z]) };
    },
    clearRegionDraft() {
      regionPoints.length = 0;
      decor.updateRegionMarkers(regionPoints);
      options.onRegionDraftChange?.(0);
    },
    exportImage() {
      if (!renderer) return null;
      // render right before reading — the drawing buffer is not preserved
      renderer.render(scene, camera);
      return canvas.toDataURL("image/png");
    },
    applyExternal(doc) {
      carveOps = parseCarveOps(doc.carveOps);
      heightmap =
        heightmapFromJson(doc.heightmap) ??
        (mode === "globe" ? createHeightmap(...GLOBE_GRID) : createHeightmap(...PLANAR_GRID));
      splat =
        splatFromJson(doc.splat) ??
        (mode === "globe" ? createSplat(...GLOBE_GRID) : createSplat(...PLANAR_GRID));
      objects = parseDocObjects(doc.objects);
      features = parseDocFeatures(doc.features);
      selection.clear();
      rebuild(restResolution);
      syncObjects();
    },
    getDocSnapshot: snapshot,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      if (planet) {
        scene.remove(planet.group);
        planet.dispose();
      }
      if (roots) {
        scene.remove(roots.group);
        roots.dispose();
      }
      decor.dispose();
      objectLayer.dispose();
      renderer?.dispose();
    },
  };
}
