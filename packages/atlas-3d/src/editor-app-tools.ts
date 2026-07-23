/**
 * Editor tools controller — Werkzeug- und Generator-Logik des Atlas-3D-Editors,
 * aus editor-app.ts ausgelagert (file-size budget). Der Controller besitzt den
 * Werkzeug-Zustand (Asset-Wahl, Stempel-Art, Drafts, Warp/Mess-Zustand) und
 * mutiert das Dokument ausschließlich über den EditorToolsContext, den
 * editor-app bereitstellt; Commits laufen dort über den Command-Stack.
 */

import * as THREE from "three";
import { dirToUv } from "./planet-field";
import { applyPlanarBrush, mapToUv } from "./terrain-field";
import { INK_ASSET_DEFAULT_TINT, isInkAssetKind, isInkTint, type InkAssetKind, type InkTint } from "./assets-ink";
import { applyGlobeStamp, applyPlanarStamp, mutateRegionGlobe, mutateRegionPlanar, type TerrainStampKind } from "./stamps";
import { applyCustomStampGlobe, applyCustomStampPlanar, type CustomStampGrid } from "./custom-stamp";
import { applyErosionBrush, erodeHeightmap } from "./erosion";
import { carveRiverChannel, traceRiver } from "./hydrology";
import { computeContours } from "./contours";
import { applyLandmassTemplate, type LandmassTemplateKind } from "./landmass-templates";
import { fillArea, type AreaFillKindKey } from "./area-fill";
import { buildWallSegment } from "./walls";
import { warpObjects } from "./warp";
import { buildOverlaySplat, type Atlas3DViewOverlay } from "./editor-view-overlay";
import type { DocObjectState } from "./scene-objects";
import { handlePathClick, placeAsset, placeSettlement, scatterAt, type PlacementState } from "./editor-place-tools";
import type {
  Atlas3DEditorTool,
  Atlas3DEditorToolsApi,
  Atlas3DStampChoice,
  EditorToolsContext,
} from "./editor-types";

export type { EditorToolsContext } from "./editor-types";

/** Faktor Karte: 1 Map-Einheit = 24 Wegstunden; Globus: 1 rad Bogen = 120 Wegstunden. */
const WEGSTUNDEN_PER_MAP_UNIT = 24;
const WEGSTUNDEN_PER_RADIAN = 120;
/** See-Werkzeug: Senke wird bis auf Wasserstand − 0.08 abgesenkt. */
const LAKE_DEPTH_BELOW_WATER = 0.08;

/** Werkzeuge, deren Pointer-Down der Controller behandelt. */
const CONTROLLER_TOOLS: ReadonlySet<Atlas3DEditorTool> = new Set([
  "asset",
  "scatter",
  "river",
  "road",
  "label",
  "settlement",
  "stamp",
  "erode",
  "lake",
  "fill",
  "wall",
  "warp",
  "measure",
  "spring",
  "territory",
  "poi",
]);

export class EditorToolsController implements Atlas3DEditorToolsApi {
  private readonly ctx: EditorToolsContext;
  private readonly placement: PlacementState = {
    assetKind: "tree",
    assetTint: INK_ASSET_DEFAULT_TINT.tree,
    settlementWalls: false,
    settlementCitadel: false,
    roadTrees: false,
  };
  private labelText = "";
  private stampChoice: Atlas3DStampChoice = "krater";
  private customStamp: CustomStampGrid | null = null;
  private pathStart: { x: number; z: number } | null = null;
  private wallStart: { x: number; z: number } | null = null;
  private measureStart: THREE.Vector3 | null = null;
  private polyDraft: THREE.Vector3[] = [];
  private eroding = false;
  private erodeDirty = false;
  private warpState: { base: DocObjectState[]; start: THREE.Vector3; moved: boolean } | null = null;
  private contoursVisible = false;

  constructor(ctx: EditorToolsContext) {
    this.ctx = ctx;
  }

  /** Gebundene Tool-API zum Spreaden in das Atlas3DEditorApp-Objekt. */
  api(): Atlas3DEditorToolsApi {
    return {
      setAsset: (asset) => this.setAsset(asset),
      setLabelText: (text) => this.setLabelText(text),
      setStamp: (kind) => this.setStamp(kind),
      setSettlementOptions: (options) => this.setSettlementOptions(options),
      setRoadTreesEnabled: (on) => this.setRoadTreesEnabled(on),
      applyErosionPass: (featureSize) => this.applyErosionPass(featureSize),
      applyLandmass: (kind) => this.applyLandmass(kind),
      setCustomStamp: (stamp) => this.setCustomStamp(stamp),
      setCarveOpDisabled: (id, disabled) => this.setCarveOpDisabled(id, disabled),
      setViewOverlay: (mode) => this.setViewOverlay(mode),
      setContoursVisible: (on) => this.setContoursVisible(on),
      fillAreaDraft: (kind) => this.fillAreaDraft(kind),
      createTerritory: (options) => this.createTerritory(options),
      clearPolygonDraft: () => this.clearPolygonDraft(),
    };
  }

  // --- Werkzeug-Zustand (Panels) ---

  setAsset(asset: { kind?: InkAssetKind; tint?: InkTint }): void {
    if (asset.kind !== undefined) {
      this.placement.assetKind = asset.kind;
      this.placement.assetTint = INK_ASSET_DEFAULT_TINT[asset.kind];
    }
    if (asset.tint !== undefined) this.placement.assetTint = asset.tint;
  }

  setLabelText(text: string): void {
    this.labelText = text;
  }

  setStamp(kind: Atlas3DStampChoice): void {
    this.stampChoice = kind;
  }

  setSettlementOptions(options: { walls?: boolean; citadel?: boolean }): void {
    if (options.walls !== undefined) this.placement.settlementWalls = options.walls;
    if (options.citadel !== undefined) this.placement.settlementCitadel = options.citadel;
  }

  setRoadTreesEnabled(on: boolean): void {
    this.placement.roadTrees = on;
  }

  setCustomStamp(stamp: CustomStampGrid | null): void {
    this.customStamp = stamp;
  }

  /** Werkzeugwechsel: halbfertige Zwei-Klick-/Drag-Zustände verwerfen. */
  onToolChange(next: Atlas3DEditorTool): void {
    this.pathStart = null;
    this.wallStart = null;
    this.eroding = false;
    this.warpState = null;
    if (this.measureStart) {
      this.measureStart = null;
      this.ctx.onMeasure?.(null);
    }
    if (next !== "fill" && next !== "territory") this.clearPolygonDraft();
  }

  // --- Pointer-Dispatch (von editor-app aufgerufen) ---

  /** Down mit Oberflächen-Treffer; null = Werkzeug gehört nicht dem Controller. */
  pointerDown(tool: Atlas3DEditorTool, point: THREE.Vector3): boolean | null {
    if (!CONTROLLER_TOOLS.has(tool)) return null;
    const ctx = this.ctx;
    switch (tool) {
      case "asset":
        placeAsset(ctx, this.placement, point);
        return true;
      case "scatter":
        scatterAt(ctx, this.placement, point);
        return true;
      case "river":
      case "road":
        this.pathStart = handlePathClick(ctx, this.placement, this.pathStart, point, tool);
        return true;
      case "label":
        this.addPointFeature(point, "label", this.labelText);
        return true;
      case "poi":
        this.addPointFeature(point, "poi", this.labelText);
        return true;
      case "settlement":
        placeSettlement(ctx, this.placement, point);
        return true;
      case "stamp":
        return this.applyStamp(point);
      case "erode":
        this.eroding = true;
        this.erodeDirty = false;
        this.applyErodeAt(point);
        return true;
      case "lake":
        return this.placeLake(point);
      case "spring":
        return this.placeSpring(point);
      case "wall":
        return this.handleWallClick(point);
      case "fill":
      case "territory":
        this.polyDraft.push(point.clone());
        ctx.decor.updateRegionMarkers(this.polyDraft);
        ctx.onPolygonDraftChange?.(this.polyDraft.length);
        return true;
      case "measure":
        return this.handleMeasureClick(point);
      case "warp":
        this.warpState = { base: ctx.getObjects(), start: point.clone(), moved: false };
        return true;
      default:
        return null;
    }
  }

  /** Move-Fortsetzung für Erosions-Pinsel und Warp-Drag. */
  pointerMove(event: PointerEvent): boolean {
    if (this.eroding) {
      const hit = this.ctx.pickSurface(event);
      if (hit) this.applyErodeAt(hit.point);
      return true;
    }
    if (this.warpState) {
      const hit = this.ctx.pickSurface(event);
      if (hit) this.applyWarpTo(hit.point);
      return true;
    }
    return false;
  }

  pointerUp(): void {
    if (this.eroding) {
      this.eroding = false;
      if (this.erodeDirty) {
        this.erodeDirty = false;
        this.ctx.rebuildRest();
        this.ctx.commit("sculpt");
      }
    }
    if (this.warpState) {
      const moved = this.warpState.moved;
      this.warpState = null;
      if (moved) this.ctx.commit("objects");
    }
  }

  /** Nach vollem Rebuild (rest-Auflösung) die Höhenlinien nachziehen. */
  onRebuilt(fullResolution: boolean): void {
    if (fullResolution && this.contoursVisible) this.refreshContours();
  }

  /** Punkt-Feature (Label oder POI); auf dem Globus wandert die Richtung in x/z. */
  private addPointFeature(point: THREE.Vector3, kind: "label" | "poi", labelText: string): void {
    const ctx = this.ctx;
    const at = this.featurePoint(point);
    ctx.setFeatures([...ctx.getFeatures(), { localId: ctx.nextLocalId(), kind, points: [at], labelText }]);
    ctx.syncObjects();
    ctx.commit("features");
  }

  /** Feature-Punktformat: Terrain roh, Globus als normalisierte Richtung (x/z). */
  private featurePoint(point: THREE.Vector3): { x: number; z: number } {
    if (this.ctx.mode === "terrain") return { x: point.x, z: point.z };
    const dir = point.clone().normalize();
    return { x: dir.x, z: dir.z };
  }

  // --- Stempel (Profil · eigen · Mutation) ---

  private applyStamp(point: THREE.Vector3): boolean {
    const ctx = this.ctx;
    const heightmap = ctx.getHeightmap();
    const radius = ctx.getBrushRadius();
    const strength = Math.max(0.03, ctx.getBrushStrength() * 3);
    const choice = this.stampChoice;
    if (choice === "mutation") {
      if (ctx.mode === "globe") {
        const dir = point.clone().normalize();
        mutateRegionGlobe(heightmap, [dir.x, dir.y, dir.z], radius, ctx.seed);
      } else {
        mutateRegionPlanar(heightmap, ctx.mapSize, [point.x, point.z], radius, ctx.seed);
      }
    } else if (choice === "eigen") {
      if (!this.customStamp) return true;
      if (ctx.mode === "globe") {
        const dir = point.clone().normalize();
        applyCustomStampGlobe(heightmap, [dir.x, dir.y, dir.z], this.customStamp, radius, strength);
      } else {
        applyCustomStampPlanar(heightmap, ctx.mapSize, [point.x, point.z], this.customStamp, radius, strength);
      }
    } else {
      const kind: TerrainStampKind = choice;
      if (ctx.mode === "globe") {
        const dir = point.clone().normalize();
        applyGlobeStamp(heightmap, [dir.x, dir.y, dir.z], { kind, radius, strength });
      } else {
        applyPlanarStamp(heightmap, ctx.mapSize, [point.x, point.z], { kind, radius, strength });
      }
    }
    ctx.rebuildRest();
    ctx.commit("sculpt");
    return true;
  }

  // --- Erosion (Pinsel + globaler Pass) ---

  private applyErodeAt(point: THREE.Vector3): void {
    const ctx = this.ctx;
    const grid = ctx.getHeightmap();
    if (ctx.mode === "globe") {
      const dir = point.clone().normalize();
      const [u, v] = dirToUv([dir.x, dir.y, dir.z]);
      const radiusTexels = (ctx.getBrushRadius() / Math.PI) * grid.height;
      applyErosionBrush(grid, [u * grid.width, v * grid.height], radiusTexels);
    } else {
      const [u, v] = mapToUv(point.x, point.z, ctx.mapSize);
      const radiusTexels = (ctx.getBrushRadius() / (ctx.mapSize * 2)) * grid.width;
      applyErosionBrush(grid, [u * (grid.width - 1), v * (grid.height - 1)], radiusTexels);
    }
    this.erodeDirty = true;
    ctx.throttledRemesh();
  }

  applyErosionPass(featureSize: number): void {
    erodeHeightmap(this.ctx.getHeightmap(), { featureSize });
    this.ctx.rebuildRest();
    this.ctx.commit("sculpt");
  }

  applyLandmass(kind: LandmassTemplateKind): void {
    applyLandmassTemplate(this.ctx.getHeightmap(), kind, this.ctx.seed, this.ctx.mode === "globe");
    this.ctx.rebuildRest();
    this.ctx.commit("sculpt");
  }

  // --- Gewässer ---

  private placeLake(point: THREE.Vector3): boolean {
    const ctx = this.ctx;
    const field = ctx.getTerrainField();
    if (ctx.mode !== "terrain" || !field) return true;
    const waterLevel = ctx.getWaterLevel();
    const depth = field.height(point.x, point.z) - (waterLevel - LAKE_DEPTH_BELOW_WATER);
    if (depth > 0) {
      applyPlanarBrush(ctx.getHeightmap(), ctx.mapSize, [point.x, point.z], ctx.getBrushRadius(), depth, "lower");
    }
    ctx.setFeatures([
      ...ctx.getFeatures(),
      { localId: ctx.nextLocalId(), kind: "lake", points: [{ x: point.x, z: point.z }], level: waterLevel },
    ]);
    ctx.syncObjects();
    ctx.rebuildRest();
    ctx.commit("features");
    return true;
  }

  private placeSpring(point: THREE.Vector3): boolean {
    const ctx = this.ctx;
    const field = ctx.getTerrainField();
    if (ctx.mode !== "terrain" || !field) return true;
    const path = traceRiver({
      heightAt: (x, z) => field.height(x, z),
      start: [point.x, point.z],
      mapSize: ctx.mapSize,
      waterLevel: ctx.getWaterLevel(),
    });
    if (path.length < 2) return true;
    carveRiverChannel(ctx.getHeightmap(), ctx.mapSize, path);
    ctx.setFeatures([
      ...ctx.getFeatures(),
      { localId: ctx.nextLocalId(), kind: "river", points: path.map((p) => ({ x: p.x, z: p.z })) },
    ]);
    ctx.syncObjects();
    ctx.rebuildRest();
    ctx.commit("features");
    return true;
  }

  // --- Mauer (2 Klicks) ---

  private handleWallClick(point: THREE.Vector3): boolean {
    const ctx = this.ctx;
    if (ctx.mode !== "terrain") return true;
    if (!this.wallStart) {
      this.wallStart = { x: point.x, z: point.z };
      return true;
    }
    const result = buildWallSegment({
      from: this.wallStart,
      to: { x: point.x, z: point.z },
      seed: ctx.seed,
      idPrefix: ctx.nextLocalId(),
    });
    this.wallStart = null;
    ctx.setObjects([
      ...ctx.getObjects(),
      ...result.objects.map((tower) => ({
        localId: tower.localId,
        assetKind: tower.assetKind as InkAssetKind,
        tint: tower.tint as InkTint,
        position: { x: tower.position.x, z: tower.position.z },
        scale: tower.scale,
        rotation: tower.rotation,
      })),
    ]);
    ctx.setFeatures([
      ...ctx.getFeatures(),
      ...result.features.map((wall) => ({ localId: wall.localId, kind: wall.kind, points: wall.points })),
    ]);
    ctx.syncObjects();
    ctx.commit("objects");
    return true;
  }

  // --- Warp (Drag) ---

  private applyWarpTo(current: THREE.Vector3): void {
    const ctx = this.ctx;
    const state = this.warpState;
    if (!state) return;
    let center: [number, number, number];
    let delta: [number, number, number];
    if (ctx.mode === "globe") {
      const startDir = state.start.clone().normalize();
      const currentDir = current.clone().normalize();
      center = [startDir.x, startDir.y, startDir.z];
      delta = [currentDir.x - startDir.x, currentDir.y - startDir.y, currentDir.z - startDir.z];
    } else {
      center = [state.start.x, 0, state.start.z];
      delta = [current.x - state.start.x, 0, current.z - state.start.z];
    }
    const moved = warpObjects({ objects: state.base, mode: ctx.mode, center, delta, radius: ctx.getBrushRadius() });
    state.moved = true;
    ctx.setObjects(
      state.base.map((object) => {
        const position = moved.get(object.localId);
        return position ? { ...object, position } : object;
      }),
    );
    ctx.syncObjects();
  }

  // --- Messen (2 Klicks) ---

  private handleMeasureClick(point: THREE.Vector3): boolean {
    const ctx = this.ctx;
    if (!this.measureStart) {
      this.measureStart = point.clone();
      ctx.onMeasure?.(null);
      return true;
    }
    let wegstunden: number;
    if (ctx.mode === "globe") {
      const a = this.measureStart.clone().normalize();
      const b = point.clone().normalize();
      const angle = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
      wegstunden = angle * WEGSTUNDEN_PER_RADIAN;
    } else {
      wegstunden = Math.hypot(point.x - this.measureStart.x, point.z - this.measureStart.z) * WEGSTUNDEN_PER_MAP_UNIT;
    }
    this.measureStart = null;
    ctx.onMeasure?.(wegstunden);
    return true;
  }

  // --- Fläche & Gebiet (Polygon-Draft) ---

  clearPolygonDraft(): void {
    if (this.polyDraft.length === 0) return;
    this.polyDraft = [];
    this.ctx.decor.updateRegionMarkers([]);
    this.ctx.onPolygonDraftChange?.(0);
  }

  fillAreaDraft(kind: AreaFillKindKey): void {
    const ctx = this.ctx;
    if (ctx.mode !== "terrain" || this.polyDraft.length < 3) return;
    const polygon = this.polyDraft.map((p): [number, number] => [p.x, p.z]);
    const instances = fillArea({ polygon, kind, seed: ctx.seed });
    ctx.setObjects([
      ...ctx.getObjects(),
      ...instances
        .filter((instance) => isInkAssetKind(instance.assetKind) && isInkTint(instance.tint))
        .map((instance) => ({
          localId: ctx.nextLocalId(),
          assetKind: instance.assetKind as InkAssetKind,
          tint: instance.tint as InkTint,
          position: { x: instance.x, z: instance.z },
          scale: instance.scale,
          rotation: instance.rotation,
        })),
    ]);
    this.clearPolygonDraft();
    ctx.syncObjects();
    ctx.commit("objects");
  }

  createTerritory(options: { tint: string; labelText?: string }): void {
    const ctx = this.ctx;
    if (this.polyDraft.length < 3) return;
    const points = this.polyDraft.map((p) => this.featurePoint(p));
    const labelText = options.labelText?.trim();
    ctx.setFeatures([
      ...ctx.getFeatures(),
      {
        localId: ctx.nextLocalId(),
        kind: "territory",
        points,
        tint: options.tint,
        labelText: labelText && labelText.length > 0 ? labelText : undefined,
      },
    ]);
    this.clearPolygonDraft();
    ctx.syncObjects();
    ctx.commit("features");
  }

  // --- Eingriffe (non-destruktiv) ---

  setCarveOpDisabled(id: string, disabled: boolean): void {
    const ctx = this.ctx;
    ctx.setCarveOps(
      ctx.getCarveOps().map((op) => (op.id === id ? { ...op, disabled: disabled || undefined } : op)),
    );
    ctx.rebuildRest();
    ctx.commit("carve");
  }

  // --- Ansicht (Overlay + Höhenlinien; reine Vorschau) ---

  setViewOverlay(mode: Atlas3DViewOverlay): void {
    const ctx = this.ctx;
    if (mode === "karte") {
      ctx.setOverlaySplat(null);
      ctx.rebuildRest();
      return;
    }
    const base = ctx.getSplat();
    const field = ctx.getTerrainField();
    ctx.setOverlaySplat(
      buildOverlaySplat({
        mode: ctx.mode,
        overlay: mode,
        width: base.width,
        height: base.height,
        mapSize: ctx.mapSize,
        waterLevel: ctx.mode === "terrain" ? ctx.getWaterLevel() : 0,
        heightAt: field ? (x, z) => field.height(x, z) : undefined,
        elevationAt: (dir) => ctx.elevationAt(dir),
      }),
    );
    ctx.rebuildEdit();
  }

  setContoursVisible(on: boolean): void {
    this.contoursVisible = on;
    this.refreshContours();
  }

  private refreshContours(): void {
    const ctx = this.ctx;
    const field = ctx.mode === "terrain" ? ctx.getTerrainField() : null;
    if (!this.contoursVisible || !field) {
      ctx.decor.updateContours(null);
      return;
    }
    const heightAt = (x: number, z: number) => field.height(x, z);
    const { segments } = computeContours({ heightAt, mapSize: ctx.mapSize });
    const points: THREE.Vector3[] = [];
    for (const [x1, z1, x2, z2] of segments) {
      const y = (heightAt(x1, z1) + heightAt(x2, z2)) / 2 + 0.02;
      points.push(new THREE.Vector3(x1, y, z1), new THREE.Vector3(x2, y, z2));
    }
    ctx.decor.updateContours(points);
  }
}
