/**
 * Warp tool — smoothly drag scene objects around a centre point with a
 * smoothstep falloff. Pure and deterministic; objects whose position does not
 * match the mode's format (e.g. orbit objects) are left untouched.
 */

export interface WarpObject {
  localId: string;
  position: Record<string, unknown>;
}

export interface WarpOptions {
  objects: readonly WarpObject[];
  mode: "globe" | "terrain";
  /** Globe: unit direction of the grab point. Terrain: map point. */
  center: [number, number, number];
  /** Globe: tangential displacement. Terrain: [dx, 0, dz]. */
  delta: [number, number, number];
  /** Influence radius — radians on the globe, map units on terrain. */
  radius: number;
}

/** 1 at the centre, 0 at the radius, smoothstep in between. */
function falloff(distance: number, radius: number): number {
  if (radius <= 0) return 0;
  const t = Math.min(1, Math.max(0, distance / radius));
  return 1 - t * t * (3 - 2 * t);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readDir(position: Record<string, unknown>): [number, number, number] | null {
  const dir = position.dir;
  if (!Array.isArray(dir) || dir.length !== 3) return null;
  const [x, y, z] = dir;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z)) return null;
  return [x, y, z];
}

/**
 * Returns localId → new position for every object inside the radius (others
 * are omitted). Terrain mode shifts x/z; globe mode nudges the unit direction
 * along `delta` and renormalises.
 */
export function warpObjects(options: WarpOptions): Map<string, Record<string, unknown>> {
  const { objects, mode, center, delta, radius } = options;
  const result = new Map<string, Record<string, unknown>>();

  if (mode === "terrain") {
    const [cx, , cz] = center;
    const [dx, , dz] = delta;
    for (const object of objects) {
      const { position } = object;
      if (!isFiniteNumber(position.x) || !isFiniteNumber(position.z)) continue;
      const distance = Math.hypot(position.x - cx, position.z - cz);
      const f = falloff(distance, radius);
      if (f <= 0) continue;
      result.set(object.localId, {
        ...position,
        x: position.x + dx * f,
        z: position.z + dz * f,
      });
    }
    return result;
  }

  const centerLength = Math.hypot(center[0], center[1], center[2]) || 1;
  const cn: [number, number, number] = [center[0] / centerLength, center[1] / centerLength, center[2] / centerLength];
  for (const object of objects) {
    const dir = readDir(object.position);
    if (!dir) continue;
    const dot = Math.min(1, Math.max(-1, dir[0] * cn[0] + dir[1] * cn[1] + dir[2] * cn[2]));
    const distance = Math.acos(dot);
    const f = falloff(distance, radius);
    if (f <= 0) continue;
    const nx = dir[0] + delta[0] * f;
    const ny = dir[1] + delta[1] * f;
    const nz = dir[2] + delta[2] * f;
    const length = Math.hypot(nx, ny, nz) || 1;
    result.set(object.localId, {
      ...object.position,
      dir: [nx / length, ny / length, nz / length],
    });
  }
  return result;
}
