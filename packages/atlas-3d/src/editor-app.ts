/**
 * Atlas 3D editor viewport — the framework-agnostic three.js application.
 *
 * Two modes share one contract:
 *  - "globe": orbit camera around the SDF planet (world lighting).
 *  - "terrain": top-down 3D over a flat level (pan/zoom, shift = tilt,
 *    map-fixed lighting) with the inherited silhouette as locked underlay.
 *
 * The React shell owns undo/redo and persistence; committed edits are
 * emitted via `onCommit` with a serializable document snapshot, undo/redo
 * re-enters through `applyExternal`. Region drafts (drill-down) are read by
 * the shell via `getRegionDraft` once the user confirms a title.
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
import { applyPlanarBrush, createTerrainField } from "./terrain-field";
import { buildTerrainMeshData } from "./terrain-mesh";
import { applySplatBrush, createSplat, splatFromJson, splatToJson, type SplatGrid, type SplatJson } from "./splat";
import { buildFlatGeometry, buildInkMeshGroup, type InkMeshGroup } from "./ink-style";
import { buildWorldRootBridge } from "./world-root";

export type Atlas3DEditorMode = "globe" | "terrain";

export type Atlas3DEditorTool =
  | "orbit"
  | "raise"
  | "lower"
  | "smooth"
  | "bite"
  | "tunnel"
  | "biome"
  | "region";

export interface Atlas3DEditorDocState {
  seed: number;
  carveOps: CarveOp[];
  heightmap: HeightmapJson | null;
  splat: SplatJson | null;
  splitGap: number;
}

export type Atlas3DCommitKind = "sculpt" | "carve" | "split" | "biome";

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
  /** Terrain mode: inherited parent silhouette (2D polygon json) + water level. */
  silhouette?: unknown;
  waterLevel?: number;
  resolution?: number;
  editResolution?: number;
  worldRootCount?: number;
  onCommit?: (kind: Atlas3DCommitKind, doc: Atlas3DEditorDocState) => void;
  onRegionDraftChange?: (pointCount: number) => void;
  onReady?: (info: { webgl: boolean }) => void;
}

export interface Atlas3DEditorApp {
  readonly webglAvailable: boolean;
  readonly mode: Atlas3DEditorMode;
  setTool(tool: Atlas3DEditorTool): void;
  setBrush(brush: { radius?: number; strength?: number }): void;
  setBiome(biome: number): void;
  /** Live split preview (slider drag) — call commitSplit() on release. */
  setSplitGap(gap: number): void;
  commitSplit(): void;
  /** Visual water level (inherited/overridden via inspector — not undoable here). */
  setWaterLevel(level: number): void;
  getRegionDraft(): Atlas3DRegionDraft | null;
  clearRegionDraft(): void;
  applyExternal(doc: Atlas3DEditorDocState): void;
  getDocSnapshot(): Atlas3DEditorDocState;
  dispose(): void;
}

const SPLIT_OP_ID = "welt-spalt";
const HEIGHTMAP_WIDTH = 128;
const HEIGHTMAP_HEIGHT = 64;
const PLANAR_HEIGHTMAP = 128;
const SPLAT_WIDTH = 128;
const SPLAT_HEIGHT = 64;
const PLANAR_SPLAT = 128;
const TERRAIN_SIZE = 2;
const INK = new THREE.Color("#211d17");
const WATER_BLUE = new THREE.Color("#4a76a3");

function splitGapOf(ops: readonly CarveOp[]): number {
  const split = ops.find((op) => op.kind === "split");
  return split && split.kind === "split" ? split.gap : 0;
}

export function createAtlas3DEditorApp(canvas: HTMLCanvasElement, options: Atlas3DEditorAppOptions): Atlas3DEditorApp {
  const mode = options.mode;
  const restResolution = options.resolution ?? (mode === "globe" ? 52 : 64);
  const editResolution = options.editResolution ?? (mode === "globe" ? 36 : 44);
  const worldRootCount = options.worldRootCount ?? 6;
  const silhouette: Vec2[] | null = mode === "terrain" ? parsePolygon(options.silhouette ?? null) : null;

  let carveOps: CarveOp[] = parseCarveOps(options.carveOps ?? []);
  let heightmap: HeightmapGrid =
    heightmapFromJson(options.heightmap ?? null) ??
    (mode === "globe" ? createHeightmap(HEIGHTMAP_WIDTH, HEIGHTMAP_HEIGHT) : createHeightmap(PLANAR_HEIGHTMAP, PLANAR_HEIGHTMAP));
  let splat: SplatGrid =
    splatFromJson(options.splat ?? null) ??
    (mode === "globe" ? createSplat(SPLAT_WIDTH, SPLAT_HEIGHT) : createSplat(PLANAR_SPLAT, PLANAR_SPLAT));
  let waterLevel = options.waterLevel ?? 0;
  const seed = options.seed;

  let tool: Atlas3DEditorTool = "orbit";
  let brushRadius = 0.28;
  let brushStrength = 0.02;
  let activeBiome = 1;
  let tunnelEntry: THREE.Vector3 | null = null;

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
  const orbit = mode === "globe" ? { theta: 0.6, phi: 1.15, distance: 3.4 } : { theta: 0, phi: 0.5, distance: 3.6 };
  const panTarget = new THREE.Vector3(0, 0, 0);
  const raycaster = new THREE.Raycaster();

  let planet: InkMeshGroup | null = null;
  let roots: { group: THREE.Group; dispose(): void } | null = null;
  let waterMesh: THREE.Mesh | null = null;
  let silhouetteLine: THREE.LineLoop | null = null;
  let disposed = false;

  // region draft (drill-down)
  const regionPoints: THREE.Vector3[] = [];
  let regionMarkers: THREE.Group | null = null;

  function updateCamera(): void {
    const sinPhi = Math.sin(orbit.phi);
    camera.position.set(
      panTarget.x + Math.cos(orbit.theta) * sinPhi * orbit.distance,
      panTarget.y + Math.cos(orbit.phi) * orbit.distance,
      panTarget.z + Math.sin(orbit.theta) * sinPhi * orbit.distance,
    );
    camera.lookAt(panTarget);
  }

  function rebuildWater(): void {
    if (waterMesh) {
      scene.remove(waterMesh);
      (waterMesh.material as THREE.Material).dispose();
      waterMesh.geometry.dispose();
      waterMesh = null;
    }
    if (mode !== "terrain") return;
    const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE * 2.4, TERRAIN_SIZE * 2.4);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: WATER_BLUE, transparent: true, opacity: 0.55 });
    waterMesh = new THREE.Mesh(geometry, material);
    waterMesh.position.y = waterLevel;
    scene.add(waterMesh);
  }

  function rebuildSilhouette(): void {
    if (silhouetteLine) {
      scene.remove(silhouetteLine);
      silhouetteLine.geometry.dispose();
      (silhouetteLine.material as THREE.Material).dispose();
      silhouetteLine = null;
    }
    if (mode !== "terrain" || !silhouette) return;
    const points = silhouette.map(([x, z]) => new THREE.Vector3(x, waterLevel + 0.03, z));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.6 });
    silhouetteLine = new THREE.LineLoop(geometry, material);
    scene.add(silhouetteLine);
  }

  function rebuildRegionMarkers(): void {
    if (regionMarkers) {
      scene.remove(regionMarkers);
      regionMarkers.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineLoop) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      regionMarkers = null;
    }
    if (regionPoints.length === 0) return;
    regionMarkers = new THREE.Group();
    const markerMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color("#c2622b") });
    for (const point of regionPoints) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), markerMaterial.clone());
      marker.position.copy(point).multiplyScalar(mode === "globe" ? 1.01 : 1);
      if (mode === "terrain") marker.position.y = point.y + 0.03;
      regionMarkers.add(marker);
    }
    if (regionPoints.length >= 2) {
      const lifted = regionPoints.map((p) =>
        mode === "globe" ? p.clone().multiplyScalar(1.012) : new THREE.Vector3(p.x, p.y + 0.03, p.z),
      );
      const line = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(lifted),
        new THREE.LineBasicMaterial({ color: new THREE.Color("#c2622b") }),
      );
      regionMarkers.add(line);
    }
    scene.add(regionMarkers);
  }

  function rebuild(resolution: number): void {
    let data;
    if (mode === "globe") {
      const field = createPlanetField({ seed, heightmap, carveOps });
      data = buildPlanetMeshData(field, { resolution, splat });
    } else {
      const field = createTerrainField({ seed, size: TERRAIN_SIZE, heightmap, carveOps, silhouette, waterLevel });
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
        count: worldRootCount,
        seed,
      });
      scene.add(roots.group);
    }
  }

  function snapshot(): Atlas3DEditorDocState {
    return {
      seed,
      carveOps: parseCarveOps(JSON.parse(JSON.stringify(carveOps))),
      heightmap: heightmapToJson(heightmap),
      splat: splatToJson(splat),
      splitGap: splitGapOf(carveOps),
    };
  }

  function commit(kind: Atlas3DCommitKind): void {
    options.onCommit?.(kind, snapshot());
  }

  // --- picking & tools ---
  function pickSurface(event: PointerEvent): THREE.Vector3 | null {
    if (!planet) return null;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
    raycaster.setFromCamera(ndc, camera);
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

  function handleToolPointerDown(event: PointerEvent): boolean {
    if (tool === "orbit") return false;
    const point = pickSurface(event);
    if (!point) return false;
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
      rebuildRegionMarkers();
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
    const usedByTool = event.button === 0 && !event.shiftKey && handleToolPointerDown(event);
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
      const panScale = orbit.distance * 0.0016;
      const sin = Math.sin(orbit.theta);
      const cos = Math.cos(orbit.theta);
      panTarget.x -= (dx * -sin + dy * -cos) * panScale;
      panTarget.z -= (dx * cos + dy * -sin) * panScale;
      const limit = TERRAIN_SIZE * 1.2;
      panTarget.x = Math.min(limit, Math.max(-limit, panTarget.x));
      panTarget.z = Math.min(limit, Math.max(-limit, panTarget.z));
    } else {
      orbit.theta += dx * 0.006;
      const minPhi = mode === "terrain" ? 0.2 : 0.15;
      const maxPhi = mode === "terrain" ? 1.1 : Math.PI - 0.15;
      orbit.phi = Math.min(maxPhi, Math.max(minPhi, orbit.phi + dy * 0.006));
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
    const min = mode === "terrain" ? 1.0 : 1.6;
    orbit.distance = Math.min(8, Math.max(min, orbit.distance * (1 + Math.sign(event.deltaY) * 0.08)));
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
  function loop(): void {
    if (disposed) return;
    renderer?.render(scene, camera);
    frame = requestAnimationFrame(loop);
  }

  rebuild(restResolution);
  rebuildWater();
  rebuildSilhouette();
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
        rebuildRegionMarkers();
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
    setSplitGap(gap) {
      const others = carveOps.filter((op) => op.kind !== "split");
      carveOps = gap > 0.005 ? [...others, { id: SPLIT_OP_ID, kind: "split", normal: [1, 0, 0], gap }] : others;
      rebuild(editResolution);
    },
    commitSplit() {
      rebuild(restResolution);
      commit("split");
    },
    setWaterLevel(level) {
      waterLevel = level;
      rebuildWater();
      rebuildSilhouette();
      if (mode === "terrain") rebuild(restResolution);
    },
    getRegionDraft() {
      if (regionPoints.length < 3) return null;
      return { mode, points: regionPoints.map((p) => [p.x, p.y, p.z]) };
    },
    clearRegionDraft() {
      regionPoints.length = 0;
      rebuildRegionMarkers();
      options.onRegionDraftChange?.(0);
    },
    applyExternal(doc) {
      carveOps = parseCarveOps(doc.carveOps);
      heightmap =
        heightmapFromJson(doc.heightmap) ??
        (mode === "globe" ? createHeightmap(HEIGHTMAP_WIDTH, HEIGHTMAP_HEIGHT) : createHeightmap(PLANAR_HEIGHTMAP, PLANAR_HEIGHTMAP));
      splat =
        splatFromJson(doc.splat) ??
        (mode === "globe" ? createSplat(SPLAT_WIDTH, SPLAT_HEIGHT) : createSplat(PLANAR_SPLAT, PLANAR_SPLAT));
      rebuild(restResolution);
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
      renderer?.dispose();
    },
  };
}
