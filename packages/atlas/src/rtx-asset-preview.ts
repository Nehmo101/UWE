/**
 * Deterministic canvas preview for validated RTX Gouache JSON recipes.
 *
 * Draws a `RtxGouacheJsonRecipe` (already validated by
 * `validateRtxAtlasAssetProposal`) purely data-driven onto a Canvas 2D
 * context — no eval, no code from strings, only fill/stroke with re-checked
 * hex colors. The renderer no-ops on empty/invalid input and skips layers it
 * cannot draw safely (unknown shapes, relative/unsupported path commands,
 * non-finite numbers) instead of throwing.
 *
 * Coordinate model: `base-center-normalized` — layer coordinates span -4..4
 * on both axes around the recipe origin. The caller anchors the origin at a
 * canvas pixel and chooses how many pixels one normalized unit maps to.
 */

import type {
  RtxGouacheJsonRecipe,
  RtxGouacheRecipeLayer,
  RtxGouacheRecipeLayerRole,
} from "./rtx-asset-proposal";

type Ctx = CanvasRenderingContext2D;

/** Normalized recipe coordinates span -EXTENT..EXTENT on both axes. */
export const RTX_RECIPE_NORMALIZED_EXTENT = 4;

export interface DrawRtxGouacheRecipePreviewOptions {
  /** Canvas-pixel x of the recipe origin (base-centre anchor). */
  x: number;
  /** Canvas-pixel y of the recipe origin (base-centre anchor). */
  y: number;
  /** Pixels per normalized coordinate unit. Default 16. */
  unitScale?: number;
  /** Fallback stroke width in px for layers without `lineWidth`. Default 1.4. */
  lineWidth?: number;
}

/**
 * Default opacity per layer role — the only role-driven behavior. A layer's
 * explicit `opacity` always wins.
 */
export const RTX_RECIPE_ROLE_DEFAULT_OPACITY: Record<RtxGouacheRecipeLayerRole, number> = {
  shadow: 0.2,
  base: 1,
  highlight: 0.85,
  detail: 1,
  outline: 1,
};

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const TAU = Math.PI * 2;

/** Numbers-per-command for the supported absolute SVG path subset. */
const PATH_ARG_COUNTS: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  Q: 4,
  C: 6,
  Z: 0,
};

/** A single recorded canvas call: `[method, ...args]`. */
type DrawOp = [name: "moveTo" | "lineTo" | "quadraticCurveTo" | "bezierCurveTo" | "ellipse", ...args: number[]] | ["closePath"];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function safeHexColor(value: unknown): string | undefined {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : undefined;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// ---------------------------------------------------------------------------
// Per-shape op builders — return null when the layer cannot be drawn safely.
// ---------------------------------------------------------------------------

type Project = (nx: number, ny: number) => [number, number];

function buildEllipseOps(layer: RtxGouacheRecipeLayer, project: Project, unit: number): DrawOp[] | null {
  const { x, y, rx, ry } = layer;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(rx) || !isFiniteNumber(ry)) return null;
  if (rx < 0 || ry < 0) return null;
  const [px, py] = project(x, y);
  const rotation = isFiniteNumber(layer.rotation) ? layer.rotation : 0;
  return [["ellipse", px, py, rx * unit, ry * unit, rotation, 0, TAU]];
}

function buildRectOps(layer: RtxGouacheRecipeLayer, project: Project, unit: number): DrawOp[] | null {
  const { x, y, width, height } = layer;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) return null;
  if (width < 0 || height < 0) return null;
  const rotation = isFiniteNumber(layer.rotation) ? layer.rotation : 0;
  const [cx, cy] = project(x, y);
  const hw = (width / 2) * unit;
  const hh = (height / 2) * unit;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const corners: Array<[number, number]> = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([dx, dy]) => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]);
  const ops: DrawOp[] = [["moveTo", corners[0]![0], corners[0]![1]]];
  for (const [px, py] of corners.slice(1)) ops.push(["lineTo", px, py]);
  ops.push(["closePath"]);
  return ops;
}

function buildPolygonOps(layer: RtxGouacheRecipeLayer, project: Project): DrawOp[] | null {
  const points = layer.points;
  if (!Array.isArray(points) || points.length < 3) return null;
  const projected: Array<[number, number]> = [];
  for (const point of points) {
    if (!Array.isArray(point) || point.length !== 2 || !isFiniteNumber(point[0]) || !isFiniteNumber(point[1])) {
      return null;
    }
    projected.push(project(point[0], point[1]));
  }
  const ops: DrawOp[] = [["moveTo", projected[0]![0], projected[0]![1]]];
  for (const [px, py] of projected.slice(1)) ops.push(["lineTo", px, py]);
  ops.push(["closePath"]);
  return ops;
}

/**
 * Parse the constrained SVG path subset into draw ops. Mirrors the minimal
 * `drawSvgPath` parser (`canvas-render.ts`) but is strict: only absolute
 * `M L H V Q C Z` are accepted; any relative/unsupported command or malformed
 * number invalidates the whole layer (returns null) so a layer never draws
 * partially. Path coordinates are normalized units, like every other shape.
 */
function buildPathOps(layer: RtxGouacheRecipeLayer, project: Project): DrawOp[] | null {
  const d = layer.path;
  if (typeof d !== "string" || !d.trim()) return null;
  const groups = d.match(/[A-Za-z][^A-Za-z]*/g);
  if (!groups || !groups.join("").trim()) return null;
  // Reject anything before the first command letter.
  if (d.slice(0, d.indexOf(groups[0]!)).trim()) return null;

  const ops: DrawOp[] = [];
  let nx = 0;
  let ny = 0;
  for (const group of groups) {
    const op = group[0]!;
    const argCount = PATH_ARG_COUNTS[op];
    if (argCount === undefined) return null; // relative or unsupported command
    const args = group.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (args.some((value) => !Number.isFinite(value))) return null;
    if (argCount === 0) {
      if (args.length > 0) return null;
      ops.push(["closePath"]);
      continue;
    }
    // SVG allows repeated coordinate sets per command letter.
    if (args.length === 0 || args.length % argCount !== 0) return null;
    for (let i = 0; i < args.length; i += argCount) {
      switch (op) {
        case "M": {
          nx = args[i]!;
          ny = args[i + 1]!;
          ops.push([i === 0 ? "moveTo" : "lineTo", ...project(nx, ny)]);
          break;
        }
        case "L": {
          nx = args[i]!;
          ny = args[i + 1]!;
          ops.push(["lineTo", ...project(nx, ny)]);
          break;
        }
        case "H": {
          nx = args[i]!;
          ops.push(["lineTo", ...project(nx, ny)]);
          break;
        }
        case "V": {
          ny = args[i]!;
          ops.push(["lineTo", ...project(nx, ny)]);
          break;
        }
        case "Q": {
          const cp = project(args[i]!, args[i + 1]!);
          nx = args[i + 2]!;
          ny = args[i + 3]!;
          ops.push(["quadraticCurveTo", cp[0], cp[1], ...project(nx, ny)]);
          break;
        }
        case "C": {
          const c1 = project(args[i]!, args[i + 1]!);
          const c2 = project(args[i + 2]!, args[i + 3]!);
          nx = args[i + 4]!;
          ny = args[i + 5]!;
          ops.push(["bezierCurveTo", c1[0], c1[1], c2[0], c2[1], ...project(nx, ny)]);
          break;
        }
      }
    }
  }
  return ops.length > 0 ? ops : null;
}

function buildLayerOps(layer: RtxGouacheRecipeLayer, project: Project, unit: number): DrawOp[] | null {
  switch (layer.shape) {
    case "ellipse":
      return buildEllipseOps(layer, project, unit);
    case "rect":
      return buildRectOps(layer, project, unit);
    case "polygon":
      return buildPolygonOps(layer, project);
    case "path":
      return buildPathOps(layer, project);
    default:
      return null;
  }
}

function isDrawableRecipe(recipe: unknown): recipe is RtxGouacheJsonRecipe {
  return (
    typeof recipe === "object" &&
    recipe !== null &&
    !Array.isArray(recipe) &&
    (recipe as RtxGouacheJsonRecipe).schemaVersion === 1 &&
    Array.isArray((recipe as RtxGouacheJsonRecipe).layers) &&
    (recipe as RtxGouacheJsonRecipe).layers.length > 0
  );
}

/**
 * Draw a validated RTX Gouache JSON recipe onto a Canvas 2D context.
 *
 * Layers render in array order; `role` only picks a default opacity. Layers
 * without a valid hex fill/stroke, with unknown shapes, or with unsupported
 * path data are skipped gracefully. No-op for empty/invalid recipes.
 */
export function drawRtxGouacheRecipePreview(
  ctx: Ctx,
  recipe: RtxGouacheJsonRecipe | null | undefined,
  opts: DrawRtxGouacheRecipePreviewOptions,
): void {
  if (!ctx || !isDrawableRecipe(recipe)) return;
  if (!isFiniteNumber(opts.x) || !isFiniteNumber(opts.y)) return;
  const unit = opts.unitScale ?? 16;
  if (!isFiniteNumber(unit) || unit <= 0) return;
  const fallbackLineWidth = isFiniteNumber(opts.lineWidth) && opts.lineWidth > 0 ? opts.lineWidth : 1.4;
  const project: Project = (nx, ny) => [opts.x + nx * unit, opts.y + ny * unit];

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const layer of recipe.layers) {
    if (typeof layer !== "object" || layer === null) continue;
    const fill = safeHexColor(layer.fill);
    const stroke = safeHexColor(layer.stroke);
    if (!fill && !stroke) continue;
    const ops = buildLayerOps(layer, project, unit);
    if (!ops) continue;

    const roleDefault = RTX_RECIPE_ROLE_DEFAULT_OPACITY[layer.role] ?? 1;
    ctx.globalAlpha = clamp01(isFiniteNumber(layer.opacity) ? layer.opacity : roleDefault);
    ctx.beginPath();
    for (const [name, ...args] of ops) {
      (ctx[name] as (...values: number[]) => void)(...(args as number[]));
    }
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    const strokeWidth = isFiniteNumber(layer.lineWidth) ? layer.lineWidth : fallbackLineWidth;
    if (stroke && strokeWidth > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
  }
  ctx.restore();
}
