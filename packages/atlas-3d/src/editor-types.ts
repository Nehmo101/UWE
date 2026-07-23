/**
 * Atlas 3D editor contract types — split from editor-app.ts (file-size
 * budget). editor-app re-exports everything, so import paths stay stable.
 */

import type * as THREE from "three";
import type { CarveOp } from "@uwe/atlas-editor/carve";
import type { HeightmapGrid, HeightmapJson } from "./planet-field";
import type { HeightLayerMoveDir, HeightLayersJson } from "./height-layers";
import type { SplatGrid, SplatJson } from "./splat";
import type { DocFeatureState, DocObjectState } from "./scene-objects";
import type { InkAssetKind, InkTint } from "./assets-ink";
import type { CarveOpSummary } from "./carve-tools";
import type { Atlas3DRegionDraft } from "./region-draft";
import type { TerrainStampKind } from "./stamps";
import type { EditorDecor, GridOverlayKind } from "./editor-decor";
import type { TerrainField } from "./terrain-field";
import type { CustomStampGrid } from "./custom-stamp";
import type { LandmassTemplateKind } from "./landmass-templates";
import type { AreaFillKindKey } from "./area-fill";
import type { Atlas3DViewOverlay } from "./editor-view-overlay";

export type Atlas3DEditorMode = "globe" | "terrain";

export type Atlas3DEditorTool =
  | "orbit"
  | "raise"
  | "lower"
  | "smooth"
  | "flatten"
  | "erode"
  | "stamp"
  | "bite"
  | "tunnel"
  | "biome"
  | "region"
  | "asset"
  | "scatter"
  | "select"
  | "river"
  | "road"
  | "label"
  | "settlement"
  | "lake"
  | "fill"
  | "wall"
  | "warp"
  | "measure"
  | "spring"
  | "territory"
  | "poi";

/** Stempel-Art: Profil (Krater · Gebirge · Dünen), eigener PNG-Stempel oder Mutation. */
export type Atlas3DStampChoice = TerrainStampKind | "eigen" | "mutation";

export interface Atlas3DEditorDocState {
  seed: number;
  carveOps: CarveOp[];
  /** COMPOSITE aller sichtbaren Höhen-Layer — Abwärtskompatibilität (Portal + alte Stände). */
  heightmap: HeightmapJson | null;
  /** Voller nicht-destruktiver Höhen-Layer-Stack (null nur bei ganz alten Ständen). */
  heightLayers: HeightLayersJson | null;
  splat: SplatJson | null;
  splitGap: number;
  /** World-root count bridging the split gap (renderer default when no split). */
  worldRoots: number;
  objects: DocObjectState[];
  features: DocFeatureState[];
}

export type Atlas3DCommitKind = "sculpt" | "carve" | "split" | "biome" | "objects" | "features";

export interface Atlas3DEditorAppOptions {
  mode: Atlas3DEditorMode;
  seed: number;
  carveOps?: unknown;
  heightmap?: unknown;
  /** Persistierter Höhen-Layer-Stack; fehlt er, wird `heightmap` als Basis-Layer migriert. */
  heightLayers?: unknown;
  splat?: unknown;
  objects?: unknown;
  features?: unknown;
  /** Terrain mode: inherited parent silhouette (2D polygon json) + water level. */
  silhouette?: unknown;
  waterLevel?: number;
  /** Inherited atmosphere: time-of-day key + fog density [0..1] + weather + season. */
  environment?: { timeOfDay?: string; fogDensity?: number; weather?: string; season?: string };
  /** Inherited style preset (pergament · sepia · aquarell) — tints the Tuschelagen. */
  stylePreset?: string;
  /** Portal viewer: orbit/pan only, no editing tools, no commits. */
  readOnly?: boolean;
  resolution?: number;
  editResolution?: number;
  worldRootCount?: number;
  onCommit?: (kind: Atlas3DCommitKind, doc: Atlas3DEditorDocState) => void;
  onRegionDraftChange?: (pointCount: number) => void;
  onSelectionChange?: (count: number) => void;
  /** Mess-Werkzeug: Wegstunden nach dem zweiten Klick, null beim Zurücksetzen. */
  onMeasure?: (wegstunden: number | null) => void;
  /** Polygon-Draft der Fläche-/Gebiet-Werkzeuge (Punktzähler der Panels). */
  onPolygonDraftChange?: (pointCount: number) => void;
  onReady?: (info: { webgl: boolean }) => void;
}

/**
 * Zugriff des Tools-Controllers auf den Editor-Zustand (Closures in
 * editor-app) — geteilt von editor-app-tools und editor-place-tools.
 */
export interface EditorToolsContext {
  mode: Atlas3DEditorMode;
  seed: number;
  mapSize: number;
  getHeightmap(): HeightmapGrid;
  getSplat(): SplatGrid;
  getCarveOps(): CarveOp[];
  setCarveOps(ops: CarveOp[]): void;
  getObjects(): DocObjectState[];
  setObjects(objects: DocObjectState[]): void;
  getFeatures(): DocFeatureState[];
  setFeatures(features: DocFeatureState[]): void;
  getWaterLevel(): number;
  getBrushRadius(): number;
  getBrushStrength(): number;
  nextLocalId(): string;
  getTerrainField(): TerrainField | null;
  elevationAt(dir: readonly [number, number, number]): number;
  pickSurface(event: PointerEvent): { point: THREE.Vector3; normal: THREE.Vector3 } | null;
  rebuildRest(): void;
  rebuildEdit(): void;
  throttledRemesh(): void;
  syncObjects(): void;
  commit(kind: Atlas3DCommitKind): void;
  setOverlaySplat(splat: SplatGrid | null): void;
  decor: EditorDecor;
  onMeasure?: (wegstunden: number | null) => void;
  onPolygonDraftChange?: (pointCount: number) => void;
}

/** Tool-side editor API — implemented by the tools controller, spread into the app. */
export interface Atlas3DEditorToolsApi {
  setAsset(asset: { kind?: InkAssetKind; tint?: InkTint }): void;
  setLabelText(text: string): void;
  /** Stamp choice for the "stamp" tool: Profil, "eigen" (custom PNG) oder "mutation". */
  setStamp(kind: Atlas3DStampChoice): void;
  /** Constraints for the settlement generator (walls, citadel, WFC layout). */
  setSettlementOptions(options: { walls?: boolean; citadel?: boolean; wfc?: boolean }): void;
  /** Straße säumen: Bäume beidseitig entlang neuer Straßen (ein Commit mit dem Pfad). */
  setRoadTreesEnabled(on: boolean): void;
  /** Globale Erosion über die ganze Höhenkarte — commits "sculpt", undoable. */
  applyErosionPass(featureSize: number): void;
  /** Landmassen-Vorlage: ÜBERSCHREIBT die Höhenkarte — commits "sculpt", undoable. */
  applyLandmass(kind: LandmassTemplateKind): void;
  /** Eigener Graustufen-Stempel für die Stempel-Art "eigen" (null entfernt ihn). */
  setCustomStamp(stamp: CustomStampGrid | null): void;
  /** Non-destructive Eingriffe-Stack: Op aus-/einblenden — commits "carve", undoable. */
  setCarveOpDisabled(id: string, disabled: boolean): void;
  /** Ansicht Karte/Klima/Höhe — reine Vorschau, kein Commit. */
  setViewOverlay(mode: Atlas3DViewOverlay): void;
  /** Höhenlinien-Overlay (flat levels, view-only). */
  setContoursVisible(on: boolean): void;
  /** Fläche füllen: Polygon-Draft mit der gewählten Art ausmalen — commits "objects". */
  fillAreaDraft(kind: AreaFillKindKey): void;
  /** Gebiet aus dem Polygon-Draft anlegen — commits "features". */
  createTerritory(options: { tint: string; labelText?: string }): void;
  /** Punkte des Fläche-/Gebiet-Drafts verwerfen. */
  clearPolygonDraft(): void;
}

/** Eintrag der Höhen-Layer-Liste (UI-Panel). */
export interface Atlas3DHeightLayerItem {
  id: string;
  name: string;
  visible: boolean;
  active: boolean;
}

export interface Atlas3DEditorApp extends Atlas3DEditorToolsApi {
  readonly webglAvailable: boolean;
  readonly mode: Atlas3DEditorMode;
  setTool(tool: Atlas3DEditorTool): void;
  setBrush(brush: { radius?: number; strength?: number }): void;
  setBiome(biome: number): void;
  /** Derive biomes from elevation × climate into the splat — commits "biome", undoable. */
  deriveBiomes(): void;
  /** View-only square/hex grid overlay (flat levels; not persisted). */
  setGridOverlay(kind: GridOverlayKind): void;
  deleteSelection(): void;
  /** Live split previews (gap + world-root sliders) — call commitSplit() on release. */
  setSplitGap(gap: number): void;
  setWorldRoots(count: number): void;
  commitSplit(): void;
  /** Visual water level (inherited/overridden via inspector — not undoable here). */
  setWaterLevel(level: number): void;
  /** Live atmosphere preview (inherited/overridden via inspector). */
  setEnvironmentVisuals(environment: {
    timeOfDay?: string;
    fogDensity?: number;
    weather?: string;
    season?: string;
    stylePreset?: string;
  }): void;
  getCameraPose(): { theta: number; phi: number; distance: number; target: [number, number, number] };
  flyTo(pose: { theta?: number; phi?: number; distance?: number; target?: [number, number, number] }, durationMs?: number): void;
  getRegionDraft(): Atlas3DRegionDraft | null;
  clearRegionDraft(): void;
  /** Ordered carve-op summaries for the "Eingriffe" list. */
  listCarveOps(): CarveOpSummary[];
  /** Remove one carve op by id — commits "carve", undoable via the command stack. */
  removeCarveOp(id: string): void;
  /** Höhen-Layer-Stack in Reihenfolge, mit Sichtbarkeit + Aktiv-Markierung. */
  listHeightLayers(): Atlas3DHeightLayerItem[];
  /** Neuen (leeren) Höhen-Layer anlegen und aktivieren — commits "sculpt", undoable. */
  addHeightLayer(name: string): void;
  /** Höhen-Layer entfernen (der letzte ist unlöschbar) — commits "sculpt", undoable. */
  removeHeightLayer(id: string): void;
  /** Höhen-Layer ein-/ausblenden (Composite ändert sich) — commits "sculpt", undoable. */
  setHeightLayerVisible(id: string, on: boolean): void;
  /** Aktiven Layer wählen — reine UI, KEIN Commit. */
  setActiveHeightLayer(id: string): void;
  /** Layer in der Liste verschieben ("hoch" = Richtung Anfang) — commits "sculpt". */
  moveHeightLayer(id: string, dir: HeightLayerMoveDir): void;
  /** Fresh render → PNG data URL (null without WebGL). */
  exportImage(): string | null;
  applyExternal(doc: Atlas3DEditorDocState): void;
  getDocSnapshot(): Atlas3DEditorDocState;
  dispose(): void;
}

export type { WeatherKind, GridOverlayKind } from "./editor-decor";
export type { HeightLayerMoveDir, HeightLayersJson } from "./height-layers";
export type { TerrainStampKind } from "./stamps";
export type { CustomStampGrid } from "./custom-stamp";
export type { LandmassTemplateKind } from "./landmass-templates";
export type { AreaFillKindKey } from "./area-fill";
export type { Atlas3DViewOverlay } from "./editor-view-overlay";
