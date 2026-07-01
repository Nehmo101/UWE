/**
 * Deterministic pseudo-random number generator for the Atlas engine.
 *
 * `mulberry32` is the canonical seeded PRNG the Atlas runtime uses for every
 * reproducible operation (procedural drafts, glyph scatter, stamp variation).
 * It is intentionally identical to the private `makePrng` bodies in
 * `terrain.ts` / `procedural.ts` / `stamp-variation.ts` so exposing it here
 * changes no existing determinism; those copies can be folded into this module
 * in a follow-up without altering any stream.
 *
 * Framework-agnostic: no DOM, React, or Prisma imports.
 */

/**
 * Returns a seeded PRNG producing values in [0, 1). Identical seeds yield
 * identical streams, which is what makes every Atlas seed-driven operation
 * reproducible and testable.
 *
 * @param seed - Integer seed. Coerced to a 32-bit value; same seed → same stream.
 */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return function rand(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

/**
 * Fold an arbitrary string into an unsigned 32-bit integer seed (`h*31 + c`),
 * so string identifiers (e.g. a world slug or object id) can drive
 * `mulberry32` deterministically.
 *
 * @param value - Any string; non-strings are coerced via `String()`.
 * @returns An unsigned 32-bit integer suitable as a `mulberry32` seed.
 */
export function hashStringToSeed(value: string): number {
  let h = 0;
  for (const ch of String(value)) {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return h;
}
