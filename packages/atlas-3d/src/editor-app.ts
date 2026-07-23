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
import { applyHeightBrush, createPlanetField, type BrushMode } from "./planet-field";
import { HeightLayerSession } from "./editor-height-layers";
import { buildPlanetMeshData } from "./planet-mesh";
import { applyPlanarBrush, createTerrainField, type TerrainField } from "./terrain-field";
import { buildTerrainMeshData } from "./terrain-mesh";
import { applySplatBrush, createSplat, splatFromJson, splatToJson, type SplatGrid } from "./splat";
import { applySceneEnvironment, buildFlatGeometry, buildInkMeshGroup, type InkMeshGroup } from "./ink-style";
import { combineTints, SEASON_TINTS, STYLE_TINTS } from "./environment-presets";
import { buildWorldRootBridge } from "./world-root";
import { splitGapOf, splitRootsOf, withSplitGap, withSplitRoots } from "./split-ops";
import { makeBiteOp, makeTunnelOp, removeCarveOpById, summarizeCarveOps } from "./carve-tools";
import { RegionDraftState } from "./region-draft";
import { deriveGlobeBiomes, derivePlanarBiomes } from "./biome-derive";
import { EditorToolsController } from "./editor-app-tools";
import type {
  Atlas3DCommitKind,
  Atlas3DEditorApp,
  Atlas3DEditorAppOptions,
  Atlas3DEditorDocState,
  Atlas3DEditorTool,
} from "./editor-types";
import {
  parseDocFeatures,
  parseDocObjects,
  SceneObjectLayer,
  type DocFeatureState,
  type DocObjectState,
} from "./scene-objects";
import { EditorDecor } from "./editor-decor";
import { OrbitRig } from "./viewport-rig";

export * from "./editor-types";
export type { Atlas3DRegionDraft } from "./region-draft";
export type { CarveOpSummary } from "./carve-tools";

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
  // Nicht-destruktiver Höhen-Layer-Stack; alte Einzel-Heightmap-Stände werden
  // beim Laden zum Basis-Layer migriert. Werkzeuge schreiben in den AKTIVEN
  // Layer, gerendert wird das (gecachte) Composite aller sichtbaren Layer.
  const heightLayerGrid = mode === "globe" ? GLOBE_GRID : PLANAR_GRID;
  const heightLayers = new HeightLayerSession(
    heightLayerGrid[0],
    heightLayerGrid[1],
    options.heightLayers ?? null,
    options.heightmap ?? null,
  );
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
  let localSeq = objects.length + features.length + 1;
  /** Ansicht-Overlay (Klima/Höhe): temporärer Splat, nie Teil des Snapshots. */
  let overlaySplat: SplatGrid | null = null;
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
  let envWeather: string = options.environment?.weather ?? "klar";
  let envSeason: string = options.environment?.season ?? "sommer";
  let envStyle: string = options.stylePreset ?? "pergament";
  let appliedWeather: string | null = null;

  function applyEnvironment(): void {
    applySceneEnvironment(scene, envTimeOfDay, envFogDensity, combineTints(SEASON_TINTS[envSeason], STYLE_TINTS[envStyle]));
    if (envWeather !== appliedWeather) {
      appliedWeather = envWeather;
      decor.updateWeather(envWeather === "wolken" || envWeather === "regen" || envWeather === "schnee" ? envWeather : "klar");
    }
  }

  // region draft (drill-down) — raw surface points + normals, also on the globe
  const regionDraft = new RegionDraftState(mode, decor, options.onRegionDraftChange);

  // tools controller — owns the tool state and everything the tools mutate
  const tools = new EditorToolsController({
    mode,
    seed,
    mapSize: TERRAIN_SIZE,
    getHeightmap: () => heightLayers.activeGrid(),
    getSplat: () => splat,
    getCarveOps: () => carveOps,
    setCarveOps: (ops) => {
      carveOps = ops;
    },
    getObjects: () => objects,
    setObjects: (next) => {
      objects = next;
    },
    getFeatures: () => features,
    setFeatures: (next) => {
      features = next;
    },
    getWaterLevel: () => waterLevel,
    getBrushRadius: () => brushRadius,
    getBrushStrength: () => brushStrength,
    nextLocalId: () => `neu-${localSeq++}`,
    getTerrainField: () => currentTerrainField,
    elevationAt: (dir) => currentPlanetElevation?.(new THREE.Vector3(dir[0], dir[1], dir[2])) ?? 0,
    pickSurface: (event) => pickSurface(event),
    rebuildRest: () => rebuild(restResolution),
    rebuildEdit: () => rebuild(editResolution),
    throttledRemesh: () => throttledRemesh(),
    syncObjects: () => syncObjects(),
    commit: (kind) => commit(kind),
    setOverlaySplat: (next) => {
      overlaySplat = next;
    },
    decor,
    onMeasure: options.onMeasure,
    onPolygonDraftChange: options.onPolygonDraftChange,
  });

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
    const renderSplat = overlaySplat ?? splat;
    // VOR jedem Rebuild: Composite der sichtbaren Layer (gecacht in der Session)
    const heightmap = heightLayers.composite();
    if (mode === "globe") {
      const field = createPlanetField({ seed, heightmap, carveOps });
      currentPlanetElevation = (dir) => field.elevation([dir.x, dir.y, dir.z]);
      data = buildPlanetMeshData(field, { resolution, splat: renderSplat });
    } else {
      const field = createTerrainField({ seed, size: TERRAIN_SIZE, heightmap, carveOps, silhouette, waterLevel });
      currentTerrainField = field;
      data = buildTerrainMeshData(field, { resolution, splat: renderSplat });
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
    tools.onRebuilt(resolution === restResolution);
  }

  function snapshot(): Atlas3DEditorDocState {
    return {
      seed,
      carveOps: parseCarveOps(JSON.parse(JSON.stringify(carveOps))),
      heightmap: heightLayers.compositeJson(),
      heightLayers: heightLayers.toJson(),
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

  function pickSurface(event: PointerEvent): { point: THREE.Vector3; normal: THREE.Vector3 } | null {
    if (!planet) return null;
    raycaster.setFromCamera(pointerNdc(event), camera);
    const hits = raycaster.intersectObject(planet.fill, false);
    if (hits.length === 0) return null;
    const point = hits[0].point.clone();
    // mesh sits untransformed at the origin, so object space ≈ world space
    const fallback = mode === "globe" ? point.clone().normalize() : new THREE.Vector3(0, 1, 0);
    const normal = hits[0].face ? hits[0].face.normal.clone().normalize() : fallback;
    return { point, normal };
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
      applyHeightBrush(heightLayers.activeGrid(), [dir.x, dir.y, dir.z], brushRadius, brushStrength, brushMode);
    } else {
      applyPlanarBrush(heightLayers.activeGrid(), TERRAIN_SIZE, [point.x, point.z], brushRadius, brushStrength, brushMode);
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
    const hit = pickSurface(event);
    if (!hit) return false;
    const point = hit.point;
    // placing/generating tools live in the tools controller (editor-app-tools)
    const delegated = tools.pointerDown(tool, point);
    if (delegated !== null) return delegated;
    if (tool === "raise" || tool === "lower" || tool === "smooth" || tool === "flatten") {
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
      regionDraft.add(point, hit.normal);
      return true;
    }
    if (tool === "bite") {
      carveOps = [...carveOps, makeBiteOp([point.x, point.y, point.z], brushRadius, carveOps.length)];
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
        makeTunnelOp([tunnelEntry.x, tunnelEntry.y, tunnelEntry.z], [point.x, point.y, point.z], brushRadius, carveOps.length),
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
    if (sculpting && (tool === "raise" || tool === "lower" || tool === "smooth" || tool === "flatten")) {
      const hit = pickSurface(event);
      if (hit) applySculptAt(hit.point, tool);
      return;
    }
    if (painting && tool === "biome") {
      const hit = pickSurface(event);
      if (hit) applyBiomeAt(hit.point);
      return;
    }
    if (tools.pointerMove(event)) return;
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
    tools.pointerUp();
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
    decor.tick(time);
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
    ...tools.api(),
    webglAvailable,
    mode,
    setTool(next) {
      tool = next;
      tunnelEntry = null;
      if (next !== "region") regionDraft.clear();
      tools.onToolChange(next);
    },
    setBrush(brush) {
      if (brush.radius !== undefined) brushRadius = Math.min(1.2, Math.max(0.05, brush.radius));
      if (brush.strength !== undefined) brushStrength = Math.min(0.2, Math.max(0.002, brush.strength));
    },
    setBiome(biome) {
      activeBiome = Math.max(0, Math.floor(biome));
    },
    deriveBiomes() {
      if (mode === "globe") {
        const elevationAt = currentPlanetElevation;
        if (!elevationAt) return;
        deriveGlobeBiomes({ splat, seed, elevationAt: (dir) => elevationAt(new THREE.Vector3(dir[0], dir[1], dir[2])) });
      } else {
        const field = currentTerrainField;
        if (!field) return;
        derivePlanarBiomes({ splat, seed, mapSize: TERRAIN_SIZE, heightAt: (x, z) => field.height(x, z), waterLevel });
      }
      rebuild(restResolution);
      commit("biome");
    },
    setGridOverlay(kind) {
      decor.updateGrid(kind);
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
      if (environment.weather !== undefined) envWeather = environment.weather;
      if (environment.season !== undefined) envSeason = environment.season;
      if (environment.stylePreset !== undefined) envStyle = environment.stylePreset;
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
      return regionDraft.toDraft();
    },
    clearRegionDraft() {
      regionDraft.clear();
    },
    listCarveOps() {
      return summarizeCarveOps(carveOps);
    },
    removeCarveOp(id) {
      carveOps = removeCarveOpById(carveOps, id);
      rebuild(restResolution);
      commit("carve");
    },
    listHeightLayers() {
      return heightLayers.list();
    },
    addHeightLayer(name) {
      heightLayers.add(name);
      rebuild(restResolution);
      commit("sculpt");
    },
    removeHeightLayer(id) {
      if (!heightLayers.remove(id)) return;
      rebuild(restResolution);
      commit("sculpt");
    },
    setHeightLayerVisible(id, on) {
      if (!heightLayers.setVisible(id, on)) return;
      rebuild(restResolution);
      commit("sculpt");
    },
    setActiveHeightLayer(id) {
      heightLayers.setActive(id);
    },
    moveHeightLayer(id, dir) {
      if (!heightLayers.move(id, dir)) return;
      // Reihenfolge ändert die Summe nicht — kein Remesh nötig, aber undo-fähig
      commit("sculpt");
    },
    exportImage() {
      if (!renderer) return null;
      // render right before reading — the drawing buffer is not preserved
      renderer.render(scene, camera);
      return canvas.toDataURL("image/png");
    },
    applyExternal(doc) {
      carveOps = parseCarveOps(doc.carveOps);
      // Layer-Stack laden; alte Snapshots ohne heightLayers migrieren aus dem Composite
      heightLayers.load(doc.heightLayers ?? null, doc.heightmap ?? null);
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
