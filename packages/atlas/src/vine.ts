/**
 * Atlas vine/root engine — layout for a giant beanstalk / world-root that
 * "grows into the sky" (Jack-and-the-Beanstalk style), rendered as static
 * pseudo-3D on the top-down parchment map: a tapered coiling trunk (thick at
 * the base, thin at the tip), side tendrils, a cast shadow, and a "height aura"
 * (faint rings + cloud placements) at the tip that suggests great height
 * without any real 3D/perspective engine.
 *
 * All functions are pure and framework-agnostic. No DOM, no Canvas APIs, no
 * external dependencies. Coordinates are in normalised canvas space [0, 1]
 * (see ./geometry). Layout is deterministic for a given seed (mulberry32), so
 * output is stable across re-renders and tests — mirroring the segment-walking
 * technique in `path-attachments.ts` / `terrain.ts`.
 *
 * Base = first input point (on the ground); tip = last input point (in the sky).
 */

import type { Coordinate } from "./geometry";
import { mulberry32 } from "./prng";
import { smoothPath, sampleTaperedWidths } from "./path-smoothing";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface VineOptions {
  /** Relative trunk width at the base (first point). Default 0.9. */
  taperStart?: number;
  /** Relative trunk width at the tip (last point). Default 0.15. */
  taperEnd?: number;
  /** Coil/helix strength around the spine, 0..1. Default 0.6. */
  coil?: number;
  /** Number of side tendrils branching off the trunk. Default 3. */
  tendrils?: number;
  /** Height feel, 0..1 — drives cast-shadow length and tip-aura size. Default 0.7. */
  height?: number;
  /** PRNG seed for deterministic tendrils. Default 1. */
  seed?: number;
  /** Catmull-Rom subdivisions per input segment. Default 16. */
  smoothSegments?: number;
}

export interface VineAura {
  /** Tip point the aura is centred on. */
  center: Coordinate;
  /** Aura radius in normalised space (∝ height). */
  radius: number;
  /** Cloud-glyph placements around the tip. */
  clouds: Coordinate[];
}

export interface VineLayout {
  /** Densified centre line (base → tip). */
  spine: Coordinate[];
  /** Relative trunk width per spine point (same length as `spine`). */
  widths: number[];
  /** Helix polyline winding around the spine (same length as `spine`). */
  coil: Coordinate[];
  /** Side tendrils, each a short curl polyline. */
  tendrils: Coordinate[][];
  /** Cast-shadow spine, offset south-east (same length as `spine`). */
  shadow: Coordinate[];
  /** Height aura at the tip. */
  aura: VineAura;
}

// ---------------------------------------------------------------------------
// Tunables (normalised space)
// ---------------------------------------------------------------------------

/** Coil amplitude scale — perpendicular wiggle as a fraction of local width. */
const COIL_AMP = 0.022;
/** Number of full helix turns along the whole trunk. */
const COIL_TURNS = 6;
/** Cast-shadow offset (SE) at height=1. */
const SHADOW_OFFSET = 0.05;
/** Tip aura radius at height=1. */
const AURA_RADIUS = 0.09;
/** Number of cloud placements around the tip. */
const AURA_CLOUDS = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a value to the normalised canvas range [0, 1]. */
function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/** Clamp a coordinate to [0, 1]². */
function clampCoord(c: Coordinate): Coordinate {
  return [clamp01(c[0]), clamp01(c[1])];
}

/** Unit perpendicular (rotated +90°) of the local tangent at spine index `i`. */
function perpendicularAt(spine: Coordinate[], i: number): Coordinate {
  const prev = spine[Math.max(0, i - 1)]!;
  const next = spine[Math.min(spine.length - 1, i + 1)]!;
  const tx = next[0] - prev[0];
  const ty = next[1] - prev[1];
  const len = Math.hypot(tx, ty) || 1;
  // Rotate tangent by +90°: (tx, ty) → (-ty, tx).
  return [-ty / len, tx / len];
}

// ---------------------------------------------------------------------------
// buildVineLayout
// ---------------------------------------------------------------------------

/**
 * Build the deterministic layout for a vine/root feature from a hand-clicked
 * polyline. Returns an empty layout for fewer than two points.
 *
 * @param points  - Source polyline (base first, tip last) in normalised space.
 * @param options - Taper, coil, tendrils, height, and seed.
 * @returns         A {@link VineLayout} whose emitted coordinates are clamped to [0, 1].
 */
export function buildVineLayout(
  points: Coordinate[],
  options: VineOptions = {},
): VineLayout {
  if (!points || points.length < 2) {
    return {
      spine: [],
      widths: [],
      coil: [],
      tendrils: [],
      shadow: [],
      aura: { center: [0, 0], radius: 0, clouds: [] },
    };
  }

  const taperStart = options.taperStart ?? 0.9;
  const taperEnd = options.taperEnd ?? 0.15;
  const coil = clamp01(options.coil ?? 0.6);
  const tendrilCount = Math.max(0, Math.round(options.tendrils ?? 3));
  const height = clamp01(options.height ?? 0.7);
  const seed = options.seed ?? 1;
  const segments = options.smoothSegments ?? 16;

  // Densified centre line (Catmull-Rom; <3 points returns a copy unchanged).
  const spine = smoothPath(points, { segments, tension: 0.5 }).map(clampCoord);
  const n = spine.length;

  // Relative trunk widths, base → tip.
  const widths = sampleTaperedWidths(spine, taperStart, taperEnd);

  // Helix: perpendicular sine offset, amplitude modulated by local width.
  const coilLine: Coordinate[] = new Array<Coordinate>(n);
  for (let i = 0; i < n; i++) {
    const phase = (i / Math.max(1, n - 1)) * COIL_TURNS * Math.PI * 2;
    const amp = widths[i]! * coil * COIL_AMP;
    const [px, py] = perpendicularAt(spine, i);
    const s = Math.sin(phase) * amp;
    coilLine[i] = clampCoord([spine[i]![0] + px * s, spine[i]![1] + py * s]);
  }

  // Cast shadow: whole spine shifted south-east, length ∝ height.
  const off = SHADOW_OFFSET * height;
  const shadow = spine.map(
    (c): Coordinate => clampCoord([c[0] + off, c[1] + off]),
  );

  // Side tendrils: short outward-curling polylines at evenly spaced arc
  // fractions, deterministic side/length via the seeded PRNG.
  const rng = mulberry32(seed);
  const tendrils: Coordinate[][] = [];
  for (let k = 0; k < tendrilCount; k++) {
    const t = (k + 1) / (tendrilCount + 1);
    const idx = Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))));
    const [px, py] = perpendicularAt(spine, idx);
    const side = rng() < 0.5 ? 1 : -1;
    let step = widths[idx]! * (0.02 + rng() * 0.02) + 0.008;
    let a = Math.atan2(py * side, px * side);
    let cx = spine[idx]![0];
    let cy = spine[idx]![1];
    const curl: Coordinate[] = [clampCoord([cx, cy])];
    for (let j = 0; j < 6; j++) {
      a += side * 0.5;
      cx += Math.cos(a) * step;
      cy += Math.sin(a) * step;
      step *= 0.8;
      curl.push(clampCoord([cx, cy]));
    }
    tendrils.push(curl);
  }

  // Tip aura: rings + cloud placements around the last spine point.
  const tip = spine[n - 1]!;
  const radius = AURA_RADIUS * (0.4 + height * 0.6);
  const clouds: Coordinate[] = [];
  for (let i = 0; i < AURA_CLOUDS; i++) {
    const a = (i / AURA_CLOUDS) * Math.PI * 2;
    const rr = radius * (0.7 + 0.3 * ((i % 2) === 0 ? 1 : 0.6));
    clouds.push(clampCoord([tip[0] + Math.cos(a) * rr, tip[1] + Math.sin(a) * rr]));
  }

  return {
    spine,
    widths,
    coil: coilLine,
    tendrils,
    shadow,
    aura: { center: clampCoord(tip), radius, clouds },
  };
}
