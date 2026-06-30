"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  TOLKIEN_INK,
  type AtlasStylePreset,
} from "@uwe/atlas/style-presets";
import { BiomeKind } from "@uwe/atlas/constants";
import {
  scatterGlyphsInPolygon,
  scatterGlyphsAlongPath,
  buildReliefShading,
} from "@uwe/atlas/terrain";
import { layoutCharactersOnPath } from "@uwe/atlas/label-layout";
import {
  saveAtlasFeaturesAction,
  saveAtlasObjectsAction,
  createChildNodeAction,
  linkPinToPageAction,
  createPinPageAction,
  createAtlasHandoutPageAction,
  setNodeBackgroundAssetAction,
  approveAtlasPaletteItemAction,
  deleteAtlasPaletteItemAction,
  setAtlasNodeVisibilityAction,
  setAtlasMapVisibilityAction,
} from "@/app/atlas-actions";
import { ProceduralDraftPanel } from "./ProceduralDraftPanel";
import { RegionDescribePanel } from "./RegionDescribePanel";
import { AtlasStampGenerator } from "./AtlasStampGenerator";

// ---------------------------------------------------------------------------
// Types shared in this module
// ---------------------------------------------------------------------------

export type ToolMode =
  | "select"
  | "polygon"
  | "path"
  | "biome"
  | "road"
  | "label"
  | "curvedLabel"
  | "pin"
  | "stamp"
  | "eraser"
  | "measure";

export type LabelColor = "black" | "red";

export interface FeatureGeometry {
  type: "Point" | "Path" | "Polygon" | "LabelAnchor";
  coordinates?: [number, number] | [number, number][];
  rings?: [number, number][][];
  text?: string;
  rotation?: number;
  pathCoordinates?: [number, number][];
  pathReversed?: boolean;
  closed?: boolean;
}

export interface BiomeStyle {
  biomeKind: BiomeKind;
  density: number;
}

export interface EditorFeature {
  id?: string;
  kind: "region" | "river" | "road" | "biome" | "relief" | "label" | "pin";
  geometry: FeatureGeometry;
  style?: Record<string, unknown>;
  labelText?: string | null;
  labelColor?: LabelColor | null;
  /** DB-persisted child node id (drill-down target). */
  childNodeId?: string | null;
  /** Linked wiki page id (for pins and regions). */
  linkedPageId?: string | null;
  /** Resolved Studio URL for the linked wiki page (by slug/type). */
  linkedPageHref?: string | null;
  layer?: number;
  sortOrder?: number;
  visibility?: string;
  /** client-only stable key */
  _key: string;
}

export interface EditorObject {
  id?: string;
  paletteItemId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  layer?: number;
  visibility?: string;
  _key: string;
}

// ---------------------------------------------------------------------------
// Builtin glyph palette (hardcoded SVG paths for MVP)
// ---------------------------------------------------------------------------

export interface BuiltinGlyph {
  key: string;
  name: string;
  kind: string;
  /** SVG path data — drawn centred at (0,0) in a 24×24 viewBox. */
  pathData: string;
  color?: string;
}

/**
 * Combined palette item — covers both builtin SVG glyphs and DB-stored
 * AI-generated stamp images (source=ai).
 */
export interface EditorPaletteItem {
  /** DB palette item id — ALWAYS the real `AtlasPaletteItem.id` (cuid), for every source. */
  id: string;
  name: string;
  kind: string;
  source: "builtin" | "ai" | "upload";
  reviewStatus: "approved" | "pending";
  /** Glyph key (e.g. "mountain") for builtin items — maps to a local BUILTIN_GLYPHS entry. */
  builtinGlyphKey?: string | null;
  /** SVG path data — present for builtin glyphs. */
  pathData?: string;
  color?: string;
  /** Base64 image data — present for AI stamps. */
  imageData?: string;
  mimeType?: string;
}

export const BUILTIN_GLYPHS: BuiltinGlyph[] = [
  {
    key: "mountain",
    name: "Berg",
    kind: "relief",
    pathData: "M12 2 L22 20 L2 20 Z M7 20 L12 10 L17 20",
    color: "#7a6b52",
  },
  {
    key: "mountain_snow",
    name: "Schneeberg",
    kind: "relief",
    pathData: "M12 2 L22 20 L2 20 Z M9 11 L12 6 L15 11 Z",
    color: "#a8b8c4",
  },
  {
    key: "tree",
    name: "Wald",
    kind: "biome",
    pathData: "M12 3 L19 17 L5 17 Z M12 17 L12 22 M10 22 L14 22",
    color: "#4a6741",
  },
  {
    key: "city",
    name: "Stadt",
    kind: "pin",
    pathData: "M7 22 L7 12 L9 12 L9 10 L11 10 L11 8 L13 8 L13 10 L15 10 L15 12 L17 12 L17 22 Z M10 22 L10 16 L14 16 L14 22",
    color: "#1a1008",
  },
  {
    key: "village",
    name: "Dorf",
    kind: "pin",
    pathData: "M12 4 L20 11 L20 22 L4 22 L4 11 Z M4 11 L12 4 L20 11 M9 22 L9 15 L15 15 L15 22",
    color: "#6b4a2a",
  },
  {
    key: "ruin",
    name: "Ruine",
    kind: "pin",
    pathData: "M5 22 L5 12 L8 12 L8 8 M8 8 L10 10 M16 8 L16 12 L19 12 L19 22 M10 14 L14 14 L14 22 L10 22 Z",
    color: "#8b7355",
  },
  {
    key: "castle",
    name: "Burg",
    kind: "pin",
    pathData: "M4 22 L4 14 L6 14 L6 12 L8 12 L8 14 L10 14 L10 12 L14 12 L14 14 L16 14 L16 12 L18 12 L18 14 L20 14 L20 22 Z M10 22 L10 17 L14 17 L14 22",
    color: "#1a1008",
  },
  {
    key: "water",
    name: "See/Meer",
    kind: "biome",
    pathData: "M2 12 Q6 8 10 12 Q14 16 18 12 Q20 10 22 12 M2 16 Q6 12 10 16 Q14 20 18 16 Q20 14 22 16",
    color: "#a8c4d4",
  },
];

// ---------------------------------------------------------------------------
// Biome fill colours for canvas rendering
// ---------------------------------------------------------------------------

const BIOME_FILL: Record<BiomeKind, string> = {
  forest: "rgba(74,103,65,0.28)",
  mountains: "rgba(122,107,82,0.24)",
  hills: "rgba(154,136,96,0.20)",
  grassland: "rgba(164,196,130,0.24)",
  desert: "rgba(220,196,130,0.30)",
  swamp: "rgba(94,120,80,0.32)",
  coast: "rgba(168,196,212,0.38)",
  snow: "rgba(220,228,240,0.38)",
};

const BIOME_STROKE: Record<BiomeKind, string> = {
  forest: "rgba(40,80,30,0.55)",
  mountains: "rgba(90,75,50,0.55)",
  hills: "rgba(110,95,65,0.50)",
  grassland: "rgba(80,120,50,0.45)",
  desert: "rgba(160,130,60,0.50)",
  swamp: "rgba(40,80,40,0.55)",
  coast: "rgba(60,110,160,0.55)",
  snow: "rgba(120,150,200,0.50)",
};

const BIOME_LABELS: Record<BiomeKind, string> = {
  forest: "Wald",
  mountains: "Gebirge",
  hills: "Hügel",
  grassland: "Grasland",
  desert: "Wüste",
  swamp: "Sumpf",
  coast: "Küste",
  snow: "Schnee",
};

// ---------------------------------------------------------------------------
// Key counter for stable client keys
// ---------------------------------------------------------------------------

let _keyCounter = 0;
function nextKey(): string {
  return `ck-${++_keyCounter}`;
}

// ---------------------------------------------------------------------------
// Coordinate helpers (canvas-space ↔ normalised [0,1])
// ---------------------------------------------------------------------------

function toNorm(px: number, dim: number): number {
  return Math.max(0, Math.min(1, px / dim));
}

// ---------------------------------------------------------------------------
// Editor state + reducer
// ---------------------------------------------------------------------------

interface EditorState {
  features: EditorFeature[];
  objects: EditorObject[];
  selectedKey: string | null;
  tool: ToolMode;
  labelColor: LabelColor;
  activeGlyphKey: string;
  activeBiomeKind: BiomeKind;
  biomeDensity: number;
  /** Points being collected for the active polygon/path draw. */
  drawingPoints: [number, number][];
  /** Measure tool: up to 2 world-space points. */
  measurePoints: [number, number][];
  /** Whether to show the hex grid overlay. */
  showHexGrid: boolean;
  /** Viewport: pan offset + zoom */
  panX: number;
  panY: number;
  zoom: number;
  dirty: boolean;
}

type EditorAction =
  | { type: "SET_TOOL"; tool: ToolMode }
  | { type: "SET_LABEL_COLOR"; color: LabelColor }
  | { type: "SET_GLYPH"; key: string }
  | { type: "SET_BIOME_KIND"; kind: BiomeKind }
  | { type: "SET_BIOME_DENSITY"; density: number }
  | { type: "SELECT"; key: string | null }
  | { type: "ADD_DRAW_POINT"; point: [number, number] }
  | { type: "FINISH_POLYGON" }
  | { type: "FINISH_PATH" }
  | { type: "CANCEL_DRAW" }
  | { type: "PLACE_LABEL"; point: [number, number]; text: string }
  | { type: "PLACE_CURVED_LABEL"; path: [number, number][]; text: string }
  | { type: "PLACE_PIN"; point: [number, number] }
  | { type: "PLACE_STAMP"; point: [number, number]; paletteItemId: string }
  | { type: "ERASE_SELECTED" }
  | { type: "INIT_FEATURES"; features: EditorFeature[]; objects: EditorObject[] }
  | { type: "APPEND_DRAFT_FEATURES"; features: EditorFeature[] }
  | { type: "PAN"; dx: number; dy: number }
  | { type: "ZOOM"; delta: number; cx: number; cy: number; canvasW: number; canvasH: number }
  | { type: "MARK_CLEAN" }
  | { type: "MOVE_SELECTED"; dx: number; dy: number; canvasW: number; canvasH: number }
  | { type: "ADD_MEASURE_POINT"; point: [number, number] }
  | { type: "CLEAR_MEASURE" }
  | { type: "TOGGLE_HEX_GRID" }
  | { type: "SET_FEATURE_LINKED_PAGE"; key: string; linkedPageId: string | null; linkedPageHref?: string | null }
  | { type: "SET_FEATURE_VISIBILITY"; key: string; visibility: string }
  | { type: "SET_OBJECT_VISIBILITY"; key: string; visibility: string }
  | { type: "APPLY_SAVED_FEATURE_IDS"; saved: Array<{ clientKey: string; id: string }> }
  | { type: "APPLY_SAVED_OBJECT_IDS"; saved: Array<{ clientKey: string; id: string }> }
  | { type: "TOGGLE_SELECTED_PATH_REVERSAL" };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_TOOL":
      return { ...state, tool: action.tool, drawingPoints: [], measurePoints: [], selectedKey: null };

    case "SET_LABEL_COLOR":
      return { ...state, labelColor: action.color };

    case "SET_GLYPH":
      return { ...state, activeGlyphKey: action.key };

    case "SET_BIOME_KIND":
      return { ...state, activeBiomeKind: action.kind };

    case "SET_BIOME_DENSITY":
      return { ...state, biomeDensity: action.density };

    case "SELECT":
      return { ...state, selectedKey: action.key };

    case "ADD_DRAW_POINT":
      return { ...state, drawingPoints: [...state.drawingPoints, action.point] };

    case "FINISH_POLYGON": {
      if (state.drawingPoints.length < 3) return { ...state, drawingPoints: [] };

      const isBiome = state.tool === "biome";
      const feat: EditorFeature = {
        _key: nextKey(),
        kind: isBiome ? "biome" : "region",
        geometry: {
          type: "Polygon",
          rings: [state.drawingPoints],
        },
        style: isBiome
          ? ({ biomeKind: state.activeBiomeKind, density: state.biomeDensity } satisfies BiomeStyle)
          : undefined,
        labelColor: state.labelColor,
        layer: isBiome ? 10 : 10,
        visibility: "dm_only",
      };
      return {
        ...state,
        features: [...state.features, feat],
        drawingPoints: [],
        selectedKey: feat._key,
        dirty: true,
      };
    }

    case "FINISH_PATH": {
      if (state.drawingPoints.length < 2) return { ...state, drawingPoints: [] };

      const isRoad = state.tool === "road";
      const feat: EditorFeature = {
        _key: nextKey(),
        kind: isRoad ? "road" : "river",
        geometry: {
          type: "Path",
          coordinates: state.drawingPoints,
        },
        layer: isRoad ? 40 : 30,
        visibility: "dm_only",
      };
      return {
        ...state,
        features: [...state.features, feat],
        drawingPoints: [],
        selectedKey: feat._key,
        dirty: true,
      };
    }

    case "CANCEL_DRAW":
      return { ...state, drawingPoints: [], measurePoints: [] };

    case "ADD_MEASURE_POINT": {
      const pts = state.measurePoints.length >= 2
        ? [action.point]
        : [...state.measurePoints, action.point];
      return { ...state, measurePoints: pts as [number, number][] };
    }

    case "CLEAR_MEASURE":
      return { ...state, measurePoints: [] };

    case "TOGGLE_HEX_GRID":
      return { ...state, showHexGrid: !state.showHexGrid };

    case "SET_FEATURE_LINKED_PAGE":
      return {
        ...state,
        features: state.features.map((f) =>
          f._key === action.key
            ? {
                ...f,
                linkedPageId: action.linkedPageId,
                linkedPageHref:
                  action.linkedPageHref !== undefined ? action.linkedPageHref : f.linkedPageHref,
              }
            : f,
        ),
        dirty: true,
      };

    case "SET_FEATURE_VISIBILITY":
      return {
        ...state,
        features: state.features.map((f) =>
          f._key === action.key ? { ...f, visibility: action.visibility } : f,
        ),
        dirty: true,
      };

    case "SET_OBJECT_VISIBILITY":
      return {
        ...state,
        objects: state.objects.map((o) =>
          o._key === action.key ? { ...o, visibility: action.visibility } : o,
        ),
        dirty: true,
      };

    case "APPLY_SAVED_FEATURE_IDS": {
      const byKey = new Map(action.saved.map((s) => [s.clientKey, s.id]));
      return {
        ...state,
        features: state.features.map((f) => {
          const id = byKey.get(f._key);
          return id ? { ...f, id } : f;
        }),
      };
    }

    case "APPLY_SAVED_OBJECT_IDS": {
      const byKey = new Map(action.saved.map((s) => [s.clientKey, s.id]));
      return {
        ...state,
        objects: state.objects.map((o) => {
          const id = byKey.get(o._key);
          return id ? { ...o, id } : o;
        }),
      };
    }

    case "PLACE_LABEL": {
      const feat: EditorFeature = {
        _key: nextKey(),
        kind: "label",
        geometry: {
          type: "LabelAnchor",
          coordinates: action.point,
          text: action.text,
        },
        labelText: action.text,
        labelColor: state.labelColor,
        layer: 60,
        visibility: "dm_only",
      };
      return {
        ...state,
        features: [...state.features, feat],
        selectedKey: feat._key,
        dirty: true,
      };
    }

    case "PLACE_CURVED_LABEL": {
      if (action.path.length < 2) return state;
      const mid = action.path[Math.floor(action.path.length / 2)] ?? action.path[0]!;
      const feat: EditorFeature = {
        _key: nextKey(),
        kind: "label",
        geometry: {
          type: "LabelAnchor",
          coordinates: mid,
          text: action.text,
          pathCoordinates: action.path,
        },
        labelText: action.text,
        labelColor: state.labelColor,
        layer: 60,
        visibility: "dm_only",
      };
      return {
        ...state,
        features: [...state.features, feat],
        drawingPoints: [],
        selectedKey: feat._key,
        dirty: true,
      };
    }

    case "PLACE_PIN": {
      const feat: EditorFeature = {
        _key: nextKey(),
        kind: "pin",
        geometry: { type: "Point", coordinates: action.point },
        layer: 50,
        visibility: "dm_only",
      };
      return {
        ...state,
        features: [...state.features, feat],
        selectedKey: feat._key,
        dirty: true,
      };
    }

    case "PLACE_STAMP": {
      const obj: EditorObject = {
        _key: nextKey(),
        paletteItemId: action.paletteItemId,
        x: action.point[0],
        y: action.point[1],
        scale: 1,
        rotation: 0,
        layer: 50,
        visibility: "dm_only",
      };
      return {
        ...state,
        objects: [...state.objects, obj],
        selectedKey: obj._key,
        dirty: true,
      };
    }

    case "ERASE_SELECTED": {
      if (!state.selectedKey) return state;
      const key = state.selectedKey;
      return {
        ...state,
        features: state.features.filter((f) => f._key !== key),
        objects: state.objects.filter((o) => o._key !== key),
        selectedKey: null,
        dirty: true,
      };
    }

    case "TOGGLE_SELECTED_PATH_REVERSAL": {
      if (!state.selectedKey) return state;
      const key = state.selectedKey;
      return {
        ...state,
        features: state.features.map((feat) => {
          if (feat._key !== key || feat.geometry.type !== "LabelAnchor") return feat;
          const pathCoords = feat.geometry.pathCoordinates;
          if (!pathCoords || pathCoords.length < 2) return feat;
          return {
            ...feat,
            geometry: {
              ...feat.geometry,
              pathReversed: !feat.geometry.pathReversed,
            },
          };
        }),
        dirty: true,
      };
    }

    case "INIT_FEATURES":
      return {
        ...state,
        features: action.features,
        objects: action.objects,
        dirty: false,
      };

    case "APPEND_DRAFT_FEATURES":
      return {
        ...state,
        features: [...state.features, ...action.features],
        dirty: true,
      };

    case "PAN":
      return { ...state, panX: state.panX + action.dx, panY: state.panY + action.dy };

    case "ZOOM": {
      const ZOOM_MIN = 0.25;
      const ZOOM_MAX = 8;
      const factor = action.delta < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoom * factor));

      const { cx, cy } = action;
      const panX = cx - (cx - state.panX) * (newZoom / state.zoom);
      const panY = cy - (cy - state.panY) * (newZoom / state.zoom);

      return { ...state, zoom: newZoom, panX, panY };
    }

    case "MOVE_SELECTED": {
      if (!state.selectedKey) return state;
      const key = state.selectedKey;
      const dnx = action.dx / action.canvasW;
      const dny = action.dy / action.canvasH;

      const features = state.features.map((f) => {
        if (f._key !== key) return f;
        return { ...f, geometry: translateGeometry(f.geometry, dnx, dny), dirty: true };
      });
      const objects = state.objects.map((o) => {
        if (o._key !== key) return o;
        return { ...o, x: Math.max(0, Math.min(1, o.x + dnx)), y: Math.max(0, Math.min(1, o.y + dny)) };
      });
      return { ...state, features, objects, dirty: true };
    }

    case "MARK_CLEAN":
      return { ...state, dirty: false };

    default:
      return state;
  }
}

function translateGeometry(geo: FeatureGeometry, dx: number, dy: number): FeatureGeometry {
  if (geo.type === "Point" || geo.type === "LabelAnchor") {
    const c = geo.coordinates as [number, number];
    return { ...geo, coordinates: [c[0] + dx, c[1] + dy] as [number, number] };
  }
  if (geo.type === "Path") {
    const coords = (geo.coordinates as [number, number][]).map(
      ([x, y]): [number, number] => [x + dx, y + dy],
    );
    return { ...geo, coordinates: coords };
  }
  if (geo.type === "Polygon") {
    const rings = (geo.rings ?? []).map((ring) =>
      ring.map(([x, y]): [number, number] => [x + dx, y + dy]),
    );
    return { ...geo, rings };
  }
  return geo;
}

// ---------------------------------------------------------------------------
// Canvas render helpers
// ---------------------------------------------------------------------------

function worldToCanvas(
  nx: number,
  ny: number,
  panX: number,
  panY: number,
  zoom: number,
  w: number,
  h: number,
): [number, number] {
  return [nx * w * zoom + panX, ny * h * zoom + panY];
}

function canvasToWorld(
  cx: number,
  cy: number,
  panX: number,
  panY: number,
  zoom: number,
  w: number,
  h: number,
): [number, number] {
  return [toNorm((cx - panX) / zoom, w), toNorm((cy - panY) / zoom, h)];
}

// ---------------------------------------------------------------------------
// SVG glyph renderer (pure function)
// ---------------------------------------------------------------------------

function GlyphSvg({
  glyph,
  size = 24,
  color,
}: {
  glyph: BuiltinGlyph;
  size?: number;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color ?? glyph.color ?? "#1a1008"}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={glyph.pathData} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// CompassRose (static SVG decoration)
// ---------------------------------------------------------------------------

function CompassRose() {
  return (
    <svg
      viewBox="0 0 80 80"
      width={72}
      height={72}
      style={{ pointerEvents: "none" }}
      aria-label="Kompassrose"
    >
      <circle cx="40" cy="40" r="36" fill="#f2e8c9" stroke="#1a1008" strokeWidth="1.5" />
      <polygon points="40,8 35,36 40,30 45,36" fill="#1a1008" />
      <polygon points="40,72 35,44 40,50 45,44" fill="#8b1a10" />
      <line x1="4" y1="40" x2="76" y2="40" stroke="#1a1008" strokeWidth="0.8" strokeDasharray="2,3" />
      <line x1="40" y1="4" x2="40" y2="76" stroke="#1a1008" strokeWidth="0.8" strokeDasharray="2,3" />
      <text x="40" y="5" textAnchor="middle" fontSize="9" fontFamily="serif" fill="#1a1008" fontWeight="bold">N</text>
      <text x="40" y="79" textAnchor="middle" fontSize="9" fontFamily="serif" fill="#8b1a10">S</text>
      <text x="76" y="44" textAnchor="start" fontSize="9" fontFamily="serif" fill="#1a1008">O</text>
      <text x="4" y="44" textAnchor="end" fontSize="9" fontFamily="serif" fill="#1a1008">W</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ScaleBar (static decoration)
// ---------------------------------------------------------------------------

function ScaleBar({ preset }: { preset: AtlasStylePreset }) {
  const unit = preset.decorations.scaleUnit;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 80,
          height: 8,
          background: `repeating-linear-gradient(to right, ${preset.colors.ink} 0 10px, ${preset.colors.parchment} 10px 20px, ${preset.colors.ink} 20px 30px, ${preset.colors.parchment} 30px 40px)`,
          border: `1px solid ${preset.colors.ink}`,
        }}
      />
      <span style={{ fontSize: 10, fontFamily: preset.typography.labelCity, color: preset.colors.ink }}>
        0 — 100 {unit}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AtlasEditor component
// ---------------------------------------------------------------------------

export interface NodeAncestorItem {
  id: string;
  title: string;
  level: string;
}

export interface AtlasEditorProps {
  worldSlug: string;
  nodeId: string;
  nodeTitle: string;
  nodeLevel?: string;
  initialFeatures: EditorFeature[];
  initialObjects: EditorObject[];
  preset?: AtlasStylePreset;
  /** Ancestor chain root-first, e.g. [Globe, Continent, Landscape]. Used for breadcrumb. */
  parentChainItems?: NodeAncestorItem[];
  /** Polygon rings from the parent feature — rendered as faint locked underlay. */
  parentSilhouette?: [number, number][][];
  /** Background asset ID for this node (used to construct URL). */
  backgroundAssetId?: string | null;
  /** Builtin, AI and upload palette items from DB (combined with BUILTIN_GLYPHS for stamp tool). */
  initialPaletteItems?: EditorPaletteItem[];
  /** Current Portal visibility of this node ("dm_only" | "player_visible"). */
  nodeVisibility?: string;
  /** Current Portal visibility of the world's atlas map ("dm_only" | "player_visible"). */
  mapVisibility?: string;
}

const LEVEL_LABELS: Record<string, string> = {
  globe: "Globus",
  continent: "Kontinent",
  landscape: "Landschaft",
  city: "Stadt",
};

// ---------------------------------------------------------------------------
// Scale constant for measure tool
// ---------------------------------------------------------------------------

/** Normalised canvas [0, 1] across = 100 leagues (matches ScaleBar label). */
const MAP_SCALE_LEAGUES = 100;

export function AtlasEditor({
  worldSlug,
  nodeId,
  nodeTitle,
  nodeLevel,
  initialFeatures,
  initialObjects,
  preset = TOLKIEN_INK,
  parentChainItems = [],
  parentSilhouette,
  backgroundAssetId,
  initialPaletteItems = [],
  nodeVisibility: initialNodeVisibility = "dm_only",
  mapVisibility: initialMapVisibility = "dm_only",
}: AtlasEditorProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const movingSelected = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const [labelPrompt, setLabelPrompt] = useState<
    | { mode: "straight"; point: [number, number] }
    | { mode: "curved"; path: [number, number][] }
    | null
  >(null);
  const [labelText, setLabelText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Preloaded images for AI stamp rendering on canvas
  const stampImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Procedural draft panel
  const [showProceduralPanel, setShowProceduralPanel] = useState(false);

  // Region describe panel
  const [describeFeature, setDescribeFeature] = useState<EditorFeature | null>(null);

  // Pin page link dialog
  const [pinLinkFeature, setPinLinkFeature] = useState<EditorFeature | null>(null);
  const [pinPageIdInput, setPinPageIdInput] = useState("");
  const [pinNewPageTitle, setPinNewPageTitle] = useState("");
  const [pinNewPageType, setPinNewPageType] = useState<"location" | "region">("location");
  const [isPinLinking, startPinLinkTransition] = useTransition();

  // Background asset upload state
  const bgUploadRef = useRef<HTMLInputElement | null>(null);
  const [bgUploadPending, setBgUploadPending] = useState(false);
  const [bgAssetId, setBgAssetId] = useState<string | null>(backgroundAssetId ?? null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const [bgImageLoaded, setBgImageLoaded] = useState(false);

  // AI stamp generator panel
  const [showStampGenerator, setShowStampGenerator] = useState(false);

  // Palette items state (can be refreshed after stamp save)
  const [paletteItems, setPaletteItems] = useState<EditorPaletteItem[]>(initialPaletteItems);

  // Portal publishing (node + map visibility)
  const [nodeVisibility, setNodeVisibility] = useState<string>(initialNodeVisibility);
  const [mapVisibility, setMapVisibility] = useState<string>(initialMapVisibility);
  const [isVisibilityPending, startVisibilityTransition] = useTransition();

  // Drill-down dialog state
  const [drillDownFeatureId, setDrillDownFeatureId] = useState<string | null>(null);
  const [drillTitle, setDrillTitle] = useState("");
  const [drillLevel, setDrillLevel] = useState<string>(() => {
    const levels = ["globe", "continent", "landscape", "city"];
    const curIdx = levels.indexOf(nodeLevel ?? "continent");
    return levels[Math.min(curIdx + 1, levels.length - 1)] ?? "city";
  });
  const [isDrillPending, startDrillTransition] = useTransition();

  const [state, dispatch] = useReducer(editorReducer, {
    features: [],
    objects: [],
    selectedKey: null,
    tool: "select",
    labelColor: "black",
    activeGlyphKey: BUILTIN_GLYPHS[0]!.key,
    activeBiomeKind: BiomeKind.forest,
    biomeDensity: 1.0,
    drawingPoints: [],
    measurePoints: [],
    showHexGrid: false,
    panX: 0,
    panY: 0,
    zoom: 1,
    dirty: false,
  });

  useEffect(() => {
    dispatch({ type: "INIT_FEATURES", features: initialFeatures, objects: initialObjects });
  }, [initialFeatures, initialObjects]);

  // Load background image when bgAssetId changes
  useEffect(() => {
    if (!bgAssetId) {
      bgImageRef.current = null;
      setBgImageLoaded(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      bgImageRef.current = img;
      setBgImageLoaded(true);
    };
    img.onerror = () => {
      bgImageRef.current = null;
      setBgImageLoaded(false);
    };
    img.src = `/api/assets/${bgAssetId}/file`;
  }, [bgAssetId]);

  // Preload AI stamp images whenever palette items change
  useEffect(() => {
    for (const item of paletteItems) {
      if (item.imageData && item.mimeType && !stampImagesRef.current.has(item.id)) {
        const img = new window.Image();
        img.src = `data:${item.mimeType};base64,${item.imageData}`;
        stampImagesRef.current.set(item.id, img);
      }
    }
  }, [paletteItems]);

  // Sync palette items when prop changes (e.g. after router.refresh())
  useEffect(() => {
    setPaletteItems(initialPaletteItems);
  }, [initialPaletteItems]);

  // Sync visibility props when they change (e.g. after revalidate)
  useEffect(() => {
    setNodeVisibility(initialNodeVisibility);
  }, [initialNodeVisibility]);
  useEffect(() => {
    setMapVisibility(initialMapVisibility);
  }, [initialMapVisibility]);

  // Lookup: builtin glyph key -> DB palette item id (for placement).
  const builtinKeyToId = new Map<string, string>();
  for (const p of paletteItems) {
    if (p.source === "builtin" && p.builtinGlyphKey) {
      builtinKeyToId.set(p.builtinGlyphKey, p.id);
    }
  }
  // Lookup: DB palette item id -> palette item (for rendering & selection panel).
  const paletteItemById = new Map<string, EditorPaletteItem>();
  for (const p of paletteItems) paletteItemById.set(p.id, p);
  // AI/upload stamps only — builtin glyphs are shown via the local BUILTIN_GLYPHS row.
  const stampPaletteItems = paletteItems.filter((p) => p.source !== "builtin");

  // ---------------------------------------------------------------------------
  // Canvas render
  // ---------------------------------------------------------------------------

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const { panX, panY, zoom, features, objects, selectedKey, drawingPoints, tool, measurePoints, showHexGrid } = state;
    const currentPaletteItems = paletteItems;

    function w2c(nx: number, ny: number): [number, number] {
      return worldToCanvas(nx, ny, panX, panY, zoom, W, H);
    }

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = preset.colors.parchment;
    ctx.fillRect(0, 0, W, H);

    // Reference image underlay (faint, behind everything)
    if (bgImageRef.current && bgImageLoaded) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      const [ix0, iy0] = w2c(0, 0);
      const [ix1, iy1] = w2c(1, 1);
      ctx.drawImage(bgImageRef.current, ix0, iy0, ix1 - ix0, iy1 - iy0);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3 * zoom, W / 2, H / 2, W * 0.75);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(80,50,20,0.18)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Parent silhouette underlay — faint locked boundary from parent feature.
    if (parentSilhouette && parentSilhouette.length > 0) {
      ctx.save();
      ctx.beginPath();
      for (const ring of parentSilhouette) {
        if (!ring.length) continue;
        const [sx, sy] = w2c(ring[0]![0], ring[0]![1]);
        ctx.moveTo(sx, sy);
        for (let i = 1; i < ring.length; i++) {
          const [px, py] = w2c(ring[i]![0], ring[i]![1]);
          ctx.lineTo(px, py);
        }
        ctx.closePath();
      }
      ctx.strokeStyle = preset.colors.ink;
      ctx.lineWidth = 2.5 * zoom;
      ctx.globalAlpha = 0.15;
      ctx.setLineDash([8 * zoom, 5 * zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = preset.colors.ink;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = preset.colors.ink;
    ctx.lineWidth = 2 * zoom;
    const [bx0, by0] = w2c(0, 0);
    const [bx1, by1] = w2c(1, 1);
    ctx.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
    ctx.restore();

    const sortedFeatures = [...features].sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));

    for (const feat of sortedFeatures) {
      const isSelected = feat._key === selectedKey;
      ctx.save();

      if (feat.geometry.type === "Polygon") {
        const rings = feat.geometry.rings ?? [];
        ctx.beginPath();
        for (const ring of rings) {
          if (!ring.length) continue;
          const [sx, sy] = w2c(ring[0]![0], ring[0]![1]);
          ctx.moveTo(sx, sy);
          for (let i = 1; i < ring.length; i++) {
            const [cx2, cy2] = w2c(ring[i]![0], ring[i]![1]);
            ctx.lineTo(cx2, cy2);
          }
          ctx.closePath();
        }

        if (feat.kind === "biome") {
          const bs = feat.style as unknown as BiomeStyle | undefined;
          const bk = (bs?.biomeKind ?? BiomeKind.forest) as BiomeKind;
          ctx.fillStyle = BIOME_FILL[bk];
          ctx.fill();
          ctx.strokeStyle = isSelected ? "#2563eb" : BIOME_STROKE[bk];
          ctx.lineWidth = isSelected ? 2.5 * zoom : 1.5 * zoom;
          ctx.stroke();

          // Relief shading for elevated biomes
          const needsRelief = bk === BiomeKind.mountains || bk === BiomeKind.hills || bk === BiomeKind.snow;
          if (needsRelief && rings[0] && rings[0].length >= 3) {
            const poly = { type: "Polygon" as const, rings: rings as [number, number][][] };
            const relief = buildReliefShading(poly, bk);

            const [rx0, ry0] = w2c(relief.bbox[0], relief.bbox[1]);
            const [rx1, ry1] = w2c(relief.bbox[2], relief.bbox[3]);

            ctx.save();
            ctx.beginPath();
            for (const ring of rings) {
              if (!ring.length) continue;
              const [rsx, rsy] = w2c(ring[0]![0], ring[0]![1]);
              ctx.moveTo(rsx, rsy);
              for (let i = 1; i < ring.length; i++) {
                const [rcx, rcy] = w2c(ring[i]![0], ring[i]![1]);
                ctx.lineTo(rcx, rcy);
              }
              ctx.closePath();
            }
            ctx.clip();

            const reliefGrad = ctx.createLinearGradient(rx0, ry0, rx1, ry1);
            reliefGrad.addColorStop(0, relief.highlightColor);
            reliefGrad.addColorStop(1, relief.shadowColor);
            ctx.globalAlpha = relief.opacity;
            ctx.fillStyle = reliefGrad;
            ctx.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
            ctx.globalAlpha = 1;
            ctx.restore();
          }

          // Scattered glyphs inside biome polygon
          if (rings[0] && rings[0].length >= 3) {
            const bs2 = feat.style as unknown as BiomeStyle | undefined;
            const density = bs2?.density ?? 1.0;
            const seed = hashKey(feat._key);
            const poly = { type: "Polygon" as const, rings: rings as [number, number][][] };
            const glyphs = scatterGlyphsInPolygon(poly, bk, density * 0.6, seed);

            for (const sg of glyphs) {
              const glyph = BUILTIN_GLYPHS.find((g) => g.key === sg.glyphKey);
              if (!glyph) continue;
              const [gx, gy] = w2c(sg.x, sg.y);
              const size = 16 * zoom * sg.scale;

              ctx.save();
              ctx.translate(gx, gy);
              ctx.rotate((sg.rotation * Math.PI) / 180);
              const s = size / 24;
              ctx.scale(s, s);
              ctx.translate(-12, -12);
              ctx.strokeStyle = glyph.color ?? preset.colors.ink;
              ctx.lineWidth = 1.2 / s;
              ctx.lineJoin = "round";
              ctx.lineCap = "round";
              ctx.globalAlpha = 0.75;
              ctx.beginPath();
              drawSvgPath(ctx, glyph.pathData);
              ctx.stroke();
              ctx.globalAlpha = 1;
              ctx.restore();
            }
          }
        } else {
          ctx.fillStyle =
            feat.labelColor === "red"
              ? "rgba(139,26,16,0.18)"
              : "rgba(26,16,8,0.12)";
          ctx.fill();
          ctx.strokeStyle = isSelected ? "#2563eb" : preset.colors.ink;
          ctx.lineWidth = isSelected ? 2.5 * zoom : 1.5 * zoom;
          ctx.stroke();

          // Drill-down indicator: small arrow badge on region features that
          // already have a child node linked.
          if (feat.childNodeId && feat.geometry.type === "Polygon") {
            const rings = feat.geometry.rings ?? [];
            if (rings[0] && rings[0].length) {
              // Compute centroid of first ring
              let cx2 = 0;
              let cy2 = 0;
              for (const [rx, ry] of rings[0]) { cx2 += rx; cy2 += ry; }
              cx2 /= rings[0].length;
              cy2 /= rings[0].length;
              const [bx, by] = w2c(cx2, cy2);
              const r = 8 * zoom;
              ctx.save();
              ctx.beginPath();
              ctx.arc(bx, by, r, 0, Math.PI * 2);
              ctx.fillStyle = isSelected ? "#2563eb" : "#4a90d9";
              ctx.globalAlpha = 0.85;
              ctx.fill();
              ctx.globalAlpha = 1;
              ctx.fillStyle = "#fff";
              ctx.font = `bold ${Math.round(11 * zoom)}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("↓", bx, by);
              ctx.restore();
            }
          }
        }
      } else if (feat.geometry.type === "Path") {
        const coords = (feat.geometry.coordinates as [number, number][]) ?? [];
        if (coords.length >= 2) {
          if (feat.kind === "road") {
            // Road: dashed brown path
            ctx.beginPath();
            const [sx, sy] = w2c(coords[0]![0], coords[0]![1]);
            ctx.moveTo(sx, sy);
            for (let i = 1; i < coords.length; i++) {
              const [cx2, cy2] = w2c(coords[i]![0], coords[i]![1]);
              ctx.lineTo(cx2, cy2);
            }
            ctx.strokeStyle = isSelected ? "#2563eb" : preset.colors.road;
            ctx.lineWidth = isSelected ? 2.5 * zoom : 2.0 * zoom;
            ctx.setLineDash([8 * zoom, 4 * zoom]);
            ctx.stroke();
            ctx.setLineDash([]);
          } else {
            // River: tapered path (wider at start, narrower at end)
            const maxW = isSelected ? 2.8 * zoom : 2.2 * zoom;
            const minW = isSelected ? 1.2 * zoom : 0.8 * zoom;
            ctx.strokeStyle = isSelected ? "#2563eb" : preset.colors.inkAccent;

            for (let i = 0; i < coords.length - 1; i++) {
              const t = coords.length > 2 ? i / (coords.length - 2) : 0;
              const w = maxW * (1 - t * 0.65) + minW * (t * 0.65);
              const [sx, sy] = w2c(coords[i]![0], coords[i]![1]);
              const [ex, ey] = w2c(coords[i + 1]![0], coords[i + 1]![1]);
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(ex, ey);
              ctx.lineWidth = w;
              ctx.stroke();
            }

            // Ridge scatter along rivers drawn at high zoom
            if (zoom >= 1.5 && coords.length >= 2) {
              const seed = hashKey(feat._key);
              const pathGeo = { type: "Path" as const, coordinates: coords };
              const ridgeGlyphs = scatterGlyphsAlongPath(pathGeo, BiomeKind.hills, 0.06, undefined, seed);
              for (const sg of ridgeGlyphs) {
                const glyph = BUILTIN_GLYPHS.find((g) => g.key === sg.glyphKey);
                if (!glyph) continue;
                const [gx, gy] = w2c(sg.x, sg.y);
                const size = 10 * zoom * sg.scale;
                ctx.save();
                ctx.translate(gx, gy);
                ctx.rotate((sg.rotation * Math.PI) / 180);
                const s = size / 24;
                ctx.scale(s, s);
                ctx.translate(-12, -12);
                ctx.strokeStyle = preset.colors.inkAccent;
                ctx.lineWidth = 1.0 / s;
                ctx.lineJoin = "round";
                ctx.lineCap = "round";
                ctx.globalAlpha = 0.35;
                ctx.beginPath();
                drawSvgPath(ctx, glyph.pathData);
                ctx.stroke();
                ctx.globalAlpha = 1;
                ctx.restore();
              }
            }
          }
        }
      } else if (feat.geometry.type === "Point" || feat.geometry.type === "LabelAnchor") {
        const coord = feat.geometry.coordinates as [number, number];
        if (!coord) continue;
        const [px, py] = w2c(coord[0], coord[1]);

        if (feat.geometry.type === "LabelAnchor") {
          const labelText = feat.labelText ?? feat.geometry.text ?? "Label";
          const inkColor =
            feat.labelColor === "red" ? preset.colors.inkAccent : preset.colors.ink;
          const pathCoords = feat.geometry.pathCoordinates;

          if (pathCoords && pathCoords.length >= 2) {
            ctx.font = `bold ${Math.round(13 * zoom)}px ${preset.typography.labelRegion}`;
            ctx.fillStyle = inkColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            const placements = layoutCharactersOnPath(
              labelText,
              pathCoords,
              0.01 * (14 / zoom),
              feat.geometry.pathReversed === true,
            );
            for (const placement of placements) {
              const [cx, cy] = w2c(placement.x, placement.y);
              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate(placement.rotation);
              ctx.fillText(placement.char, 0, 0);
              ctx.restore();
            }

            if (isSelected) {
              ctx.save();
              ctx.strokeStyle = "#2563eb";
              ctx.lineWidth = 1.2 * zoom;
              ctx.setLineDash([4 * zoom, 3 * zoom]);
              ctx.beginPath();
              const [fx, fy] = w2c(pathCoords[0]![0], pathCoords[0]![1]);
              ctx.moveTo(fx, fy);
              for (let i = 1; i < pathCoords.length; i++) {
                const [lx, ly] = w2c(pathCoords[i]![0], pathCoords[i]![1]);
                ctx.lineTo(lx, ly);
              }
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.restore();
            }
          } else {
            ctx.font = `${Math.round(14 * zoom)}px ${preset.typography.labelCity}`;
            ctx.fillStyle = inkColor;
            ctx.textAlign = "center";
            ctx.fillText(labelText, px, py);
            if (isSelected) {
              ctx.strokeStyle = "#2563eb";
              ctx.lineWidth = 1.5;
              const tw = ctx.measureText(labelText).width;
              ctx.strokeRect(px - tw / 2 - 2, py - 14 * zoom, tw + 4, 16 * zoom);
            }
          }
        } else {
          ctx.beginPath();
          ctx.arc(px, py, 5 * zoom, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? "#2563eb" : preset.colors.inkAccent;
          ctx.fill();
        }
      }

      ctx.restore();
    }

    // Draw stamp objects — obj.paletteItemId is now always a DB palette item id.
    for (const obj of objects) {
      const paletteItem = currentPaletteItems.find((p) => p.id === obj.paletteItemId);
      if (!paletteItem) continue;

      const builtinGlyph = paletteItem.builtinGlyphKey
        ? BUILTIN_GLYPHS.find((g) => g.key === paletteItem.builtinGlyphKey)
        : undefined;
      // AI/upload items render the preloaded image; builtin items render the SVG glyph.
      const aiPaletteItem = builtinGlyph ? undefined : paletteItem;

      const isSelected = obj._key === selectedKey;
      const [ox, oy] = w2c(obj.x, obj.y);
      const size = 24 * zoom * obj.scale;

      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate((obj.rotation * Math.PI) / 180);
      if (isSelected) {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2;
        ctx.strokeRect(-size / 2 - 3, -size / 2 - 3, size + 6, size + 6);
      }

      if (builtinGlyph) {
        const scale = size / 24;
        ctx.scale(scale, scale);
        ctx.translate(-12, -12);
        ctx.strokeStyle = builtinGlyph.color ?? preset.colors.ink;
        ctx.lineWidth = 1.5 / scale;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        drawSvgPath(ctx, builtinGlyph.pathData);
        ctx.stroke();
      } else if (aiPaletteItem) {
        const preloaded = stampImagesRef.current.get(aiPaletteItem.id);
        if (preloaded && preloaded.complete && preloaded.naturalWidth > 0) {
          ctx.drawImage(preloaded, -size / 2, -size / 2, size, size);
        } else {
          // Fallback: draw a placeholder box with a "✦" glyph
          ctx.strokeStyle = preset.colors.ink;
          ctx.lineWidth = 1;
          ctx.strokeRect(-size / 2, -size / 2, size, size);
          ctx.fillStyle = preset.colors.ink;
          ctx.font = `${Math.round(size * 0.6)}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("✦", 0, 0);
        }
      }

      ctx.restore();
    }

    // Draw current polygon/path/biome/road being drawn
    if (drawingPoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5 * zoom;
      ctx.setLineDash(tool === "road" ? [8 * zoom, 4 * zoom] : [4, 4]);
      ctx.beginPath();
      const [sx, sy] = w2c(drawingPoints[0]![0], drawingPoints[0]![1]);
      ctx.moveTo(sx, sy);
      for (let i = 1; i < drawingPoints.length; i++) {
        const [cx2, cy2] = w2c(drawingPoints[i]![0], drawingPoints[i]![1]);
        ctx.lineTo(cx2, cy2);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      for (const [nx, ny] of drawingPoints) {
        const [px, py] = w2c(nx, ny);
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#2563eb";
        ctx.fill();
      }
      ctx.restore();

      if ((tool === "polygon" || tool === "biome") && drawingPoints.length >= 3) {
        const [sx2, sy2] = w2c(drawingPoints[0]![0], drawingPoints[0]![1]);
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx2, sy2, 8 * zoom, 0, Math.PI * 2);
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Hex grid overlay
    if (showHexGrid) {
      const HEX_R = 0.05; // hex radius in normalised space
      const hexW = Math.sqrt(3) * HEX_R;
      const hexH = 2 * HEX_R;
      ctx.save();
      ctx.strokeStyle = "rgba(80,50,20,0.20)";
      ctx.lineWidth = 0.8 * zoom;

      const cols = Math.ceil(1.2 / hexW) + 2;
      const rows = Math.ceil(1.2 / (hexH * 0.75)) + 2;
      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const offsetX = (row % 2) * (hexW / 2);
          const cx = col * hexW + offsetX;
          const cy = row * hexH * 0.75;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 180) * (60 * i - 30);
            const hx = cx + HEX_R * Math.cos(angle);
            const hy = cy + HEX_R * Math.sin(angle);
            const [px, py] = w2c(hx, hy);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Measure tool overlay
    if (measurePoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2 * zoom;
      ctx.setLineDash([6 * zoom, 3 * zoom]);

      for (let i = 0; i < measurePoints.length; i++) {
        const [mx, my] = w2c(measurePoints[i]![0], measurePoints[i]![1]);
        ctx.beginPath();
        ctx.arc(mx, my, 6 * zoom, 0, Math.PI * 2);
        ctx.setLineDash([]);
        ctx.fillStyle = "#f59e0b";
        ctx.fill();
        ctx.setLineDash([6 * zoom, 3 * zoom]);
      }

      if (measurePoints.length === 2) {
        const [ax, ay] = w2c(measurePoints[0]![0], measurePoints[0]![1]);
        const [bx, by] = w2c(measurePoints[1]![0], measurePoints[1]![1]);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();

        // Distance label
        const dx = measurePoints[1]![0] - measurePoints[0]![0];
        const dy = measurePoints[1]![1] - measurePoints[0]![1];
        const dist = Math.sqrt(dx * dx + dy * dy) * MAP_SCALE_LEAGUES;
        const midX = (ax + bx) / 2;
        const midY = (ay + by) / 2;
        const label = `${dist.toFixed(1)} ${preset.decorations.scaleUnit}`;
        ctx.setLineDash([]);
        ctx.font = `bold ${Math.round(13 * zoom)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        ctx.fillRect(midX - tw / 2 - 4, midY - 18 * zoom, tw + 8, 16 * zoom);
        ctx.fillStyle = "#92400e";
        ctx.fillText(label, midX, midY);
      }
      ctx.restore();
    }
  }, [state, preset, parentSilhouette, bgImageLoaded, paletteItems]);

  useEffect(() => {
    render();
  }, [render]);

  // ---------------------------------------------------------------------------
  // Resize observer
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      render();
    });
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [render]);

  // ---------------------------------------------------------------------------
  // Pointer helpers
  // ---------------------------------------------------------------------------

  function getCanvasPos(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function getWorldPos(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const [cx, cy] = getCanvasPos(e);
    const canvas = canvasRef.current!;
    return canvasToWorld(cx, cy, state.panX, state.panY, state.zoom, canvas.clientWidth, canvas.clientHeight);
  }

  function hitTest(wx: number, wy: number): string | null {
    const canvas = canvasRef.current!;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const THRESH = 10 / (state.zoom * Math.max(W, H));

    for (let i = state.objects.length - 1; i >= 0; i--) {
      const o = state.objects[i]!;
      const dx = o.x - wx;
      const dy = o.y - wy;
      if (Math.sqrt(dx * dx + dy * dy) < THRESH * 2) return o._key;
    }
    for (let i = state.features.length - 1; i >= 0; i--) {
      const f = state.features[i]!;
      const geo = f.geometry;
      if (geo.type === "Point" || geo.type === "LabelAnchor") {
        const coord = geo.coordinates as [number, number];
        if (!coord) continue;
        const dx = coord[0] - wx;
        const dy = coord[1] - wy;
        if (Math.sqrt(dx * dx + dy * dy) < THRESH * 2) return f._key;
      }
    }
    for (let i = state.features.length - 1; i >= 0; i--) {
      const f = state.features[i]!;
      const geo = f.geometry;
      if (geo.type === "Polygon") {
        const rings = geo.rings ?? [];
        for (const ring of rings) {
          if (pointInPolygon([wx, wy], ring)) return f._key;
        }
      } else if (geo.type === "Path") {
        const coords = (geo.coordinates as [number, number][]) ?? [];
        for (let k = 0; k < coords.length - 1; k++) {
          const dist = distToSegment([wx, wy], coords[k]!, coords[k + 1]!);
          if (dist < THRESH) return f._key;
        }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Pointer events
  // ---------------------------------------------------------------------------

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const [cx, cy] = getCanvasPos(e);
    const wp = getWorldPos(e);
    canvas.setPointerCapture(e.pointerId);
    lastPointer.current = { x: cx, y: cy };

    const { tool, selectedKey } = state;

    if (tool === "select") {
      const hit = hitTest(wp[0], wp[1]);
      if (hit && hit === selectedKey) {
        movingSelected.current = true;
      } else if (hit) {
        dispatch({ type: "SELECT", key: hit });
        movingSelected.current = false;
      } else {
        dispatch({ type: "SELECT", key: null });
        panning.current = true;
        panStart.current = { x: cx, y: cy };
      }
      return;
    }

    if (tool === "eraser") {
      const hit = hitTest(wp[0], wp[1]);
      if (hit) {
        dispatch({ type: "SELECT", key: hit });
        dispatch({ type: "ERASE_SELECTED" });
      }
      return;
    }

    if (tool === "polygon" || tool === "biome") {
      if (state.drawingPoints.length >= 3) {
        const [fx, fy] = worldToCanvas(
          state.drawingPoints[0]![0],
          state.drawingPoints[0]![1],
          state.panX, state.panY, state.zoom,
          canvas.clientWidth, canvas.clientHeight,
        );
        if (Math.sqrt((cx - fx) ** 2 + (cy - fy) ** 2) < 10) {
          dispatch({ type: "FINISH_POLYGON" });
          return;
        }
      }
      dispatch({ type: "ADD_DRAW_POINT", point: wp });
      return;
    }

    if (tool === "path" || tool === "road") {
      dispatch({ type: "ADD_DRAW_POINT", point: wp });
      return;
    }

    if (tool === "label") {
      setLabelPrompt({ mode: "straight", point: wp });
      setLabelText("");
      return;
    }

    if (tool === "curvedLabel") {
      dispatch({ type: "ADD_DRAW_POINT", point: wp });
      return;
    }

    if (tool === "pin") {
      dispatch({ type: "PLACE_PIN", point: wp });
      return;
    }

    if (tool === "stamp") {
      const activeKey = state.activeGlyphKey;
      const isBuiltinKey = BUILTIN_GLYPHS.some((g) => g.key === activeKey);
      // Builtin selections use the glyph key; resolve to the real DB palette id.
      // AI/upload selections already use the palette id as activeGlyphKey.
      const resolvedId = builtinKeyToId.get(activeKey) ?? activeKey;
      if (isBuiltinKey && !builtinKeyToId.has(activeKey)) {
        setSaveMsg("Builtin-Glyph-Palette fehlt — bitte Seite neu laden.");
        setTimeout(() => setSaveMsg(null), 3000);
        return;
      }
      dispatch({ type: "PLACE_STAMP", point: wp, paletteItemId: resolvedId });
      return;
    }

    if (tool === "measure") {
      dispatch({ type: "ADD_MEASURE_POINT", point: wp });
      return;
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const [cx, cy] = getCanvasPos(e);

    if (panning.current) {
      const dx = cx - (lastPointer.current?.x ?? cx);
      const dy = cy - (lastPointer.current?.y ?? cy);
      dispatch({ type: "PAN", dx, dy });
      lastPointer.current = { x: cx, y: cy };
      return;
    }

    if (movingSelected.current && state.selectedKey) {
      const dx = cx - (lastPointer.current?.x ?? cx);
      const dy = cy - (lastPointer.current?.y ?? cy);
      const canvas = canvasRef.current!;
      dispatch({
        type: "MOVE_SELECTED",
        dx,
        dy,
        canvasW: canvas.clientWidth,
        canvasH: canvas.clientHeight,
      });
      lastPointer.current = { x: cx, y: cy };
      return;
    }

    lastPointer.current = { x: cx, y: cy };
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    canvas.releasePointerCapture(e.pointerId);
    panning.current = false;
    movingSelected.current = false;
    lastPointer.current = null;
  }

  function onDoubleClick(_e: React.PointerEvent<HTMLCanvasElement>) {
    if (state.tool === "polygon" || state.tool === "biome") {
      dispatch({ type: "FINISH_POLYGON" });
    } else if (state.tool === "path" || state.tool === "road") {
      dispatch({ type: "FINISH_PATH" });
    }
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    dispatch({
      type: "ZOOM",
      delta: e.deltaY,
      cx: e.clientX - rect.left,
      cy: e.clientY - rect.top,
      canvasW: canvas.clientWidth,
      canvasH: canvas.clientHeight,
    });
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  function handleSave() {
    startTransition(async () => {
      try {
        const featuresFd = new FormData();
        featuresFd.set("worldSlug", worldSlug);
        featuresFd.set("nodeId", nodeId);
        featuresFd.set("features", JSON.stringify(
          state.features.map((f) => ({ ...f, clientKey: f._key })),
        ));
        const featuresResult = await saveAtlasFeaturesAction(featuresFd);

        const objectsFd = new FormData();
        objectsFd.set("worldSlug", worldSlug);
        objectsFd.set("nodeId", nodeId);
        objectsFd.set("objects", JSON.stringify(
          state.objects.map((o) => ({ ...o, clientKey: o._key })),
        ));
        const objectsResult = await saveAtlasObjectsAction(objectsFd);

        // Apply persisted ids back onto freshly-drawn items so drill-down,
        // pin linking and handouts work immediately without a manual reload.
        if (featuresResult?.saved?.length) {
          dispatch({ type: "APPLY_SAVED_FEATURE_IDS", saved: featuresResult.saved });
        }
        if (objectsResult?.saved?.length) {
          dispatch({ type: "APPLY_SAVED_OBJECT_IDS", saved: objectsResult.saved });
        }

        dispatch({ type: "MARK_CLEAN" });
        setSaveMsg("Gespeichert ✓");
        setTimeout(() => setSaveMsg(null), 2000);
      } catch (err) {
        setSaveMsg(
          `Fehler beim Speichern: ${err instanceof Error ? err.message : "Unbekannt"}`,
        );
        setTimeout(() => setSaveMsg(null), 4000);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Portal publishing (node + map visibility)
  // ---------------------------------------------------------------------------

  function handleToggleNodeVisibility() {
    const next = nodeVisibility === "player_visible" ? "dm_only" : "player_visible";
    setNodeVisibility(next);
    startVisibilityTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("worldSlug", worldSlug);
        fd.set("nodeId", nodeId);
        fd.set("visibility", next);
        await setAtlasNodeVisibilityAction(fd);
      } catch {
        setNodeVisibility((prev) => (prev === next ? (next === "player_visible" ? "dm_only" : "player_visible") : prev));
        setSaveMsg("Sichtbarkeit des Knotens konnte nicht gesetzt werden.");
        setTimeout(() => setSaveMsg(null), 3000);
      }
    });
  }

  function handleToggleMapVisibility() {
    const next = mapVisibility === "player_visible" ? "dm_only" : "player_visible";
    setMapVisibility(next);
    startVisibilityTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("worldSlug", worldSlug);
        fd.set("nodeId", nodeId);
        fd.set("visibility", next);
        await setAtlasMapVisibilityAction(fd);
      } catch {
        setMapVisibility((prev) => (prev === next ? (next === "player_visible" ? "dm_only" : "player_visible") : prev));
        setSaveMsg("Portal-Freigabe der Karte konnte nicht gesetzt werden.");
        setTimeout(() => setSaveMsg(null), 3000);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Export PNG
  // ---------------------------------------------------------------------------

  function handleExportPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `atlas-${nodeTitle.replace(/\s+/g, "-").toLowerCase()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  async function handleCreateHandout() {
    const fd = new FormData();
    fd.set("worldSlug", worldSlug);
    fd.set("nodeId", nodeId);
    fd.set("title", `${nodeTitle} — Handout`);
    const result = await createAtlasHandoutPageAction(fd);
    router.push(`/worlds/${worldSlug}/pages/${result.pageSlug}`);
  }

  // ---------------------------------------------------------------------------
  // Background image upload
  // ---------------------------------------------------------------------------

  async function handleBgUpload(file: File) {
    setBgUploadPending(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", `${nodeTitle} — Unterlegbild`);
      fd.append("visibility", "dm_only");
      const response = await fetch(`/api/worlds/${worldSlug}/assets/upload`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: fd,
      });
      if (!response.ok) throw new Error("Upload fehlgeschlagen");
      const data = await response.json() as { id: string };
      const assetId = data.id;

      // Persist on the node
      const actionFd = new FormData();
      actionFd.set("worldSlug", worldSlug);
      actionFd.set("nodeId", nodeId);
      actionFd.set("assetId", assetId);
      await setNodeBackgroundAssetAction(actionFd);
      setBgAssetId(assetId);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Upload-Fehler");
      setTimeout(() => setSaveMsg(null), 3000);
    } finally {
      setBgUploadPending(false);
    }
  }

  async function handleBgClear() {
    const fd = new FormData();
    fd.set("worldSlug", worldSlug);
    fd.set("nodeId", nodeId);
    fd.set("assetId", "");
    await setNodeBackgroundAssetAction(fd);
    setBgAssetId(null);
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      switch (e.key) {
        case "Escape": dispatch({ type: "CANCEL_DRAW" }); break;
        case "Delete":
        case "Backspace": dispatch({ type: "ERASE_SELECTED" }); break;
        case "s": dispatch({ type: "SET_TOOL", tool: "select" }); break;
        case "p": dispatch({ type: "SET_TOOL", tool: "polygon" }); break;
        case "r": dispatch({ type: "SET_TOOL", tool: "path" }); break;
        case "b": dispatch({ type: "SET_TOOL", tool: "biome" }); break;
        case "d": dispatch({ type: "SET_TOOL", tool: "road" }); break;
        case "l": dispatch({ type: "SET_TOOL", tool: "label" }); break;
        case "c": dispatch({ type: "SET_TOOL", tool: "curvedLabel" }); break;
        case "i": dispatch({ type: "SET_TOOL", tool: "pin" }); break;
        case "t": dispatch({ type: "SET_TOOL", tool: "stamp" }); break;
        case "e": dispatch({ type: "SET_TOOL", tool: "eraser" }); break;
        case "m": dispatch({ type: "SET_TOOL", tool: "measure" }); break;
        case "Enter":
          if (state.tool === "curvedLabel" && state.drawingPoints.length >= 2) {
            setLabelPrompt({ mode: "curved", path: [...state.drawingPoints] });
            dispatch({ type: "CANCEL_DRAW" });
            setLabelText("");
          }
          break;
        case "h": dispatch({ type: "TOGGLE_HEX_GRID" }); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.tool, state.drawingPoints]);

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  const selectedFeature = state.features.find((f) => f._key === state.selectedKey) ?? null;
  const selectedObject = state.objects.find((o) => o._key === state.selectedKey) ?? null;

  const toolCursor: Record<ToolMode, string> = {
    select: "default",
    polygon: "crosshair",
    path: "crosshair",
    biome: "crosshair",
    road: "crosshair",
    label: "text",
    curvedLabel: "crosshair",
    pin: "crosshair",
    stamp: "copy",
    eraser: "not-allowed",
    measure: "crosshair",
  };

  const isDrawingTool =
    state.tool === "polygon" ||
    state.tool === "path" ||
    state.tool === "biome" ||
    state.tool === "road" ||
    state.tool === "curvedLabel";

  return (
    <div className="uwe-atlas-editor" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Hierarchy breadcrumb */}
      {(parentChainItems.length > 0 || nodeLevel) && (
        <nav
          aria-label="Atlas-Hierarchie"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: 13,
            padding: "0.4rem 0.75rem",
            background: "var(--uwe-surface)",
            border: "1px solid var(--uwe-border)",
            borderRadius: "var(--uwe-radius)",
          }}
        >
          {parentChainItems.map((item, idx) => (
            <span key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              {idx > 0 && <span style={{ color: "var(--uwe-muted)" }}>›</span>}
              <a
                href={`/worlds/${worldSlug}/atlas/${item.id}`}
                style={{ color: "var(--uwe-accent)", textDecoration: "none" }}
              >
                {LEVEL_LABELS[item.level] ?? item.level}: {item.title}
              </a>
            </span>
          ))}
          {parentChainItems.length > 0 && <span style={{ color: "var(--uwe-muted)" }}>›</span>}
          <span style={{ fontWeight: 600 }}>
            {nodeLevel ? `${LEVEL_LABELS[nodeLevel] ?? nodeLevel}: ` : ""}{nodeTitle}
          </span>
        </nav>
      )}

      {/* Toolbar */}
      <div className="uwe-atlas-toolbar" style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem",
        alignItems: "center",
        padding: "0.5rem",
        background: "var(--uwe-surface)",
        border: "1px solid var(--uwe-border)",
        borderRadius: "var(--uwe-radius)",
      }}>
        {(
          [
            { mode: "select" as ToolMode, label: "Auswahl", shortcut: "S" },
            { mode: "polygon" as ToolMode, label: "Region", shortcut: "P" },
            { mode: "path" as ToolMode, label: "Fluss", shortcut: "R" },
            { mode: "biome" as ToolMode, label: "Biom", shortcut: "B" },
            { mode: "road" as ToolMode, label: "Straße", shortcut: "D" },
            { mode: "label" as ToolMode, label: "Label", shortcut: "L" },
            { mode: "curvedLabel" as ToolMode, label: "Gebogen", shortcut: "C" },
            { mode: "pin" as ToolMode, label: "Pin", shortcut: "I" },
            { mode: "stamp" as ToolMode, label: "Glyph", shortcut: "T" },
            { mode: "measure" as ToolMode, label: "Messen", shortcut: "M" },
            { mode: "eraser" as ToolMode, label: "Löschen", shortcut: "E" },
          ] as { mode: ToolMode; label: string; shortcut: string }[]
        ).map(({ mode, label, shortcut }) => (
          <button
            key={mode}
            type="button"
            onClick={() => dispatch({ type: "SET_TOOL", tool: mode })}
            className={`uwe-v2-btn ${state.tool === mode ? "uwe-v2-btn-primary" : "uwe-v2-btn-secondary"}`}
            title={`${label} (${shortcut})`}
            aria-pressed={state.tool === mode}
          >
            {label}
          </button>
        ))}

        <div style={{ height: 24, width: 1, background: "var(--uwe-border)" }} />

        {/* Label colour toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: 13 }}>
          <span>Tinte:</span>
          {(["black", "red"] as LabelColor[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => dispatch({ type: "SET_LABEL_COLOR", color: c })}
              aria-pressed={state.labelColor === c}
              title={c === "black" ? "Schwarze Tinte" : "Rote Tinte"}
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: c === "black" ? "#1a1008" : "#8b1a10",
                border: state.labelColor === c ? "2px solid #2563eb" : "2px solid transparent",
                cursor: "pointer",
              }}
            />
          ))}
        </label>

        {state.tool === "curvedLabel" && state.drawingPoints.length >= 1 && (
          <span className="uwe-muted" style={{ fontSize: 12 }}>
            Pfad zeichnen, dann <kbd>Enter</kbd> für Label-Text
          </span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          {/* Hex grid toggle */}
          <button
            type="button"
            className={`uwe-v2-btn ${state.showHexGrid ? "uwe-v2-btn-primary" : "uwe-v2-btn-secondary"}`}
            onClick={() => dispatch({ type: "TOGGLE_HEX_GRID" })}
            title="Hexgitter ein-/ausblenden (H)"
            aria-pressed={state.showHexGrid}
          >
            ⬡ Hex
          </button>

          {/* Export PNG */}
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-secondary"
            onClick={handleExportPng}
            title="Aktuelle Kartenansicht als PNG exportieren"
          >
            ↓ PNG
          </button>

          {/* Als Handout */}
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-secondary"
            onClick={() => void handleCreateHandout()}
            title="Handout-Seite aus dieser Karte erstellen"
          >
            ↗ Handout
          </button>

          <div style={{ height: 24, width: 1, background: "var(--uwe-border)" }} />

          {/* Portal-Freigabe (map-level) */}
          <button
            type="button"
            className={`uwe-v2-btn ${mapVisibility === "player_visible" ? "uwe-v2-btn-primary" : "uwe-v2-btn-secondary"}`}
            onClick={handleToggleMapVisibility}
            disabled={isVisibilityPending}
            title={
              "Portal-Freigabe der Karte. Spieler sehen Inhalte nur, wenn Karte + " +
              "Knoten + die einzelnen Features/Objekte auf 'player_visible' stehen."
            }
            aria-pressed={mapVisibility === "player_visible"}
          >
            {mapVisibility === "player_visible" ? "🌐 Karte freigegeben" : "🔒 Karte privat"}
          </button>

          {/* Node-level visibility */}
          <button
            type="button"
            className={`uwe-v2-btn ${nodeVisibility === "player_visible" ? "uwe-v2-btn-primary" : "uwe-v2-btn-secondary"}`}
            onClick={handleToggleNodeVisibility}
            disabled={isVisibilityPending}
            title="Portal-Sichtbarkeit dieses Knotens (Ebene)."
            aria-pressed={nodeVisibility === "player_visible"}
          >
            {nodeVisibility === "player_visible" ? "🌐 Ebene sichtbar" : "🔒 Ebene privat"}
          </button>

          {saveMsg && <span style={{ fontSize: 13, color: "green" }}>{saveMsg}</span>}
          {state.dirty && !saveMsg && (
            <span style={{ fontSize: 12, color: "var(--uwe-muted)" }}>Ungespeicherte Änderungen</span>
          )}
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-secondary"
            onClick={() => setShowProceduralPanel(true)}
            title="Prozeduralen Karten-Entwurf mit KI-Benennung generieren"
          >
            ✦ Entwurf generieren
          </button>
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-secondary"
            onClick={() => setShowStampGenerator(true)}
            title="KI-Stempel generieren (Tolkien-Stil Linienkunst)"
          >
            ✦ Stempel generieren
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !state.dirty}
            className="uwe-v2-btn uwe-v2-btn-primary"
          >
            {isPending ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </div>

      {/* Biome brush options */}
      {state.tool === "biome" && (
        <div className="uwe-atlas-biome-bar" style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          alignItems: "center",
          padding: "0.5rem",
          background: "var(--uwe-surface)",
          border: "1px solid var(--uwe-border)",
          borderRadius: "var(--uwe-radius)",
        }}>
          <span style={{ fontSize: 12, color: "var(--uwe-muted)" }}>Biom:</span>
          {(Object.values(BiomeKind) as BiomeKind[]).map((bk) => (
            <button
              key={bk}
              type="button"
              onClick={() => dispatch({ type: "SET_BIOME_KIND", kind: bk })}
              aria-pressed={state.activeBiomeKind === bk}
              className={`uwe-v2-btn ${state.activeBiomeKind === bk ? "uwe-v2-btn-primary" : "uwe-v2-btn-secondary"}`}
              style={{ fontSize: 12, padding: "0.2rem 0.5rem" }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: BIOME_FILL[bk],
                  border: `1px solid ${BIOME_STROKE[bk]}`,
                  marginRight: 4,
                  verticalAlign: "middle",
                }}
              />
              {BIOME_LABELS[bk]}
            </button>
          ))}
          <div style={{ height: 24, width: 1, background: "var(--uwe-border)" }} />
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: 12 }}>
            Dichte:
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.1"
              value={state.biomeDensity}
              onChange={(e) => dispatch({ type: "SET_BIOME_DENSITY", density: parseFloat(e.target.value) })}
              style={{ width: 80 }}
            />
            <span style={{ minWidth: 28, textAlign: "right" }}>{state.biomeDensity.toFixed(1)}</span>
          </label>
        </div>
      )}

      {/* Glyph palette when stamp tool active */}
      {state.tool === "stamp" && (
        <div className="uwe-atlas-palette" style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          padding: "0.5rem",
          background: "var(--uwe-surface)",
          border: "1px solid var(--uwe-border)",
          borderRadius: "var(--uwe-radius)",
        }}>
          {/* Builtin glyphs row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--uwe-muted)", alignSelf: "center" }}>Eingebaut:</span>
            {BUILTIN_GLYPHS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => dispatch({ type: "SET_GLYPH", key: g.key })}
                title={g.name}
                aria-pressed={state.activeGlyphKey === g.key}
                style={{
                  padding: "0.25rem",
                  background: state.activeGlyphKey === g.key
                    ? "var(--uwe-accent-10)"
                    : "var(--uwe-bg)",
                  border: state.activeGlyphKey === g.key
                    ? "2px solid var(--uwe-accent)"
                    : "1px solid var(--uwe-border)",
                  borderRadius: 4,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <GlyphSvg glyph={g} size={22} />
                <span style={{ fontSize: 9 }}>{g.name}</span>
              </button>
            ))}
          </div>

          {/* AI palette items */}
          {stampPaletteItems.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <div style={{
                fontSize: 11,
                color: "var(--uwe-muted)",
                borderTop: "1px solid var(--uwe-border)",
                paddingTop: "0.35rem",
              }}>
                KI-Stempel
              </div>
              {/* Approved stamps */}
              {stampPaletteItems.filter((p) => p.reviewStatus === "approved").length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
                  {stampPaletteItems
                    .filter((p) => p.reviewStatus === "approved")
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => dispatch({ type: "SET_GLYPH", key: p.id })}
                        title={p.name}
                        aria-pressed={state.activeGlyphKey === p.id}
                        style={{
                          padding: "0.25rem",
                          background: state.activeGlyphKey === p.id
                            ? "var(--uwe-accent-10)"
                            : "var(--uwe-bg)",
                          border: state.activeGlyphKey === p.id
                            ? "2px solid var(--uwe-accent)"
                            : "1px solid var(--uwe-border)",
                          borderRadius: 4,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 2,
                          width: 44,
                        }}
                      >
                        {p.imageData && p.mimeType ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`data:${p.mimeType};base64,${p.imageData}`}
                            alt={p.name}
                            style={{ width: 30, height: 30, objectFit: "contain" }}
                          />
                        ) : (
                          <span style={{ fontSize: 18 }}>✦</span>
                        )}
                        <span style={{ fontSize: 8, maxWidth: 40, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.name}
                        </span>
                      </button>
                    ))}
                </div>
              )}
              {/* Pending stamps — approve or delete */}
              {stampPaletteItems.filter((p) => p.reviewStatus === "pending").length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <span style={{ fontSize: 11, color: "var(--uwe-muted)" }}>Ausstehend (Genehmigung erforderlich):</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {stampPaletteItems
                      .filter((p) => p.reviewStatus === "pending")
                      .map((p) => (
                        <div
                          key={p.id}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 2,
                            padding: "0.25rem",
                            border: "1px dashed var(--uwe-border)",
                            borderRadius: 4,
                            background: "var(--uwe-bg)",
                            width: 60,
                          }}
                        >
                          {p.imageData && p.mimeType ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`data:${p.mimeType};base64,${p.imageData}`}
                              alt={p.name}
                              style={{ width: 30, height: 30, objectFit: "contain", opacity: 0.6 }}
                            />
                          ) : (
                            <span style={{ fontSize: 18, opacity: 0.6 }}>✦</span>
                          )}
                          <span style={{ fontSize: 8, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.name}
                          </span>
                          <div style={{ display: "flex", gap: 2 }}>
                            <button
                              type="button"
                              title="Genehmigen"
                              className="uwe-v2-btn uwe-v2-btn-secondary"
                              style={{ fontSize: 10, padding: "0.1rem 0.3rem", lineHeight: 1 }}
                              onClick={() => {
                                const fd = new FormData();
                                fd.set("worldSlug", worldSlug);
                                fd.set("nodeId", nodeId);
                                fd.set("itemId", p.id);
                                void approveAtlasPaletteItemAction(fd).then(() => {
                                  setPaletteItems((prev) =>
                                    prev.map((pi) =>
                                      pi.id === p.id ? { ...pi, reviewStatus: "approved" as const } : pi,
                                    ),
                                  );
                                });
                              }}
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              title="Löschen"
                              className="uwe-v2-btn uwe-v2-btn-danger"
                              style={{ fontSize: 10, padding: "0.1rem 0.3rem", lineHeight: 1 }}
                              onClick={() => {
                                const fd = new FormData();
                                fd.set("worldSlug", worldSlug);
                                fd.set("nodeId", nodeId);
                                fd.set("itemId", p.id);
                                void deleteAtlasPaletteItemAction(fd).then(() => {
                                  setPaletteItems((prev) => prev.filter((pi) => pi.id !== p.id));
                                });
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Canvas area */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <div
          ref={containerRef}
          style={{
            position: "relative",
            flex: 1,
            minHeight: 480,
            border: `2px solid ${preset.colors.ink}`,
            borderRadius: 4,
            overflow: "hidden",
            background: preset.colors.parchment,
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              touchAction: "none",
              cursor: toolCursor[state.tool],
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onDoubleClick={onDoubleClick as unknown as React.MouseEventHandler<HTMLCanvasElement>}
            onWheel={onWheel}
          />

          {/* Decorations overlay */}
          <div style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
          }}>
            {preset.decorations.compassRose && <CompassRose />}
            {preset.decorations.scaleBar && <ScaleBar preset={preset} />}
          </div>

          {/* Map title */}
          <div style={{
            position: "absolute",
            top: 12,
            left: 0,
            right: 0,
            textAlign: "center",
            pointerEvents: "none",
            fontFamily: preset.typography.title,
            fontSize: 18,
            color: preset.colors.ink,
            textShadow: `1px 1px 2px ${preset.colors.parchment}`,
          }}>
            {nodeTitle}
          </div>

          {/* Draw hint */}
          {isDrawingTool && (
            <div style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              background: "rgba(255,255,255,0.85)",
              border: "1px solid var(--uwe-border)",
              borderRadius: 4,
              padding: "0.25rem 0.5rem",
              fontSize: 12,
              pointerEvents: "none",
            }}>
              {(state.tool === "polygon" || state.tool === "biome")
                ? `${state.drawingPoints.length} Punkte — Doppelklick oder Klick auf Startpunkt zum Schließen | Esc abbr.`
                : `${state.drawingPoints.length} Punkte — Doppelklick zum Abschließen | Esc abbr.`}
              {state.tool === "biome" && (
                <span style={{ marginLeft: 8, fontWeight: 600 }}>
                  [{BIOME_LABELS[state.activeBiomeKind]}]
                </span>
              )}
            </div>
          )}

          {/* Measure hint */}
          {state.tool === "measure" && (
            <div style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              background: "rgba(255,255,240,0.92)",
              border: "1px solid #f59e0b",
              borderRadius: 4,
              padding: "0.25rem 0.5rem",
              fontSize: 12,
              pointerEvents: "none",
              color: "#92400e",
            }}>
              {state.measurePoints.length === 0 && "Ersten Punkt klicken"}
              {state.measurePoints.length === 1 && "Zweiten Punkt klicken"}
              {state.measurePoints.length === 2 && (() => {
                const dx = state.measurePoints[1]![0] - state.measurePoints[0]![0];
                const dy = state.measurePoints[1]![1] - state.measurePoints[0]![1];
                const dist = Math.sqrt(dx * dx + dy * dy) * MAP_SCALE_LEAGUES;
                return `Distanz: ${dist.toFixed(1)} ${preset.decorations.scaleUnit} — erneut klicken zum Zurücksetzen`;
              })()}
            </div>
          )}
        </div>

        {/* Selection panel */}
        <div style={{
          width: 200,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}>
          <div style={{
            padding: "0.75rem",
            background: "var(--uwe-surface)",
            border: "1px solid var(--uwe-border)",
            borderRadius: "var(--uwe-radius)",
            fontSize: 13,
          }}>
            <strong>Auswahl</strong>
            {!state.selectedKey && (
              <p style={{ color: "var(--uwe-muted)", marginTop: "0.25rem" }}>Nichts ausgewählt</p>
            )}
            {selectedFeature && (
              <div style={{ marginTop: "0.5rem" }}>
                <div><strong>Art:</strong> {selectedFeature.kind}</div>
                <div><strong>Layer:</strong> {selectedFeature.layer ?? 0}</div>
                {selectedFeature.kind === "biome" && selectedFeature.style && (
                  <div>
                    <div><strong>Biom:</strong> {BIOME_LABELS[(selectedFeature.style as unknown as BiomeStyle).biomeKind]}</div>
                    <div><strong>Dichte:</strong> {(selectedFeature.style as unknown as BiomeStyle).density.toFixed(1)}</div>
                  </div>
                )}
                {selectedFeature.labelText && (
                  <div><strong>Text:</strong> {selectedFeature.labelText}</div>
                )}
                {selectedFeature.geometry.type === "LabelAnchor" &&
                  selectedFeature.geometry.pathCoordinates &&
                  selectedFeature.geometry.pathCoordinates.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "TOGGLE_SELECTED_PATH_REVERSAL" })}
                    className="uwe-v2-btn uwe-v2-btn-secondary"
                    style={{ marginTop: "0.5rem", width: "100%", fontSize: 12 }}
                  >
                    {selectedFeature.geometry.pathReversed ? "↔ Pfad normal" : "↔ Pfad umkehren"}
                  </button>
                )}

                {/* Drill-down button only for saved region features */}
                {selectedFeature.kind === "region" && selectedFeature.id && (
                  <div style={{ marginTop: "0.5rem" }}>
                    {selectedFeature.childNodeId ? (
                      <a
                        href={`/worlds/${worldSlug}/atlas/${selectedFeature.childNodeId}`}
                        className="uwe-v2-btn uwe-v2-btn-secondary"
                        style={{ display: "block", width: "100%", textAlign: "center", marginBottom: "0.25rem" }}
                      >
                        ↓ Drill Down
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setDrillDownFeatureId(selectedFeature.id!);
                          setDrillTitle(selectedFeature.labelText ?? nodeTitle);
                        }}
                        className="uwe-v2-btn uwe-v2-btn-secondary"
                        style={{ width: "100%", marginBottom: "0.25rem" }}
                      >
                        ↓ Unterebene erstellen
                      </button>
                    )}
                  </div>
                )}

                {/* Region AI describe */}
                {selectedFeature.kind === "region" && (
                  <button
                    type="button"
                    onClick={() => setDescribeFeature(selectedFeature)}
                    className="uwe-v2-btn uwe-v2-btn-secondary"
                    style={{ marginTop: "0.25rem", width: "100%" }}
                  >
                    ✦ Beschreiben
                  </button>
                )}

                {/* Pin → Page link */}
                {selectedFeature.kind === "pin" && (
                  <div style={{ marginTop: "0.5rem" }}>
                    {selectedFeature.linkedPageHref ? (
                      <a
                        href={selectedFeature.linkedPageHref}
                        className="uwe-v2-btn uwe-v2-btn-secondary"
                        style={{ display: "block", width: "100%", textAlign: "center", marginBottom: "0.25rem", fontSize: 12 }}
                        target="_blank"
                        rel="noreferrer"
                      >
                        ↗ Wiki-Seite
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setPinLinkFeature(selectedFeature);
                        setPinPageIdInput(selectedFeature.linkedPageId ?? "");
                        setPinNewPageTitle(selectedFeature.labelText ?? "");
                      }}
                      className="uwe-v2-btn uwe-v2-btn-secondary"
                      style={{ width: "100%", fontSize: 12 }}
                    >
                      {selectedFeature.linkedPageId ? "↗ Seite ändern" : "↗ Seite verknüpfen"}
                    </button>
                  </div>
                )}

                {/* Per-feature Portal visibility */}
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "SET_FEATURE_VISIBILITY",
                      key: selectedFeature._key,
                      visibility:
                        selectedFeature.visibility === "player_visible" ? "dm_only" : "player_visible",
                    })
                  }
                  className={`uwe-v2-btn ${selectedFeature.visibility === "player_visible" ? "uwe-v2-btn-primary" : "uwe-v2-btn-secondary"}`}
                  style={{ marginTop: "0.5rem", width: "100%", fontSize: 12 }}
                  title="Portal-Sichtbarkeit dieses Elements"
                >
                  {selectedFeature.visibility === "player_visible" ? "🌐 Für Spieler sichtbar" : "🔒 Nur DM"}
                </button>

                <button
                  type="button"
                  onClick={() => dispatch({ type: "ERASE_SELECTED" })}
                  className="uwe-v2-btn uwe-v2-btn-danger"
                  style={{ marginTop: "0.25rem", width: "100%" }}
                >
                  Löschen
                </button>
              </div>
            )}
            {selectedObject && (
              <div style={{ marginTop: "0.5rem" }}>
                <div>
                  <strong>Glyph:</strong>{" "}
                  {paletteItemById.get(selectedObject.paletteItemId)?.name ?? selectedObject.paletteItemId}
                </div>
                <div><strong>Skalierung:</strong> {selectedObject.scale.toFixed(2)}×</div>

                {/* Per-object Portal visibility */}
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "SET_OBJECT_VISIBILITY",
                      key: selectedObject._key,
                      visibility:
                        selectedObject.visibility === "player_visible" ? "dm_only" : "player_visible",
                    })
                  }
                  className={`uwe-v2-btn ${selectedObject.visibility === "player_visible" ? "uwe-v2-btn-primary" : "uwe-v2-btn-secondary"}`}
                  style={{ marginTop: "0.5rem", width: "100%", fontSize: 12 }}
                  title="Portal-Sichtbarkeit dieses Stempels"
                >
                  {selectedObject.visibility === "player_visible" ? "🌐 Für Spieler sichtbar" : "🔒 Nur DM"}
                </button>

                <button
                  type="button"
                  onClick={() => dispatch({ type: "ERASE_SELECTED" })}
                  className="uwe-v2-btn uwe-v2-btn-danger"
                  style={{ marginTop: "0.5rem", width: "100%" }}
                >
                  Löschen
                </button>
              </div>
            )}
          </div>

          {/* Portal publishing hint */}
          <div style={{
            padding: "0.75rem",
            background: "var(--uwe-surface)",
            border: "1px solid var(--uwe-border)",
            borderRadius: "var(--uwe-radius)",
            fontSize: 12,
          }}>
            <strong>Portal-Freigabe</strong>
            <p style={{ color: "var(--uwe-muted)", margin: "0.25rem 0 0", lineHeight: 1.5 }}>
              Spieler sehen Inhalte erst, wenn <em>Karte</em>, <em>Ebene</em> und das
              jeweilige <em>Feature/Objekt</em> auf „Für Spieler sichtbar“ stehen.
              Neue Elemente sind standardmäßig „Nur DM“.
            </p>
            <p style={{ margin: "0.4rem 0 0", color: "var(--uwe-muted)" }}>
              Karte: <strong>{mapVisibility === "player_visible" ? "freigegeben" : "privat"}</strong>
              {" · "}Ebene: <strong>{nodeVisibility === "player_visible" ? "sichtbar" : "privat"}</strong>
            </p>
          </div>

          <div style={{
            padding: "0.75rem",
            background: "var(--uwe-surface)",
            border: "1px solid var(--uwe-border)",
            borderRadius: "var(--uwe-radius)",
            fontSize: 12,
            color: "var(--uwe-muted)",
          }}>
            <strong>Shortcuts</strong>
            <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1rem", lineHeight: "1.8" }}>
              <li>S — Auswahl</li>
              <li>P — Region</li>
              <li>R — Fluss</li>
              <li>B — Biom</li>
              <li>D — Straße</li>
              <li>L — Label</li>
              <li>I — Pin</li>
              <li>T — Glyph</li>
              <li>M — Messen</li>
              <li>H — Hex-Gitter</li>
              <li>E — Radierer</li>
              <li>Del — Element löschen</li>
              <li>Esc — Abbrechen</li>
            </ul>
            <p style={{ marginTop: "0.5rem" }}>Wheel: Zoom · Drag Hintergrund: Pan</p>
          </div>

          {/* Measure tool status */}
          {state.tool === "measure" && (
            <div style={{
              padding: "0.75rem",
              background: "var(--uwe-surface)",
              border: "1px solid var(--uwe-border)",
              borderRadius: "var(--uwe-radius)",
              fontSize: 12,
            }}>
              <strong>Messen</strong>
              <p style={{ color: "var(--uwe-muted)", margin: "0.25rem 0" }}>
                {state.measurePoints.length === 0
                  ? "1. Punkt klicken"
                  : state.measurePoints.length === 1
                    ? "2. Punkt klicken"
                    : (() => {
                        const dx = state.measurePoints[1]![0] - state.measurePoints[0]![0];
                        const dy = state.measurePoints[1]![1] - state.measurePoints[0]![1];
                        const dist = Math.sqrt(dx * dx + dy * dy) * MAP_SCALE_LEAGUES;
                        return `${dist.toFixed(1)} ${preset.decorations.scaleUnit}`;
                      })()
                }
              </p>
              {state.measurePoints.length === 2 && (
                <button
                  type="button"
                  className="uwe-v2-btn uwe-v2-btn-secondary"
                  style={{ fontSize: 11, padding: "0.1rem 0.4rem" }}
                  onClick={() => dispatch({ type: "CLEAR_MEASURE" })}
                >
                  Zurücksetzen
                </button>
              )}
            </div>
          )}

          {/* Background image underlay */}
          <div style={{
            padding: "0.75rem",
            background: "var(--uwe-surface)",
            border: "1px solid var(--uwe-border)",
            borderRadius: "var(--uwe-radius)",
            fontSize: 12,
          }}>
            <strong>Unterlegbild</strong>
            <p style={{ color: "var(--uwe-muted)", margin: "0.25rem 0" }}>
              {bgAssetId ? "Bild aktiv" : "Kein Bild"}
            </p>
            <input
              type="file"
              ref={bgUploadRef}
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleBgUpload(file);
                e.target.value = "";
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-secondary"
                style={{ fontSize: 11 }}
                disabled={bgUploadPending}
                onClick={() => bgUploadRef.current?.click()}
              >
                {bgUploadPending ? "Lädt hoch…" : "Bild hochladen"}
              </button>
              {bgAssetId && (
                <button
                  type="button"
                  className="uwe-v2-btn uwe-v2-btn-secondary"
                  style={{ fontSize: 11 }}
                  onClick={() => void handleBgClear()}
                >
                  Bild entfernen
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Label input dialog */}
      {labelPrompt && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (labelText.trim()) {
                if (labelPrompt.mode === "straight") {
                  dispatch({ type: "PLACE_LABEL", point: labelPrompt.point, text: labelText.trim() });
                } else {
                  dispatch({
                    type: "PLACE_CURVED_LABEL",
                    path: labelPrompt.path,
                    text: labelText.trim(),
                  });
                }
              }
              setLabelPrompt(null);
              setLabelText("");
            }}
            style={{
              background: "var(--uwe-bg)",
              border: "1px solid var(--uwe-border)",
              borderRadius: "var(--uwe-radius)",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              minWidth: 300,
            }}
          >
            <h3 style={{ margin: 0 }}>
              {labelPrompt.mode === "curved" ? "Gebogenes Label" : "Label-Text"}
            </h3>
            <input
              className="uwe-input"
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              placeholder="z.B. Nebelgebirge"
              autoFocus
            />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary" style={{ flex: 1 }}>
                Platzieren
              </button>
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-secondary"
                onClick={() => { setLabelPrompt(null); setLabelText(""); }}
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Procedural draft panel */}
      {showProceduralPanel && (
        <ProceduralDraftPanel
          worldSlug={worldSlug}
          nodeId={nodeId}
          onApply={(features) => {
            dispatch({ type: "APPEND_DRAFT_FEATURES", features });
          }}
          onClose={() => setShowProceduralPanel(false)}
        />
      )}

      {/* Region describe panel */}
      {describeFeature && (
        <RegionDescribePanel
          worldSlug={worldSlug}
          feature={describeFeature}
          onClose={() => setDescribeFeature(null)}
        />
      )}

      {/* AI Stamp Generator panel */}
      {showStampGenerator && (
        <AtlasStampGenerator
          worldSlug={worldSlug}
          nodeId={nodeId}
          onClose={() => setShowStampGenerator(false)}
          onSaved={() => {
            // Palette items will be refreshed by router.refresh() inside AtlasStampGenerator
          }}
        />
      )}

      {/* Pin page link dialog */}
      {pinLinkFeature && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "var(--uwe-bg)",
            border: "1px solid var(--uwe-border)",
            borderRadius: "var(--uwe-radius)",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            minWidth: 360,
            maxWidth: 480,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Pin mit Wiki-Seite verknüpfen</h3>
              <button
                type="button"
                onClick={() => setPinLinkFeature(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}
                aria-label="Schließen"
              >×</button>
            </div>

            {/* Link existing page */}
            <div>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: 13 }}>
                Bestehende Seite verknüpfen (Seiten-ID)
                <input
                  className="uwe-input"
                  value={pinPageIdInput}
                  onChange={(e) => setPinPageIdInput(e.target.value)}
                  placeholder="Seiten-ID einfügen…"
                />
              </label>
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-secondary"
                style={{ marginTop: "0.5rem", width: "100%" }}
                disabled={!pinPageIdInput.trim() || isPinLinking}
                onClick={() => {
                  if (!pinLinkFeature || !pinPageIdInput.trim()) return;
                  const feat = pinLinkFeature;
                  const pageId = pinPageIdInput.trim();
                  setPinLinkFeature(null);
                  startPinLinkTransition(async () => {
                    if (feat.id) {
                      const fd = new FormData();
                      fd.set("worldSlug", worldSlug);
                      fd.set("nodeId", nodeId);
                      fd.set("featureId", feat.id);
                      fd.set("pageId", pageId);
                      await linkPinToPageAction(fd);
                    }
                    dispatch({
                      type: "SET_FEATURE_LINKED_PAGE",
                      key: feat._key,
                      linkedPageId: pageId,
                    });
                  });
                }}
              >
                Verknüpfen
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ flex: 1, height: 1, background: "var(--uwe-border)" }} />
              <span style={{ fontSize: 12, color: "var(--uwe-muted)" }}>oder neue Seite</span>
              <div style={{ flex: 1, height: 1, background: "var(--uwe-border)" }} />
            </div>

            {/* Create new page */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: 13 }}>
                Titel der neuen Seite
                <input
                  className="uwe-input"
                  value={pinNewPageTitle}
                  onChange={(e) => setPinNewPageTitle(e.target.value)}
                  placeholder="z.B. Stadt Eisenheim"
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: 13 }}>
                Seitentyp
                <select
                  className="uwe-input"
                  value={pinNewPageType}
                  onChange={(e) => setPinNewPageType(e.target.value as "location" | "region")}
                >
                  <option value="location">Ort (location)</option>
                  <option value="region">Region (region)</option>
                </select>
              </label>
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-primary"
                style={{ width: "100%" }}
                disabled={!pinNewPageTitle.trim() || isPinLinking}
                onClick={() => {
                  if (!pinLinkFeature || !pinNewPageTitle.trim()) return;
                  const feat = pinLinkFeature;
                  const title = pinNewPageTitle.trim();
                  const type = pinNewPageType;
                  setPinLinkFeature(null);
                  startPinLinkTransition(async () => {
                    const fd = new FormData();
                    fd.set("worldSlug", worldSlug);
                    fd.set("nodeId", nodeId);
                    fd.set("featureId", feat.id ?? "");
                    fd.set("title", title);
                    fd.set("pageType", type);
                    const result = await createPinPageAction(fd);
                    dispatch({
                      type: "SET_FEATURE_LINKED_PAGE",
                      key: feat._key,
                      linkedPageId: result.pageId,
                    });
                  });
                }}
              >
                {isPinLinking ? "Erstelle…" : "Seite erstellen & verknüpfen"}
              </button>
            </div>

            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-secondary"
              onClick={() => setPinLinkFeature(null)}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Drill-down child node creation dialog */}
      {drillDownFeatureId && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!drillTitle.trim()) return;
              const featureId = drillDownFeatureId;
              const title = drillTitle.trim();
              const level = drillLevel;
              setDrillDownFeatureId(null);
              startDrillTransition(async () => {
                const fd = new FormData();
                fd.set("worldSlug", worldSlug);
                fd.set("parentNodeId", nodeId);
                fd.set("parentFeatureId", featureId);
                fd.set("level", level);
                fd.set("title", title);
                const result = await createChildNodeAction(fd);
                router.push(`/worlds/${worldSlug}/atlas/${result.nodeId}`);
              });
            }}
            style={{
              background: "var(--uwe-bg)",
              border: "1px solid var(--uwe-border)",
              borderRadius: "var(--uwe-radius)",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              minWidth: 320,
            }}
          >
            <h3 style={{ margin: 0 }}>Unterebene erstellen</h3>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: 13 }}>
              Name
              <input
                className="uwe-input"
                value={drillTitle}
                onChange={(e) => setDrillTitle(e.target.value)}
                placeholder="z.B. Nordküste"
                autoFocus
                required
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: 13 }}>
              Ebene
              <select
                className="uwe-input"
                value={drillLevel}
                onChange={(e) => setDrillLevel(e.target.value)}
              >
                {["globe", "continent", "landscape", "city"].map((lvl) => (
                  <option key={lvl} value={lvl}>{LEVEL_LABELS[lvl] ?? lvl}</option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                className="uwe-v2-btn uwe-v2-btn-primary"
                style={{ flex: 1 }}
                disabled={isDrillPending}
              >
                {isDrillPending ? "Erstelle…" : "Erstellen & öffnen"}
              </button>
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-secondary"
                onClick={() => setDrillDownFeatureId(null)}
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Minimal SVG path parser for Canvas 2D (supports M, L, Z, Q, H, V commands)
// ---------------------------------------------------------------------------

function drawSvgPath(ctx: CanvasRenderingContext2D, d: string) {
  const cmds = d.match(/[MLHVZQCSA][^MLHVZQCSA]*/gi) ?? [];
  let x = 0;
  let y = 0;

  for (const cmd of cmds) {
    const op = cmd[0]!.toUpperCase();
    const args = cmd
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);

    switch (op) {
      case "M":
        x = args[0] ?? 0;
        y = args[1] ?? 0;
        ctx.moveTo(x, y);
        break;
      case "L":
        x = args[0] ?? x;
        y = args[1] ?? y;
        ctx.lineTo(x, y);
        break;
      case "H":
        x = args[0] ?? x;
        ctx.lineTo(x, y);
        break;
      case "V":
        y = args[0] ?? y;
        ctx.lineTo(x, y);
        break;
      case "Z":
        ctx.closePath();
        break;
      case "Q":
        ctx.quadraticCurveTo(args[0] ?? x, args[1] ?? y, args[2] ?? x, args[3] ?? y);
        x = args[2] ?? x;
        y = args[3] ?? y;
        break;
      case "C":
        ctx.bezierCurveTo(
          args[0] ?? x, args[1] ?? y,
          args[2] ?? x, args[3] ?? y,
          args[4] ?? x, args[5] ?? y,
        );
        x = args[4] ?? x;
        y = args[5] ?? y;
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Geometry utilities
// ---------------------------------------------------------------------------

function pointInPolygon(p: [number, number], ring: [number, number][]): boolean {
  const [px, py] = p;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Stable integer hash for a short string (used as scatter seed). */
function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}
