/**
 * Geometry helpers for the Atlas 3D hierarchy.
 *
 * The drill-down contract: a region drawn on a PARENT level becomes the
 * child level's locked boundary silhouette. On the globe the region is a
 * patch of unit directions on the sphere; the child works on a flat map, so
 * the patch is projected into the tangent plane at its centroid.
 */

import type { Vec3 } from "./carve";

export type Vec2 = readonly [number, number];

function normalize3(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export interface SpherePatchProjection {
  /** Unit centroid direction of the patch on the sphere. */
  centroid: Vec3;
  /**
   * Silhouette polygon in the child's flat map plane, centered on the
   * centroid, x = east, z = south (matching the top-down camera).
   * Units: radians of arc — multiply by the parent radius for world size.
   */
  polygon: Vec2[];
  /** Max polygon extent from the center (radians of arc). */
  radius: number;
}

/**
 * Project a spherical region (≥3 unit directions) into the tangent plane at
 * its centroid via azimuthal projection. Deterministic; input order is kept.
 */
export function projectSpherePatch(dirs: readonly Vec3[]): SpherePatchProjection | null {
  if (dirs.length < 3) return null;
  const sum: [number, number, number] = [0, 0, 0];
  for (const dir of dirs) {
    const d = normalize3(dir);
    sum[0] += d[0];
    sum[1] += d[1];
    sum[2] += d[2];
  }
  if (Math.hypot(sum[0], sum[1], sum[2]) < 1e-9) return null;
  const centroid = normalize3(sum);

  // Tangent basis: east = up × centroid, south = centroid × east.
  const worldUp: Vec3 = Math.abs(centroid[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
  const east = normalize3(cross3(worldUp, centroid));
  const south = normalize3(cross3(centroid, east));

  const polygon: Vec2[] = [];
  let radius = 0;
  for (const dir of dirs) {
    const d = normalize3(dir);
    const cosAngle = Math.min(1, Math.max(-1, dot3(d, centroid)));
    const angle = Math.acos(cosAngle);
    // Direction of the point within the tangent plane.
    const planar: Vec3 = [
      d[0] - centroid[0] * cosAngle,
      d[1] - centroid[1] * cosAngle,
      d[2] - centroid[2] * cosAngle,
    ];
    const planarLen = Math.hypot(planar[0], planar[1], planar[2]);
    let x = 0;
    let z = 0;
    if (planarLen > 1e-9) {
      x = (dot3(planar, east) / planarLen) * angle;
      z = (dot3(planar, south) / planarLen) * angle;
    }
    polygon.push([x, z]);
    radius = Math.max(radius, Math.hypot(x, z));
  }
  return { centroid, polygon, radius };
}

/** Ray-casting point-in-polygon test (2D, works for concave polygons). */
export function pointInPolygon(point: Vec2, polygon: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    const intersects = zi > point[1] !== zj > point[1] && point[0] < ((xj - xi) * (point[1] - zi)) / (zj - zi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Signed distance (approximate, positive outside) from a point to a polygon boundary. */
export function distanceToPolygon(point: Vec2, polygon: readonly Vec2[]): number {
  let minDistance = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    const ex = xj - xi;
    const ez = zj - zi;
    const len2 = ex * ex + ez * ez;
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((point[0] - xi) * ex + (point[1] - zi) * ez) / len2)) : 0;
    const dx = point[0] - (xi + ex * t);
    const dz = point[1] - (zi + ez * t);
    minDistance = Math.min(minDistance, Math.hypot(dx, dz));
  }
  return pointInPolygon(point, polygon) ? -minDistance : minDistance;
}

/** Parse an unknown JSON value into a 2D polygon ([[x,z], …]); null if invalid. */
export function parsePolygon(value: unknown): Vec2[] | null {
  if (typeof value !== "object" || value === null) return null;
  const points = (value as { points?: unknown }).points ?? value;
  if (!Array.isArray(points) || points.length < 3) return null;
  const polygon: Vec2[] = [];
  for (const raw of points) {
    if (!Array.isArray(raw) || raw.length < 2) return null;
    const [x, z] = raw;
    if (typeof x !== "number" || typeof z !== "number" || !Number.isFinite(x) || !Number.isFinite(z)) return null;
    polygon.push([x, z]);
  }
  return polygon;
}
