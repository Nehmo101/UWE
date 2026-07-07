/**
 * Atlas settlement generator.
 *
 * Pure, deterministic settlement layout for a supplied polygon. The output is
 * intentionally plain Atlas-compatible feature/object data: consumers can save
 * it as regular roads/regions/objects while preserving settlement-specific
 * semantics in the local `kind` and `style.settlement` fields.
 */

import { AtlasFeatureKind, LAYER_Z } from "./constants";
import type { AtlasFeatureKind as AtlasFeatureKindValue } from "./constants";
import type { Coordinate, Path, Polygon } from "./geometry";
import { hashStringToSeed, mulberry32 } from "./prng";
import { placeSettlementBuildings, rotationToward, tooClose } from "./settlement-layout";
import { appendSettlementWaterfront, resolveWaterfrontOptions } from "./settlement-waterfront";
import type { SettlementWaterfrontOptions } from "./settlement-waterfront";

export type { SettlementWaterfrontOptions } from "./settlement-waterfront";

export type SettlementFeatureKind = "wall" | "road" | "plaza" | "waterfront" | "pier";
export type SettlementObjectKind =
  | "building"
  | "keep"
  | "market"
  | "well"
  | "gate"
  | "tower"
  | "dock";

export interface SettlementOptions {
  /** Deterministic seed. Strings are folded through hashStringToSeed. */
  seed?: number | string;
  /** Stable id prefix for generated features and objects. */
  idPrefix?: string;
  /** Optional node id copied onto every returned feature/object. */
  nodeId?: string;
  /** Visibility copied onto every returned feature/object. Defaults to dm_only. */
  visibility?: string;
  /** Density multiplier for inferred building count. 1 = default. */
  density?: number;
  /** Explicit building count. When omitted it is derived from polygon area. */
  buildingCount?: number;
  /** Optional harbor/waterfront variant; omitted keeps the inland default. */
  waterfront?: boolean | SettlementWaterfrontOptions;
  /** Number of wall gates and road spokes. Defaults to 4, clamped to 1..6. */
  gateCount?: number;
  /** Number of wall towers. Defaults to gateCount when walls are enabled. */
  towerCount?: number;
  /** Include a wall feature around the outer ring. Defaults to true. */
  includeWalls?: boolean;
  /** Include gate-to-center road features. Defaults to true. */
  includeRoads?: boolean;
  /** Include the central keep object. Defaults to true. */
  includeKeep?: boolean;
  /** Include the market/plaza object and plaza feature. Defaults to true. */
  includeMarket?: boolean;
  /** Include the well object. Defaults to true. */
  includeWell?: boolean;
  /** Override builtin palette ids/keys per object kind. */
  paletteItemIds?: Partial<Record<SettlementObjectKind, string>>;
}

export interface SettlementFeatureStyle {
  settlement: SettlementFeatureKind;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  lineDash?: number[];
  opacity?: number;
}

export interface SettlementFeature {
  id: string;
  kind: SettlementFeatureKind;
  atlasKind: AtlasFeatureKindValue;
  geometry: Path | Polygon;
  layer: number;
  visibility: string;
  style: SettlementFeatureStyle;
  labelHint?: string;
  nodeId?: string;
  meta?: Record<string, unknown>;
}

export interface SettlementObjectStyle {
  settlement: SettlementObjectKind;
  gouache?: string;
  lineWidth?: number;
  blur?: number;
}

export interface SettlementObject {
  id: string;
  kind: SettlementObjectKind;
  paletteItemId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  layer: number;
  visibility: string;
  style: SettlementObjectStyle;
  nodeId?: string;
  meta?: Record<string, unknown>;
}

export interface SettlementLayout {
  seed: number;
  center: Coordinate;
  features: SettlementFeature[];
  objects: SettlementObject[];
  meta: {
    area: number;
    buildingCount: number;
    gateCount: number;
    waterfront?: boolean;
    pierCount?: number;
  };
}

const DEFAULT_SEED = 7331;
const DEFAULT_VISIBILITY = "dm_only";

const DEFAULT_PALETTE_ITEMS: Record<SettlementObjectKind, string> = {
  building: "village",
  keep: "castle",
  market: "village",
  well: "village",
  gate: "tower",
  tower: "tower",
  dock: "harbor",
};

const DEFAULT_GOUACHE: Record<SettlementObjectKind, string> = {
  building: "g_house",
  keep: "g_keep",
  market: "g_stall",
  well: "g_well",
  gate: "g_tower",
  tower: "g_tower",
  dock: "g_ship",
};

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}

function seedToNumber(seed: number | string | undefined): number {
  if (seed == null) return DEFAULT_SEED;
  return typeof seed === "number" ? seed | 0 : hashStringToSeed(seed);
}

function samePoint(a: Coordinate, b: Coordinate): boolean {
  return Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(a[1] - b[1]) < 1e-12;
}

function openRing(ring: readonly Coordinate[]): Coordinate[] {
  if (ring.length > 1 && samePoint(ring[0]!, ring[ring.length - 1]!)) {
    return ring.slice(0, -1).map(([x, y]) => [x, y]);
  }
  return ring.map(([x, y]) => [x, y]);
}

function closeRing(ring: readonly Coordinate[]): Coordinate[] {
  const open = openRing(ring);
  return open.length > 0 ? [...open, open[0]!] : [];
}

function ringSignedArea(ring: readonly Coordinate[]): number {
  const open = openRing(ring);
  if (open.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < open.length; i++) {
    const [x1, y1] = open[i]!;
    const [x2, y2] = open[(i + 1) % open.length]!;
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function ringArea(ring: readonly Coordinate[]): number {
  return Math.abs(ringSignedArea(ring));
}

function polygonArea(polygon: Polygon): number {
  const outer = polygon.rings[0];
  if (!outer) return 0;
  const holes = polygon.rings.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0);
  return Math.max(0, ringArea(outer) - holes);
}

function ringBbox(ring: readonly Coordinate[]): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function ringCentroid(ring: readonly Coordinate[]): Coordinate {
  const open = openRing(ring);
  if (open.length === 0) return [0.5, 0.5];

  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < open.length; i++) {
    const [x1, y1] = open[i]!;
    const [x2, y2] = open[(i + 1) % open.length]!;
    const cross = x1 * y2 - x2 * y1;
    twiceArea += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }

  if (Math.abs(twiceArea) < 1e-12) {
    const sums = open.reduce<Coordinate>((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
    return [sums[0] / open.length, sums[1] / open.length];
  }
  return [cx / (3 * twiceArea), cy / (3 * twiceArea)];
}

function pointInRing(point: Coordinate, ring: readonly Coordinate[]): boolean {
  const [px, py] = point;
  const open = openRing(ring);
  let inside = false;
  for (let i = 0, j = open.length - 1; i < open.length; j = i++) {
    const [xi, yi] = open[i]!;
    const [xj, yj] = open[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygonWithHoles(point: Coordinate, polygon: Polygon): boolean {
  const outer = polygon.rings[0];
  if (!outer || !pointInRing(point, outer)) return false;
  return !polygon.rings.slice(1).some((ring) => pointInRing(point, ring));
}

function randomPointInPolygon(
  polygon: Polygon,
  bbox: [number, number, number, number],
  rng: () => number,
): Coordinate | undefined {
  const [minX, minY, maxX, maxY] = bbox;
  if (maxX <= minX || maxY <= minY) return undefined;

  for (let i = 0; i < 500; i++) {
    const point: Coordinate = [minX + rng() * (maxX - minX), minY + rng() * (maxY - minY)];
    if (pointInPolygonWithHoles(point, polygon)) return point;
  }
  return undefined;
}

function interiorPoint(
  polygon: Polygon,
  bbox: [number, number, number, number],
  rng: () => number,
): Coordinate | undefined {
  const outer = polygon.rings[0];
  if (!outer) return undefined;

  const centroid = ringCentroid(outer);
  if (pointInPolygonWithHoles(centroid, polygon)) return centroid;

  const random = randomPointInPolygon(polygon, bbox, rng);
  if (random) return random;

  return openRing(outer).find((point) => pointInPolygonWithHoles(point, polygon));
}

function moveToward(from: Coordinate, to: Coordinate, amount: number): Coordinate {
  return [from[0] + (to[0] - from[0]) * amount, from[1] + (to[1] - from[1]) * amount];
}

function pointOnRing(ring: readonly Coordinate[], fraction: number): Coordinate {
  const closed = closeRing(ring);
  if (closed.length === 0) return [0.5, 0.5];
  if (closed.length === 1) return closed[0]!;

  let total = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const [ax, ay] = closed[i]!;
    const [bx, by] = closed[i + 1]!;
    total += Math.hypot(bx - ax, by - ay);
  }
  if (total <= 0) return closed[0]!;

  let target = ((fraction % 1) + 1) % 1;
  target *= total;
  let walked = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const [ax, ay] = closed[i]!;
    const [bx, by] = closed[i + 1]!;
    const seg = Math.hypot(bx - ax, by - ay);
    if (seg === 0) continue;
    if (walked + seg >= target) {
      const t = (target - walked) / seg;
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    }
    walked += seg;
  }
  return closed[closed.length - 1]!;
}

function squarePolygon(center: Coordinate, radius: number): Polygon {
  const [cx, cy] = center;
  const ring: Coordinate[] = [
    [cx - radius, cy - radius],
    [cx + radius, cy - radius],
    [cx + radius, cy + radius],
    [cx - radius, cy + radius],
    [cx - radius, cy - radius],
  ];
  return { type: "Polygon", rings: [ring] };
}

function safeSquarePolygon(center: Coordinate, maxRadius: number, polygon: Polygon): Polygon {
  let radius = maxRadius;
  for (let i = 0; i < 8; i++) {
    const candidate = squarePolygon(center, radius);
    const corners = candidate.rings[0]!.slice(0, -1);
    if (corners.every((point) => pointInPolygonWithHoles(point, polygon))) return candidate;
    radius *= 0.65;
  }
  return squarePolygon(center, Math.max(maxRadius * 0.08, 0.001));
}

function objectStyle(kind: SettlementObjectKind): SettlementObjectStyle {
  return {
    settlement: kind,
    gouache: DEFAULT_GOUACHE[kind],
    lineWidth: kind === "keep" || kind === "tower" || kind === "gate" ? 1.6 : 1.2,
    blur: kind === "well" ? 0.2 : undefined,
  };
}

function createObject(
  kind: SettlementObjectKind,
  id: string,
  point: Coordinate,
  rotation: number,
  scale: number,
  opts: {
    nodeId?: string;
    visibility: string;
    paletteItemIds?: Partial<Record<SettlementObjectKind, string>>;
    meta?: Record<string, unknown>;
  },
): SettlementObject {
  return {
    id,
    kind,
    paletteItemId: opts.paletteItemIds?.[kind] ?? DEFAULT_PALETTE_ITEMS[kind],
    x: point[0],
    y: point[1],
    scale,
    rotation,
    layer: LAYER_Z.objects,
    visibility: opts.visibility,
    style: objectStyle(kind),
    ...(opts.nodeId ? { nodeId: opts.nodeId } : {}),
    ...(opts.meta ? { meta: opts.meta } : {}),
  };
}

function pointNear(
  center: Coordinate,
  distance: number,
  angle: number,
  polygon: Polygon,
  rng: () => number,
  bbox: [number, number, number, number],
): Coordinate {
  for (let attempt = 0; attempt < 10; attempt++) {
    const a = angle + attempt * 0.73;
    for (let step = 1; step >= 0.15; step -= 0.17) {
      const point: Coordinate = [
        center[0] + Math.cos(a) * distance * step,
        center[1] + Math.sin(a) * distance * step,
      ];
      if (pointInPolygonWithHoles(point, polygon)) return point;
    }
  }
  return randomPointInPolygon(polygon, bbox, rng) ?? center;
}

/**
 * Generate a deterministic settlement layout inside `polygon`.
 *
 * Invalid or too-small polygons return an empty layout rather than throwing.
 * All coordinates use Atlas normalized canvas space.
 */
export function generateSettlement(polygon: Polygon, options: SettlementOptions = {}): SettlementLayout {
  const seed = seedToNumber(options.seed);
  const rng = mulberry32(seed);
  const outer = polygon.rings[0];
  const visibility = options.visibility ?? DEFAULT_VISIBILITY;
  const idPrefix = options.idPrefix ?? `settlement-${seed}`;
  const features: SettlementFeature[] = [];
  const objects: SettlementObject[] = [];

  if (!outer || openRing(outer).length < 3) {
    return {
      seed,
      center: [0.5, 0.5],
      features,
      objects,
      meta: { area: 0, buildingCount: 0, gateCount: 0 },
    };
  }

  const area = polygonArea(polygon);
  const bbox = ringBbox(outer);
  const [minX, minY, maxX, maxY] = bbox;
  const span = Math.max(0.001, Math.min(maxX - minX, maxY - minY));
  const center = interiorPoint(polygon, bbox, rng);
  if (!center || area <= 0) {
    return {
      seed,
      center: [0.5, 0.5],
      features,
      objects,
      meta: { area: 0, buildingCount: 0, gateCount: 0 },
    };
  }

  const includeWalls = options.includeWalls ?? true;
  const includeRoads = options.includeRoads ?? true;
  const includeKeep = options.includeKeep ?? true;
  const includeMarket = options.includeMarket ?? true;
  const includeWell = options.includeWell ?? true;
  const gateCount = clampInt(options.gateCount ?? 4, 1, 6);
  const towerCount = clampInt(options.towerCount ?? (includeWalls ? gateCount : 0), 0, 12);
  const density = Math.max(0, options.density ?? 1);
  const inferredBuildingCount = density <= 0 ? 0 : clampInt(area * 90 * density, 6, 36);
  const buildingCount = clampInt(options.buildingCount ?? inferredBuildingCount, 0, 60);
  const waterfrontOptions = resolveWaterfrontOptions(options.waterfront);
  const nodePart = options.nodeId ? { nodeId: options.nodeId } : {};
  let generatedPierCount = 0;

  const roadPaths: Coordinate[][] = [];
  const gates: Coordinate[] = [];
  const gateOffset = rng();
  for (let i = 0; i < gateCount; i++) {
    gates.push(pointOnRing(outer, gateOffset + i / gateCount));
  }

  if (includeWalls) {
    features.push({
      id: `${idPrefix}-feature-wall`,
      kind: "wall",
      atlasKind: AtlasFeatureKind.road,
      geometry: { type: "Path", coordinates: closeRing(outer), closed: true },
      layer: LAYER_Z.roads + 5,
      visibility,
      style: {
        settlement: "wall",
        strokeColor: "#4f4036",
        strokeWidth: 0.006,
        opacity: 0.95,
      },
      labelHint: "Wall",
      ...nodePart,
    });
  }

  if (includeRoads) {
    for (let i = 0; i < gates.length; i++) {
      const gate = gates[i]!;
      const bendBase = moveToward(gate, center, 0.55);
      const angle = rotationToward(gate, center) + 90;
      const bend: Coordinate = [
        bendBase[0] + Math.cos((angle * Math.PI) / 180) * (rng() - 0.5) * span * 0.12,
        bendBase[1] + Math.sin((angle * Math.PI) / 180) * (rng() - 0.5) * span * 0.12,
      ];
      const path = [moveToward(gate, center, 0.04), pointInPolygonWithHoles(bend, polygon) ? bend : bendBase, center];
      roadPaths.push(path);
      features.push({
        id: `${idPrefix}-feature-road-${i}`,
        kind: "road",
        atlasKind: AtlasFeatureKind.road,
        geometry: { type: "Path", coordinates: path },
        layer: LAYER_Z.roads,
        visibility,
        style: {
          settlement: "road",
          strokeColor: "#8f6f4a",
          strokeWidth: 0.004,
          opacity: 0.9,
        },
        labelHint: `Road ${i + 1}`,
        meta: { gateIndex: i },
        ...nodePart,
      });
    }
  }

  if (includeMarket) {
    const plaza = safeSquarePolygon(center, span * 0.055, polygon);
    features.push({
      id: `${idPrefix}-feature-plaza`,
      kind: "plaza",
      atlasKind: AtlasFeatureKind.region,
      geometry: plaza,
      layer: LAYER_Z.roads - 1,
      visibility,
      style: {
        settlement: "plaza",
        fillColor: "#d8bd8b",
        strokeColor: "#8f6f4a",
        strokeWidth: 0.002,
        opacity: 0.65,
      },
      labelHint: "Market square",
      ...nodePart,
    });
  }

  const occupied: Coordinate[] = [];
  const addObject = (
    kind: SettlementObjectKind,
    suffix: string,
    point: Coordinate,
    rotation: number,
    scale: number,
    meta?: Record<string, unknown>,
  ) => {
    occupied.push(point);
    objects.push(
      createObject(kind, `${idPrefix}-object-${suffix}`, point, rotation, scale, {
        nodeId: options.nodeId,
        visibility,
        paletteItemIds: options.paletteItemIds,
        meta,
      }),
    );
  };

  const gatePoints = gates.map((gate) => moveToward(gate, center, 0.035));
  const towerPoints: Coordinate[] = [];
  for (let i = 0; i < towerCount; i++) {
    towerPoints.push(
      moveToward(pointOnRing(outer, gateOffset + (i + 0.5) / Math.max(1, towerCount)), center, 0.035),
    );
  }

  if (waterfrontOptions) {
    generatedPierCount = appendSettlementWaterfront({
      options: waterfrontOptions,
      outer,
      center,
      span,
      idPrefix,
      visibility,
      nodePart,
      signedOuterArea: ringSignedArea(outer),
      features,
      roadPaths,
      rng,
      isInteriorPoint: (point) => pointInPolygonWithHoles(point, polygon),
      dockAvoidPoints: [...gatePoints, ...towerPoints],
      dockAvoidDistance: span * 0.05,
      addDockObject: (point, rotation, scale, meta) =>
        addObject("dock", "dock", point, rotation, scale, meta),
    });
  }

  /**
   * Civic anchors (keep, market, well) retry a few deterministic angle
   * offsets so they no longer stack on top of the dock or each other.
   */
  const anchorSpacing = span * 0.05;
  const pickAnchorPoint = (distance: number): Coordinate => {
    const baseAngle = rng() * Math.PI * 2;
    let candidate: Coordinate = center;
    for (let attempt = 0; attempt < 6; attempt++) {
      candidate = pointNear(center, distance, baseAngle + attempt * 1.7, polygon, rng, bbox);
      if (!tooClose(candidate, occupied, anchorSpacing)) return candidate;
    }
    return candidate;
  };

  if (includeKeep) {
    const point = pickAnchorPoint(span * 0.22);
    addObject("keep", "keep", point, rotationToward(point, center), 1.25, { role: "anchor" });
  }

  if (includeMarket) {
    const point = pickAnchorPoint(span * 0.035);
    addObject("market", "market", point, (rng() - 0.5) * 12, 0.95, { role: "civic" });
  }

  if (includeWell) {
    const point = pickAnchorPoint(span * 0.075);
    addObject("well", "well", point, 0, 0.68, { role: "civic" });
  }

  for (let i = 0; i < gatePoints.length; i++) {
    const point = gatePoints[i]!;
    if (!pointInPolygonWithHoles(point, polygon)) continue;
    addObject("gate", `gate-${i}`, point, rotationToward(point, center), 0.72, { gateIndex: i });
  }

  for (let i = 0; i < towerPoints.length; i++) {
    const point = towerPoints[i]!;
    if (!pointInPolygonWithHoles(point, polygon)) continue;
    addObject("tower", `tower-${i}`, point, rotationToward(point, center), 0.78, { towerIndex: i });
  }

  const waterfrontRings = features
    .filter((feature) => feature.kind === "waterfront" && feature.geometry.type === "Polygon")
    .map((feature) => (feature.geometry as Polygon).rings[0]!)
    .filter((ring) => ring.length >= 3);
  const buildingPlacements = placeSettlementBuildings({
    count: buildingCount,
    bbox,
    center,
    span,
    rng,
    isInterior: (point) => pointInPolygonWithHoles(point, polygon),
    occupied,
    roadPaths,
    ...(includeWalls ? { wallRing: closeRing(outer) } : {}),
    ...(waterfrontRings.length > 0 ? { keepOutRings: waterfrontRings } : {}),
  });
  buildingPlacements.forEach((placement, index) => {
    addObject("building", `building-${index}`, placement.point, placement.rotation, placement.scale);
  });

  return {
    seed,
    center,
    features,
    objects,
    meta: {
      area,
      buildingCount: objects.filter((object) => object.kind === "building").length,
      gateCount,
      ...(waterfrontOptions && generatedPierCount > 0
        ? { waterfront: true, pierCount: generatedPierCount }
        : {}),
    },
  };
}
