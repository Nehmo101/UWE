/**
 * Atlas 3D editor contract types — split from editor-app.ts (file-size
 * budget). editor-app re-exports everything, so import paths stay stable.
 */

import type { CarveOp } from "@uwe/atlas-editor/carve";
import type { HeightmapJson } from "./planet-field";
import type { SplatJson } from "./splat";
import type { DocFeatureState, DocObjectState } from "./scene-objects";
import type { InkAssetKind, InkTint } from "./assets-ink";
import type { CarveOpSummary } from "./carve-tools";
import type { Atlas3DRegionDraft } from "./region-draft";
import type { TerrainStampKind } from "./stamps";
import type { GridOverlayKind } from "./editor-decor";

export type Atlas3DEditorMode = "globe" | "terrain";

export type Atlas3DEditorTool =
  | "orbit"
  | "raise"
  | "lower"
  | "smooth"
  | "flatten"
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
  /** Inherited atmosphere: time-of-day key + fog density [0..1] + weather. */
  environment?: { timeOfDay?: string; fogDensity?: number; weather?: string };
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
  /** Stamp profile for the "stamp" tool (Krater · Gebirge · Dünen). */
  setStamp(kind: TerrainStampKind): void;
  /** Constraints for the settlement generator (walls, citadel). */
  setSettlementOptions(options: { walls?: boolean; citadel?: boolean }): void;
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
  setEnvironmentVisuals(environment: { timeOfDay?: string; fogDensity?: number; weather?: string }): void;
  getCameraPose(): { theta: number; phi: number; distance: number; target: [number, number, number] };
  flyTo(pose: { theta?: number; phi?: number; distance?: number; target?: [number, number, number] }, durationMs?: number): void;
  getRegionDraft(): Atlas3DRegionDraft | null;
  clearRegionDraft(): void;
  /** Ordered carve-op summaries for the "Eingriffe" list. */
  listCarveOps(): CarveOpSummary[];
  /** Remove one carve op by id — commits "carve", undoable via the command stack. */
  removeCarveOp(id: string): void;
  /** Fresh render → PNG data URL (null without WebGL). */
  exportImage(): string | null;
  applyExternal(doc: Atlas3DEditorDocState): void;
  getDocSnapshot(): Atlas3DEditorDocState;
  dispose(): void;
}

export type { WeatherKind, GridOverlayKind } from "./editor-decor";
export type { TerrainStampKind } from "./stamps";
