/**
 * Atlas 3D editor viewport — the framework-agnostic three.js application.
 *
 * The React shell stays thin: it owns the undo/redo command stack and
 * persistence, this app owns the scene, camera, picking and live tool
 * feedback. Committed edits are emitted via `onCommit` with a serializable
 * document snapshot; undo/redo re-enters through `applyExternal`.
 */

import * as THREE from "three";
import { parseCarveOps, type CarveOp } from "@uwe/atlas-editor/carve";
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
import { buildFlatGeometry, buildInkMeshGroup, type InkMeshGroup } from "./ink-style";
import { buildWorldRootBridge } from "./world-root";

export type Atlas3DEditorTool = "orbit" | "raise" | "lower" | "smooth" | "bite" | "tunnel";

export interface Atlas3DEditorDocState {
  seed: number;
  carveOps: CarveOp[];
  heightmap: HeightmapJson | null;
  splitGap: number;
}

export type Atlas3DCommitKind = "sculpt" | "carve" | "split";

export interface Atlas3DEditorAppOptions {
  seed: number;
  carveOps?: unknown;
  heightmap?: unknown;
  /** Mesh resolution at rest / during drags. */
  resolution?: number;
  editResolution?: number;
  worldRootCount?: number;
  onCommit?: (kind: Atlas3DCommitKind, doc: Atlas3DEditorDocState) => void;
  onReady?: (info: { webgl: boolean }) => void;
}

export interface Atlas3DEditorApp {
  readonly webglAvailable: boolean;
  setTool(tool: Atlas3DEditorTool): void;
  setBrush(brush: { radius?: number; strength?: number }): void;
  /** Live split preview (slider drag) — call commitSplit() on release. */
  setSplitGap(gap: number): void;
  commitSplit(): void;
  applyExternal(doc: Atlas3DEditorDocState): void;
  getDocSnapshot(): Atlas3DEditorDocState;
  dispose(): void;
}

const SPLIT_OP_ID = "welt-spalt";
const HEIGHTMAP_WIDTH = 128;
const HEIGHTMAP_HEIGHT = 64;

function splitGapOf(ops: readonly CarveOp[]): number {
  const split = ops.find((op) => op.kind === "split");
  return split && split.kind === "split" ? split.gap : 0;
}

export function createAtlas3DEditorApp(canvas: HTMLCanvasElement, options: Atlas3DEditorAppOptions): Atlas3DEditorApp {
  const restResolution = options.resolution ?? 52;
  const editResolution = options.editResolution ?? 36;
  const worldRootCount = options.worldRootCount ?? 6;

  let carveOps: CarveOp[] = parseCarveOps(options.carveOps ?? []);
  let heightmap: HeightmapGrid =
    heightmapFromJson(options.heightmap ?? null) ?? createHeightmap(HEIGHTMAP_WIDTH, HEIGHTMAP_HEIGHT);
  const seed = options.seed;

  let tool: Atlas3DEditorTool = "orbit";
  let brushRadius = 0.28;
  let brushStrength = 0.02;
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
  const orbit = { theta: 0.6, phi: 1.15, distance: 3.4 };
  const raycaster = new THREE.Raycaster();

  let planet: InkMeshGroup | null = null;
  let roots: { group: THREE.Group; dispose(): void } | null = null;
  let disposed = false;

  function updateCamera(): void {
    const sinPhi = Math.sin(orbit.phi);
    camera.position.set(
      Math.cos(orbit.theta) * sinPhi * orbit.distance,
      Math.cos(orbit.phi) * orbit.distance,
      Math.sin(orbit.theta) * sinPhi * orbit.distance,
    );
    camera.lookAt(0, 0, 0);
  }

  function rebuild(resolution: number): void {
    const field = createPlanetField({ seed, heightmap, carveOps });
    const data = buildPlanetMeshData(field, { resolution });
    const geometry = buildFlatGeometry(data);
    if (planet) {
      scene.remove(planet.group);
      planet.dispose();
    }
    planet = buildInkMeshGroup(geometry, { objectSpaceLight: 0, outlineWidth: 0.014 });
    scene.add(planet.group);

    if (roots) {
      scene.remove(roots.group);
      roots.dispose();
      roots = null;
    }
    const gap = splitGapOf(carveOps);
    if (gap > 0.01) {
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
  let strokeDirty = false;
  let lastRemesh = 0;

  function applySculptAt(point: THREE.Vector3, mode: BrushMode): void {
    const dir = point.clone().normalize();
    applyHeightBrush(heightmap, [dir.x, dir.y, dir.z], brushRadius, brushStrength, mode);
    strokeDirty = true;
    const now = performance.now();
    if (now - lastRemesh > 130) {
      lastRemesh = now;
      rebuild(editResolution);
    }
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
    if (tool === "bite") {
      carveOps = [
        ...carveOps,
        { id: `biss-${Date.now().toString(36)}-${carveOps.length}`, kind: "bite", center: [point.x, point.y, point.z], radius: Math.max(0.12, brushRadius) },
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
    const usedByTool = event.button === 0 && handleToolPointerDown(event);
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
    if (!dragging) return;
    orbit.theta += (event.clientX - lastX) * 0.006;
    orbit.phi = Math.min(Math.PI - 0.15, Math.max(0.15, orbit.phi + (event.clientY - lastY) * 0.006));
    lastX = event.clientX;
    lastY = event.clientY;
    updateCamera();
  }

  function onPointerUp(): void {
    dragging = false;
    if (sculpting) {
      sculpting = false;
      if (strokeDirty) {
        strokeDirty = false;
        rebuild(restResolution);
        commit("sculpt");
      }
    }
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    orbit.distance = Math.min(8, Math.max(1.6, orbit.distance * (1 + Math.sign(event.deltaY) * 0.08)));
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
  updateCamera();
  resize();
  if (webglAvailable) frame = requestAnimationFrame(loop);
  options.onReady?.({ webgl: webglAvailable });

  return {
    webglAvailable,
    setTool(next) {
      tool = next;
      tunnelEntry = null;
    },
    setBrush(brush) {
      if (brush.radius !== undefined) brushRadius = Math.min(1.2, Math.max(0.05, brush.radius));
      if (brush.strength !== undefined) brushStrength = Math.min(0.2, Math.max(0.002, brush.strength));
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
    applyExternal(doc) {
      carveOps = parseCarveOps(doc.carveOps);
      heightmap = heightmapFromJson(doc.heightmap) ?? createHeightmap(HEIGHTMAP_WIDTH, HEIGHTMAP_HEIGHT);
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
