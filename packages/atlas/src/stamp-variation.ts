/**
 * Atlas stamp variation helpers — deterministic scale/rotation jitter.
 *
 * All functions are pure and framework-agnostic.  No DOM, no Canvas APIs.
 * Used when placing stamp (glyph object) instances so that repeated placements
 * — e.g. a tree or house — randomise their scale and rotation, in the spirit of
 * Canvas of Kings' "randomize scale and rotation".  Output is deterministic
 * given a seed, so re-renders are stable and tests are reproducible.
 */

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32)
// ---------------------------------------------------------------------------

/** Returns a seeded PRNG producing values in [0, 1). */
function makePrng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StampVariationOptions {
  /** min scale multiplier (default 0.7) */
  scaleMin?: number;
  /** max scale multiplier (default 1.3) */
  scaleMax?: number;
  /** min rotation degrees (default -15) */
  rotateMin?: number;
  /** max rotation degrees (default 15) */
  rotateMax?: number;
}

export interface StampVariation {
  scale: number;
  rotation: number;
}

// ---------------------------------------------------------------------------
// Defaults & helpers
// ---------------------------------------------------------------------------

const DEFAULT_SCALE_MIN = 0.7;
const DEFAULT_SCALE_MAX = 1.3;
const DEFAULT_ROTATE_MIN = -15;
const DEFAULT_ROTATE_MAX = 15;

/** Smallest positive scale allowed (scale must always be > 0). */
const MIN_POSITIVE_SCALE = 1e-6;

/** Clamp `value` into the inclusive range [lo, hi]. */
function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

/** Order a pair so the first element is the minimum. */
function ordered(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

// ---------------------------------------------------------------------------
// randomStampVariation
// ---------------------------------------------------------------------------

/**
 * Deterministic scale + rotation for a given integer seed.
 *
 * The result is fully determined by `seed` and `options`: identical inputs
 * always yield identical output.  Ranges are normalised so that a swapped
 * `min`/`max` pair is handled gracefully, results are clamped within range,
 * and `scale` is always strictly greater than zero.
 *
 * @param seed    - Integer seed driving the deterministic PRNG.
 * @param options - Optional scale/rotation bounds (see {@link StampVariationOptions}).
 * @returns        A `StampVariation` with `scale` and `rotation` (degrees).
 */
export function randomStampVariation(
  seed: number,
  options?: StampVariationOptions,
): StampVariation {
  const [scaleMin, scaleMax] = ordered(
    options?.scaleMin ?? DEFAULT_SCALE_MIN,
    options?.scaleMax ?? DEFAULT_SCALE_MAX,
  );
  const [rotateMin, rotateMax] = ordered(
    options?.rotateMin ?? DEFAULT_ROTATE_MIN,
    options?.rotateMax ?? DEFAULT_ROTATE_MAX,
  );

  const rng = makePrng(seed);
  const rawScale = scaleMin + rng() * (scaleMax - scaleMin);
  const rawRotation = rotateMin + rng() * (rotateMax - rotateMin);

  // Guard: scale must always be > 0, even if the caller passes a range with a
  // zero or negative lower bound.
  const scale = Math.max(
    MIN_POSITIVE_SCALE,
    clamp(rawScale, scaleMin, scaleMax),
  );
  const rotation = clamp(rawRotation, rotateMin, rotateMax);

  return { scale, rotation };
}

// ---------------------------------------------------------------------------
// stampSeedFromKey
// ---------------------------------------------------------------------------

/**
 * Convenience: derive a stable integer seed from a string key (FNV-1a, 32-bit).
 *
 * Useful when a stamp's variation should be keyed off a stable identifier
 * (e.g. an object id or grid cell) rather than a hand-picked numeric seed.
 *
 * @param key - Arbitrary string identifier.
 * @returns     An unsigned 32-bit integer seed (finite, deterministic).
 */
export function stampSeedFromKey(key: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0;
}
