/**
 * Auto line features — palisade walls with towers (and an optional gate gap)
 * plus tree-lined roads. Deterministic hash jitter, no randomness.
 */

export interface WallPoint {
  x: number;
  z: number;
}

export interface WallObject {
  localId: string;
  assetKind: "tower";
  tint: "paper";
  position: WallPoint;
  scale: number;
  rotation: number;
}

export interface WallFeature {
  localId: string;
  kind: "road";
  points: WallPoint[];
}

export interface WallSegmentOptions {
  from: WallPoint;
  to: WallPoint;
  seed: number;
  idPrefix: string;
  /** Distance between towers along the line. Default 0.35. */
  towerSpacing?: number;
  /** Gate gap (0.12 wide) in the middle. Default: true when length > 0.5. */
  gate?: boolean;
}

export interface WallSegmentResult {
  objects: WallObject[];
  features: WallFeature[];
}

function hash01(a: number, b: number, seed: number): number {
  let n = Math.imul(Math.round(a * 8191) + Math.round(b * 131071) + seed * 7919, 2654435761);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const GATE_GAP = 0.12;

/**
 * Wall from `from` to `to`: towers at both ends and every `towerSpacing`
 * between (slight hash jitter perpendicular to the line, ±0.015), plus the
 * palisade as road feature(s); with a gate, two features leave a centre gap.
 */
export function buildWallSegment(options: WallSegmentOptions): WallSegmentResult {
  const { from, to, seed, idPrefix } = options;
  const towerSpacing = options.towerSpacing ?? 0.35;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  const gate = options.gate ?? length > 0.5;

  const ux = length > 0 ? dx / length : 1;
  const uz = length > 0 ? dz / length : 0;
  // perpendicular (left of travel direction)
  const px = -uz;
  const pz = ux;

  const segments = Math.max(1, Math.round(length / towerSpacing));
  const objects: WallObject[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const side = (hash01(i, 1, seed) - 0.5) * 2 * 0.015;
    objects.push({
      localId: `${idPrefix}-tower-${i}`,
      assetKind: "tower",
      tint: "paper",
      position: {
        x: from.x + ux * length * t + px * side,
        z: from.z + uz * length * t + pz * side,
      },
      scale: 0.8 + hash01(i, 2, seed) * 0.4,
      rotation: hash01(i, 3, seed) * Math.PI * 2,
    });
  }

  const features: WallFeature[] = [];
  if (gate && length > GATE_GAP) {
    const half = length / 2;
    const gapStart = half - GATE_GAP / 2;
    const gapEnd = half + GATE_GAP / 2;
    features.push({
      localId: `${idPrefix}-wall-0`,
      kind: "road",
      points: [
        { x: from.x, z: from.z },
        { x: from.x + ux * gapStart, z: from.z + uz * gapStart },
      ],
    });
    features.push({
      localId: `${idPrefix}-wall-1`,
      kind: "road",
      points: [
        { x: from.x + ux * gapEnd, z: from.z + uz * gapEnd },
        { x: to.x, z: to.z },
      ],
    });
  } else {
    features.push({
      localId: `${idPrefix}-wall-0`,
      kind: "road",
      points: [
        { x: from.x, z: from.z },
        { x: to.x, z: to.z },
      ],
    });
  }
  return { objects, features };
}

export interface RoadTreeInstance {
  assetKind: "tree";
  tint: "teal";
  x: number;
  z: number;
  scale: number;
  rotation: number;
}

export interface LineRoadTreesOptions {
  points: readonly WallPoint[];
  seed: number;
  /** Arc-length distance between tree pairs along the path. Default 0.22. */
  spacing?: number;
  /** Perpendicular distance from the path to each tree. Default 0.07. */
  offset?: number;
}

/**
 * Trees on both sides along a path ("gesäumte Straße"): every `spacing` of
 * arc length one tree per side at perpendicular ±offset (small hash jitter).
 */
export function lineRoadWithTrees(options: LineRoadTreesOptions): RoadTreeInstance[] {
  const { points, seed } = options;
  const spacing = options.spacing ?? 0.22;
  const offset = options.offset ?? 0.07;
  if (points.length < 2) return [];

  const trees: RoadTreeInstance[] = [];
  let walked = 0;
  let next = spacing / 2;
  let planted = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const segLength = Math.hypot(dx, dz);
    if (segLength <= 0) continue;
    const ux = dx / segLength;
    const uz = dz / segLength;
    const px = -uz;
    const pz = ux;

    while (next <= walked + segLength) {
      const t = (next - walked) / segLength;
      const cx = a.x + dx * t;
      const cz = a.z + dz * t;
      for (const side of [-1, 1]) {
        const wobble = offset * (0.85 + hash01(planted, 1, seed) * 0.3);
        trees.push({
          assetKind: "tree",
          tint: "teal",
          x: cx + px * side * wobble,
          z: cz + pz * side * wobble,
          scale: 0.6 + hash01(planted, 2, seed) * 0.6,
          rotation: hash01(planted, 3, seed) * Math.PI * 2,
        });
        planted++;
      }
      next += spacing;
    }
    walked += segLength;
  }
  return trees;
}
