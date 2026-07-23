/**
 * Geometry helpers for the Atlas 3D hierarchy.
 *
 * The drill-down contract: a region drawn on a PARENT level becomes the
 * child level's locked boundary silhouette. On the globe the region is a
 * patch of unit directions on the sphere; the child works on a flat map, so
 * the patch is projected into the tangent plane at its centroid.
 */

import type { Vec3 } from "./carve";

export type { Vec3 } from "./carve";
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

export interface SurfacePatchProjection {
  /** 3D centroid of the raw points (world units — NOT normalized). */
  centroid: Vec3;
  /** Unit normal of the fitted plane, oriented by the hint. */
  normal: Vec3;
  /** Polygon in the plane basis (world units), input order kept. */
  polygon: Vec2[];
  /** Max polygon extent from the centroid (world units). */
  radius: number;
}

/**
 * Project an arbitrary 3D surface patch (≥3 points) into its best-fit plane:
 * centroid + Newell normal over the closed loop, then plane-basis coordinates.
 * Unlike projectSpherePatch this keeps true depth, so regions on crater
 * floors, cut faces and tunnel walls project without collapsing onto the unit
 * sphere. Null for degenerate (colinear/coincident) input. `normalHint`
 * (e.g. the averaged face normals of the clicks) orients the plane normal so
 * the silhouette is not mirrored; default hint is the centroid direction.
 */
export function projectSurfacePatch(points: readonly Vec3[], normalHint?: Vec3): SurfacePatchProjection | null {
  if (points.length < 3) return null;
  const centroid: [number, number, number] = [0, 0, 0];
  for (const p of points) {
    centroid[0] += p[0] / points.length;
    centroid[1] += p[1] / points.length;
    centroid[2] += p[2] / points.length;
  }
  const newell: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const av: Vec3 = [a[0] - centroid[0], a[1] - centroid[1], a[2] - centroid[2]];
    const bv: Vec3 = [b[0] - centroid[0], b[1] - centroid[1], b[2] - centroid[2]];
    const cr = cross3(av, bv);
    newell[0] += cr[0];
    newell[1] += cr[1];
    newell[2] += cr[2];
  }
  const len = Math.hypot(newell[0], newell[1], newell[2]);
  if (len < 1e-9) return null;
  let normal: Vec3 = [newell[0] / len, newell[1] / len, newell[2] / len];
  const hintSource = normalHint ?? (Math.hypot(centroid[0], centroid[1], centroid[2]) > 1e-9 ? centroid : null);
  if (hintSource && dot3(normal, normalize3(hintSource)) < 0) {
    normal = [-normal[0], -normal[1], -normal[2]];
  }

  // Same east/south convention as projectSpherePatch so hull patches keep orientation.
  const worldUp: Vec3 = Math.abs(normal[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
  const east = normalize3(cross3(worldUp, normal));
  const south = normalize3(cross3(normal, east));

  const polygon: Vec2[] = [];
  let radius = 0;
  for (const p of points) {
    const rel: Vec3 = [p[0] - centroid[0], p[1] - centroid[1], p[2] - centroid[2]];
    const x = dot3(rel, east);
    const z = dot3(rel, south);
    polygon.push([x, z]);
    radius = Math.max(radius, Math.hypot(x, z));
  }
  return { centroid: [centroid[0], centroid[1], centroid[2]], normal, polygon, radius };
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
