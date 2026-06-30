"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
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

// ---------------------------------------------------------------------------
// Types (subset of Studio EditorFeature / EditorObject, read-only)
// ---------------------------------------------------------------------------

export interface ViewerFeatureGeometry {
  type: "Point" | "Path" | "Polygon" | "LabelAnchor";
  coordinates?: [number, number] | [number, number][];
  rings?: [number, number][][];
  text?: string;
  pathCoordinates?: [number, number][];
  pathReversed?: boolean;
}

export interface ViewerFeature {
  id?: string;
  kind: "region" | "river" | "road" | "biome" | "relief" | "label" | "pin";
  geometry: ViewerFeatureGeometry;
  style?: Record<string, unknown>;
  labelText?: string | null;
  labelColor?: "black" | "red" | null;
  childNodeId?: string | null;
  linkedPageId?: string | null;
  layer?: number;
  _key: string;
}

export interface ViewerObject {
  id?: string;
  paletteItemId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  layer?: number;
  linkedPageId?: string | null;
  _key: string;
}

export interface NodeAncestorItem {
  id: string;
  title: string;
  level: string;
}

/** Map from pageId → portal slug for wiki link resolution. */
export interface PageLinkMap {
  [pageId: string]: string;
}

/** Serializable palette item passed from the server loader. */
export interface PaletteItemInfo {
  source: string;
  builtinGlyphKey: string | null;
  /** Base64 image data for ai/upload stamps (may already be a data URL). */
  imageData?: string;
  mimeType?: string;
}

/** Map from AtlasObject.paletteItemId → its palette item metadata. */
export interface PaletteItemMap {
  [paletteItemId: string]: PaletteItemInfo;
}

export interface AtlasViewerProps {
  worldSlug: string;
  nodeId: string;
  nodeTitle: string;
  nodeLevel?: string;
  features: ViewerFeature[];
  objects: ViewerObject[];
  preset?: AtlasStylePreset;
  parentChainItems?: NodeAncestorItem[];
  parentSilhouette?: [number, number][][];
  /** pageId → portal slug for clickable wiki links. */
  pageLinkMap?: PageLinkMap;
  /** paletteItemId → palette item metadata for stamp rendering. */
  paletteItems?: PaletteItemMap;
}

// ---------------------------------------------------------------------------
// Builtin glyph definitions (must mirror Studio to render correctly)
// ---------------------------------------------------------------------------

interface BuiltinGlyph {
  key: string;
  name: string;
  pathData: string;
  color?: string;
}

const BUILTIN_GLYPHS: BuiltinGlyph[] = [
  { key: "mountain", name: "Berg", pathData: "M12 2 L22 20 L2 20 Z M7 20 L12 10 L17 20", color: "#7a6b52" },
  { key: "mountain_snow", name: "Schneeberg", pathData: "M12 2 L22 20 L2 20 Z M9 11 L12 6 L15 11 Z", color: "#a8b8c4" },
  { key: "tree", name: "Wald", pathData: "M12 3 L19 17 L5 17 Z M12 17 L12 22 M10 22 L14 22", color: "#4a6741" },
  { key: "city", name: "Stadt", pathData: "M7 22 L7 12 L9 12 L9 10 L11 10 L11 8 L13 8 L13 10 L15 10 L15 12 L17 12 L17 22 Z M10 22 L10 16 L14 16 L14 22", color: "#1a1008" },
  { key: "village", name: "Dorf", pathData: "M12 4 L20 11 L20 22 L4 22 L4 11 Z M4 11 L12 4 L20 11 M9 22 L9 15 L15 15 L15 22", color: "#6b4a2a" },
  { key: "ruin", name: "Ruine", pathData: "M5 22 L5 12 L8 12 L8 8 M8 8 L10 10 M16 8 L16 12 L19 12 L19 22 M10 14 L14 14 L14 22 L10 22 Z", color: "#8b7355" },
  { key: "castle", name: "Burg", pathData: "M4 22 L4 14 L6 14 L6 12 L8 12 L8 14 L10 14 L10 12 L14 12 L14 14 L16 14 L16 12 L18 12 L18 14 L20 14 L20 22 Z M10 22 L10 17 L14 17 L14 22", color: "#1a1008" },
  { key: "water", name: "See/Meer", pathData: "M2 12 Q6 8 10 12 Q14 16 18 12 Q20 10 22 12 M2 16 Q6 12 10 16 Q14 20 18 16 Q20 14 22 16", color: "#a8c4d4" },
];

// ---------------------------------------------------------------------------
// Biome colours
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

// ---------------------------------------------------------------------------
// Viewport state
// ---------------------------------------------------------------------------

interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

function worldToCanvas(
  nx: number, ny: number,
  panX: number, panY: number,
  zoom: number, w: number, h: number,
): [number, number] {
  return [nx * w * zoom + panX, ny * h * zoom + panY];
}

function canvasToWorld(
  cx: number, cy: number,
  panX: number, panY: number,
  zoom: number, w: number, h: number,
): [number, number] {
  return [
    Math.max(0, Math.min(1, (cx - panX) / zoom / w)),
    Math.max(0, Math.min(1, (cy - panY) / zoom / h)),
  ];
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

function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

// ---------------------------------------------------------------------------
// SVG path parser for Canvas 2D
// ---------------------------------------------------------------------------

function drawSvgPath(ctx: CanvasRenderingContext2D, d: string) {
  const cmds = d.match(/[MLHVZQCSA][^MLHVZQCSA]*/gi) ?? [];
  let x = 0;
  let y = 0;

  for (const cmd of cmds) {
    const op = cmd[0]!.toUpperCase();
    const args = cmd.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
    switch (op) {
      case "M": x = args[0] ?? 0; y = args[1] ?? 0; ctx.moveTo(x, y); break;
      case "L": x = args[0] ?? x; y = args[1] ?? y; ctx.lineTo(x, y); break;
      case "H": x = args[0] ?? x; ctx.lineTo(x, y); break;
      case "V": y = args[0] ?? y; ctx.lineTo(x, y); break;
      case "Z": ctx.closePath(); break;
      case "Q": ctx.quadraticCurveTo(args[0] ?? x, args[1] ?? y, args[2] ?? x, args[3] ?? y); x = args[2] ?? x; y = args[3] ?? y; break;
      case "C": ctx.bezierCurveTo(args[0] ?? x, args[1] ?? y, args[2] ?? x, args[3] ?? y, args[4] ?? x, args[5] ?? y); x = args[4] ?? x; y = args[5] ?? y; break;
    }
  }
}

// ---------------------------------------------------------------------------
// Decorations
// ---------------------------------------------------------------------------

function CompassRose() {
  return (
    <svg viewBox="0 0 80 80" width={72} height={72} style={{ pointerEvents: "none" }} aria-label="Kompassrose">
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

function ScaleBar({ preset }: { preset: AtlasStylePreset }) {
  const unit = preset.decorations.scaleUnit;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, pointerEvents: "none" }}>
      <div style={{
        width: 80,
        height: 8,
        background: `repeating-linear-gradient(to right, ${preset.colors.ink} 0 10px, ${preset.colors.parchment} 10px 20px, ${preset.colors.ink} 20px 30px, ${preset.colors.parchment} 30px 40px)`,
        border: `1px solid ${preset.colors.ink}`,
      }} />
      <span style={{ fontSize: 10, fontFamily: preset.typography.labelCity, color: preset.colors.ink }}>
        0 — 100 {unit}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Level labels
// ---------------------------------------------------------------------------

const LEVEL_LABELS: Record<string, string> = {
  globe: "Globus",
  continent: "Kontinent",
  landscape: "Landschaft",
  city: "Stadt",
};

// ---------------------------------------------------------------------------
// Hit-tested item type for click resolution
// ---------------------------------------------------------------------------

interface HitResult {
  key: string;
  childNodeId?: string | null;
  linkedPageId?: string | null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AtlasViewer({
  worldSlug,
  nodeTitle,
  nodeLevel,
  features,
  objects,
  preset = TOLKIEN_INK,
  parentChainItems = [],
  parentSilhouette,
  pageLinkMap = {},
  paletteItems = {},
}: AtlasViewerProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const panning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, vpX: 0, vpY: 0 });
  const [viewport, setViewport] = useState<ViewportState>({ panX: 0, panY: 0, zoom: 1 });
  const [hovered, setHovered] = useState<HitResult | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string; href?: string } | null>(null);

  // Preloaded images for AI/upload stamp rendering on canvas, keyed by
  // paletteItemId. Mirrors the Studio editor's stampImagesRef approach.
  const stampImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  // Bumped when a stamp image finishes loading to trigger a redraw.
  const [stampImagesVersion, setStampImagesVersion] = useState(0);

  // Preload AI/upload stamp images whenever the palette map changes.
  useEffect(() => {
    for (const [id, item] of Object.entries(paletteItems)) {
      if (item.source === "builtin") continue;
      if (!item.imageData) continue;
      if (stampImagesRef.current.has(id)) continue;
      const img = new window.Image();
      const data = item.imageData;
      img.src = data.startsWith("data:")
        ? data
        : `data:${item.mimeType ?? "image/png"};base64,${data}`;
      img.onload = () => setStampImagesVersion((v) => v + 1);
      stampImagesRef.current.set(id, img);
    }
  }, [paletteItems]);

  // ---------------------------------------------------------------------------
  // Canvas render
  // ---------------------------------------------------------------------------

  const render = useCallback(() => {
    // Referenced so the callback re-runs when a stamp image finishes loading.
    const _stampImagesVersion = stampImagesVersion;
    void _stampImagesVersion;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width / window.devicePixelRatio;
    const H = canvas.height / window.devicePixelRatio;
    const { panX, panY, zoom } = viewport;

    function w2c(nx: number, ny: number): [number, number] {
      return worldToCanvas(nx, ny, panX, panY, zoom, W, H);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.fillStyle = preset.colors.parchment;
    ctx.fillRect(0, 0, W, H);

    const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3 * zoom, W / 2, H / 2, W * 0.75);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(80,50,20,0.18)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Parent silhouette underlay
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

    // Canvas border
    ctx.save();
    ctx.strokeStyle = preset.colors.ink;
    ctx.lineWidth = 2 * zoom;
    const [bx0, by0] = w2c(0, 0);
    const [bx1, by1] = w2c(1, 1);
    ctx.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
    ctx.restore();

    const sortedFeatures = [...features].sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));
    const hoveredKey = hovered?.key ?? null;

    for (const feat of sortedFeatures) {
      const isHovered = feat._key === hoveredKey;
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
          const bs = feat.style as unknown as { biomeKind: BiomeKind; density: number } | undefined;
          const bk = (bs?.biomeKind ?? BiomeKind.forest) as BiomeKind;
          ctx.fillStyle = BIOME_FILL[bk];
          ctx.fill();
          ctx.strokeStyle = isHovered ? "#2563eb" : BIOME_STROKE[bk];
          ctx.lineWidth = isHovered ? 2.5 * zoom : 1.5 * zoom;
          ctx.stroke();

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

          if (rings[0] && rings[0].length >= 3) {
            const density = bs?.density ?? 1.0;
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
          ctx.fillStyle = feat.labelColor === "red" ? "rgba(139,26,16,0.18)" : "rgba(26,16,8,0.12)";
          ctx.fill();
          ctx.strokeStyle = isHovered ? "#2563eb" : preset.colors.ink;
          ctx.lineWidth = isHovered ? 2.5 * zoom : 1.5 * zoom;
          ctx.stroke();

          // Drill-down indicator badge
          if (feat.childNodeId && rings[0] && rings[0].length) {
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
            ctx.fillStyle = isHovered ? "#1d4ed8" : "#3b82f6";
            ctx.globalAlpha = 0.9;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#fff";
            ctx.font = `bold ${Math.round(11 * zoom)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("↓", bx, by);
            ctx.restore();
          }

          // Wiki link indicator
          if (feat.linkedPageId && pageLinkMap[feat.linkedPageId] && rings[0] && rings[0].length) {
            let cx2 = 0;
            let cy2 = 0;
            for (const [rx, ry] of rings[0]) { cx2 += rx; cy2 += ry; }
            cx2 /= rings[0].length;
            cy2 /= rings[0].length;
            // Offset slightly to avoid overlap with drill-down badge
            const offsetX = feat.childNodeId ? 18 * zoom : 0;
            const [bx, by] = w2c(cx2, cy2);
            const r = 7 * zoom;
            ctx.save();
            ctx.beginPath();
            ctx.arc(bx + offsetX, by, r, 0, Math.PI * 2);
            ctx.fillStyle = isHovered ? "#065f46" : "#059669";
            ctx.globalAlpha = 0.9;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#fff";
            ctx.font = `bold ${Math.round(10 * zoom)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("W", bx + offsetX, by);
            ctx.restore();
          }
        }
      } else if (feat.geometry.type === "Path") {
        const coords = (feat.geometry.coordinates as [number, number][]) ?? [];
        if (coords.length >= 2) {
          if (feat.kind === "road") {
            ctx.beginPath();
            const [sx, sy] = w2c(coords[0]![0], coords[0]![1]);
            ctx.moveTo(sx, sy);
            for (let i = 1; i < coords.length; i++) {
              const [cx2, cy2] = w2c(coords[i]![0], coords[i]![1]);
              ctx.lineTo(cx2, cy2);
            }
            ctx.strokeStyle = isHovered ? "#2563eb" : preset.colors.road;
            ctx.lineWidth = isHovered ? 2.5 * zoom : 2.0 * zoom;
            ctx.setLineDash([8 * zoom, 4 * zoom]);
            ctx.stroke();
            ctx.setLineDash([]);
          } else {
            const maxW = isHovered ? 2.8 * zoom : 2.2 * zoom;
            const minW = isHovered ? 1.2 * zoom : 0.8 * zoom;
            ctx.strokeStyle = isHovered ? "#2563eb" : preset.colors.inkAccent;
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
        if (!coord) { ctx.restore(); continue; }
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
          } else {
            ctx.font = `${Math.round(14 * zoom)}px ${preset.typography.labelCity}`;
            ctx.fillStyle = inkColor;
            ctx.textAlign = "center";
            ctx.fillText(labelText, px, py);
            if (isHovered) {
              ctx.strokeStyle = "#2563eb";
              ctx.lineWidth = 1.5;
              const tw = ctx.measureText(labelText).width;
              ctx.strokeRect(px - tw / 2 - 2, py - 14 * zoom, tw + 4, 16 * zoom);
            }
          }
        } else {
          ctx.beginPath();
          ctx.arc(px, py, 5 * zoom, 0, Math.PI * 2);
          ctx.fillStyle = isHovered ? "#2563eb" : preset.colors.inkAccent;
          ctx.fill();
        }
      }

      ctx.restore();
    }

    // Draw stamp objects
    for (const obj of objects) {
      const paletteItem = paletteItems[obj.paletteItemId];
      if (!paletteItem) continue;

      const isObjHovered = obj._key === hoveredKey;
      const [ox, oy] = w2c(obj.x, obj.y);
      const size = 24 * zoom * obj.scale;

      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate((obj.rotation * Math.PI) / 180);
      if (isObjHovered) {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2;
        ctx.strokeRect(-size / 2 - 3, -size / 2 - 3, size + 6, size + 6);
      }

      if (paletteItem.source === "builtin") {
        const glyph = BUILTIN_GLYPHS.find((g) => g.key === paletteItem.builtinGlyphKey);
        if (glyph) {
          const scale = size / 24;
          ctx.scale(scale, scale);
          ctx.translate(-12, -12);
          ctx.strokeStyle = glyph.color ?? preset.colors.ink;
          ctx.lineWidth = 1.5 / scale;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.beginPath();
          drawSvgPath(ctx, glyph.pathData);
          ctx.stroke();
        }
      } else if (paletteItem.imageData) {
        const preloaded = stampImagesRef.current.get(obj.paletteItemId);
        if (preloaded && preloaded.complete && preloaded.naturalWidth > 0) {
          ctx.drawImage(preloaded, -size / 2, -size / 2, size, size);
        } else {
          // Placeholder box until the image finishes loading.
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

    ctx.restore();
  }, [features, objects, viewport, preset, parentSilhouette, hovered, pageLinkMap, paletteItems, stampImagesVersion]);

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
      render();
    });
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [render]);

  // ---------------------------------------------------------------------------
  // Hit test
  // ---------------------------------------------------------------------------

  function hitTest(wx: number, wy: number, canvasW: number, canvasH: number): HitResult | null {
    const { zoom } = viewport;
    const THRESH = 10 / (zoom * Math.max(canvasW, canvasH));

    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i]!;
      const dx = o.x - wx;
      const dy = o.y - wy;
      if (Math.sqrt(dx * dx + dy * dy) < THRESH * 2) {
        return { key: o._key, linkedPageId: o.linkedPageId };
      }
    }
    for (let i = features.length - 1; i >= 0; i--) {
      const f = features[i]!;
      const geo = f.geometry;
      if (geo.type === "Point" || geo.type === "LabelAnchor") {
        const coord = geo.coordinates as [number, number];
        if (!coord) continue;
        const dx = coord[0] - wx;
        const dy = coord[1] - wy;
        if (Math.sqrt(dx * dx + dy * dy) < THRESH * 2) {
          return { key: f._key, linkedPageId: f.linkedPageId };
        }
      }
    }
    for (let i = features.length - 1; i >= 0; i--) {
      const f = features[i]!;
      const geo = f.geometry;
      if (geo.type === "Polygon") {
        const rings = geo.rings ?? [];
        for (const ring of rings) {
          if (pointInPolygon([wx, wy], ring)) {
            return { key: f._key, childNodeId: f.childNodeId, linkedPageId: f.linkedPageId };
          }
        }
      } else if (geo.type === "Path") {
        const coords = (geo.coordinates as [number, number][]) ?? [];
        for (let k = 0; k < coords.length - 1; k++) {
          const dist = distToSegment([wx, wy], coords[k]!, coords[k + 1]!);
          if (dist < THRESH) {
            return { key: f._key, linkedPageId: f.linkedPageId };
          }
        }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Pointer events (pan + zoom only, click for navigation)
  // ---------------------------------------------------------------------------

  function getCanvasPos(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function getWorldPos(cx: number, cy: number): [number, number] {
    const canvas = canvasRef.current!;
    const { panX, panY, zoom } = viewport;
    return canvasToWorld(cx, cy, panX, panY, zoom, canvas.clientWidth, canvas.clientHeight);
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const [cx, cy] = getCanvasPos(e);
    canvasRef.current!.setPointerCapture(e.pointerId);
    panning.current = true;
    panStart.current = { x: cx, y: cy, vpX: viewport.panX, vpY: viewport.panY };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const [cx, cy] = getCanvasPos(e);
    const [wx, wy] = getWorldPos(cx, cy);
    const hit = hitTest(wx, wy, canvas.clientWidth, canvas.clientHeight);
    const isClickable = hit && (hit.childNodeId || (hit.linkedPageId && pageLinkMap[hit.linkedPageId]));
    canvas.style.cursor = isClickable ? "pointer" : panning.current ? "grabbing" : "grab";

    if (hit) {
      setHovered(hit);
    } else {
      setHovered(null);
    }

    if (panning.current) {
      const dx = cx - panStart.current.x;
      const dy = cy - panStart.current.y;
      setViewport((v) => ({ ...v, panX: panStart.current.vpX + dx, panY: panStart.current.vpY + dy }));
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    canvasRef.current!.releasePointerCapture(e.pointerId);
    panning.current = false;
  }

  function onPointerLeave(_e: React.PointerEvent<HTMLCanvasElement>) {
    panning.current = false;
    setHovered(null);
    setTooltip(null);
  }

  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const [wx, wy] = getWorldPos(cx, cy);
    const hit = hitTest(wx, wy, canvas.clientWidth, canvas.clientHeight);
    if (!hit) { setTooltip(null); return; }

    // Drill-down: navigate to child node
    if (hit.childNodeId) {
      router.push(`/auth/worlds/${worldSlug}/atlas/${hit.childNodeId}`);
      return;
    }

    // Wiki link: show tooltip or navigate directly
    if (hit.linkedPageId && pageLinkMap[hit.linkedPageId]) {
      const slug = pageLinkMap[hit.linkedPageId]!;
      router.push(`/auth/worlds/${worldSlug}/${slug}`);
      return;
    }

    setTooltip(null);
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    setViewport((v) => {
      const ZOOM_MIN = 0.25;
      const ZOOM_MAX = 8;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom * factor));
      const panX = cx - (cx - v.panX) * (newZoom / v.zoom);
      const panY = cy - (cy - v.panY) * (newZoom / v.zoom);
      return { zoom: newZoom, panX, panY };
    });
  }

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
                href={`/auth/worlds/${worldSlug}/atlas/${item.id}`}
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

      {/* Info bar */}
      <div style={{
        padding: "0.4rem 0.75rem",
        background: "var(--uwe-surface)",
        border: "1px solid var(--uwe-border)",
        borderRadius: "var(--uwe-radius)",
        fontSize: 12,
        color: "var(--uwe-muted)",
        display: "flex",
        gap: "1rem",
        flexWrap: "wrap",
      }}>
        <span>Scrollen: Zoom · Ziehen: Verschieben</span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: "#3b82f6", verticalAlign: "middle" }} />
          Unterebene klickbar
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: "#059669", verticalAlign: "middle" }} />
          Wiki-Link klickbar
        </span>
      </div>

      {/* Canvas */}
      <div style={{ position: "relative", minHeight: 480, border: `2px solid ${preset.colors.ink}`, borderRadius: 4, overflow: "hidden", background: preset.colors.parchment }}>
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%", touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onClick={onClick}
          onWheel={onWheel}
          aria-label={`Atlas-Karte: ${nodeTitle}`}
        />

        {/* Decorations overlay */}
        <div style={{ position: "absolute", bottom: 12, right: 12, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
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

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: "absolute",
              left: tooltip.x + 12,
              top: tooltip.y - 8,
              background: "var(--uwe-bg)",
              border: "1px solid var(--uwe-border)",
              borderRadius: "var(--uwe-radius)",
              padding: "0.3rem 0.6rem",
              fontSize: 12,
              pointerEvents: "none",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              whiteSpace: "nowrap",
            }}
          >
            {tooltip.href ? (
              <a href={tooltip.href} style={{ color: "var(--uwe-accent)" }}>{tooltip.text}</a>
            ) : (
              tooltip.text
            )}
          </div>
        )}
      </div>
    </div>
  );
}
