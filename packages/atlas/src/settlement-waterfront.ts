import { AtlasFeatureKind, LAYER_Z } from "./constants";
import type { Coordinate } from "./geometry";
import type { SettlementFeature } from "./settlement";

export interface SettlementWaterfrontOptions {
  /** Boundary edge selector as a ring fraction. Defaults to the longest outer edge. */
  edgeFraction?: number;
  /** Number of pier paths. Defaults to 2, clamped to 1..4. */
  pierCount?: number;
  /** Include the harbor/dock marker object. Defaults to true. */
  includeDock?: boolean;
}

export interface ResolvedWaterfrontOptions {
  edgeFraction?: number;
  pierCount: number;
  includeDock: boolean;
}

interface RingEdge {
  start: Coordinate;
  end: Coordinate;
  midpoint: Coordinate;
  length: number;
  fractionStart: number;
  fractionEnd: number;
}

export interface AppendWaterfrontInput {
  options: ResolvedWaterfrontOptions;
  outer: readonly Coordinate[];
  center: Coordinate;
  span: number;
  idPrefix: string;
  visibility: string;
  nodePart: { nodeId?: string };
  signedOuterArea: number;
  features: SettlementFeature[];
  roadPaths: Coordinate[][];
  rng: () => number;
  isInteriorPoint: (point: Coordinate) => boolean;
  addDockObject: (
    point: Coordinate,
    rotation: number,
    scale: number,
    meta?: Record<string, unknown>,
  ) => void;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}

export function resolveWaterfrontOptions(
  value: boolean | SettlementWaterfrontOptions | undefined,
): ResolvedWaterfrontOptions | undefined {
  if (!value) return undefined;
  const opts = value === true ? {} : value;
  const resolved: ResolvedWaterfrontOptions = {
    pierCount: clampInt(opts.pierCount ?? 2, 1, 4),
    includeDock: opts.includeDock ?? true,
  };
  if (Number.isFinite(opts.edgeFraction)) resolved.edgeFraction = opts.edgeFraction;
  return resolved;
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

function moveToward(from: Coordinate, to: Coordinate, amount: number): Coordinate {
  return [from[0] + (to[0] - from[0]) * amount, from[1] + (to[1] - from[1]) * amount];
}

function lerpPoint(a: Coordinate, b: Coordinate, amount: number): Coordinate {
  return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount];
}

function offsetPoint(point: Coordinate, direction: Coordinate, distance: number): Coordinate {
  return [point[0] + direction[0] * distance, point[1] + direction[1] * distance];
}

function rotationToward(from: Coordinate, to: Coordinate): number {
  return (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
}

function ringEdges(ring: readonly Coordinate[]): RingEdge[] {
  const open = openRing(ring);
  if (open.length < 2) return [];

  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < open.length; i++) {
    const start = open[i]!;
    const end = open[(i + 1) % open.length]!;
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    lengths.push(length);
    total += length;
  }
  if (total <= 0) return [];

  let walked = 0;
  return open.map((start, i) => {
    const end = open[(i + 1) % open.length]!;
    const length = lengths[i]!;
    const fractionStart = walked / total;
    walked += length;
    return {
      start,
      end,
      midpoint: lerpPoint(start, end, 0.5),
      length,
      fractionStart,
      fractionEnd: walked / total,
    };
  });
}

function edgeAtFraction(ring: readonly Coordinate[], fraction: number): RingEdge | undefined {
  const edges = ringEdges(ring);
  if (edges.length === 0) return undefined;
  const target = ((fraction % 1) + 1) % 1;
  return edges.find((edge) => target >= edge.fractionStart && target <= edge.fractionEnd) ?? edges[0];
}

function longestRingEdge(ring: readonly Coordinate[]): RingEdge | undefined {
  return ringEdges(ring).reduce<RingEdge | undefined>(
    (longest, edge) => (!longest || edge.length > longest.length ? edge : longest),
    undefined,
  );
}

function exteriorNormal(edge: RingEdge, signedArea: number): Coordinate {
  if (edge.length <= 0) return [0, -1];
  const dx = edge.end[0] - edge.start[0];
  const dy = edge.end[1] - edge.start[1];
  return signedArea >= 0
    ? [dy / edge.length, -dx / edge.length]
    : [-dy / edge.length, dx / edge.length];
}

function firstInteriorPointToward(
  from: Coordinate,
  to: Coordinate,
  isInteriorPoint: (point: Coordinate) => boolean,
): Coordinate | undefined {
  for (const amount of [0.04, 0.08, 0.14, 0.22, 0.35]) {
    const point = moveToward(from, to, amount);
    if (isInteriorPoint(point)) return point;
  }
  return undefined;
}

export function appendSettlementWaterfront(input: AppendWaterfrontInput): number {
  const edge =
    input.options.edgeFraction == null
      ? longestRingEdge(input.outer)
      : edgeAtFraction(input.outer, input.options.edgeFraction);
  if (!edge || edge.length <= 0) return 0;

  const normal = exteriorNormal(edge, input.signedOuterArea);
  const shoreStart = moveToward(edge.start, edge.end, 0.12);
  const shoreEnd = moveToward(edge.end, edge.start, 0.12);
  const waterStart = offsetPoint(shoreStart, normal, input.span * 0.075);
  const waterEnd = offsetPoint(shoreEnd, normal, input.span * 0.075);
  const landEnd = moveToward(shoreEnd, input.center, 0.1);
  const landStart = moveToward(shoreStart, input.center, 0.1);

  input.features.push({
    id: `${input.idPrefix}-feature-waterfront`,
    kind: "waterfront",
    atlasKind: AtlasFeatureKind.region,
    geometry: {
      type: "Polygon",
      rings: [[waterStart, waterEnd, landEnd, landStart, waterStart]],
    },
    layer: LAYER_Z.rivers,
    visibility: input.visibility,
    style: {
      settlement: "waterfront",
      fillColor: "#94b7c5",
      strokeColor: "#365f6b",
      strokeWidth: 0.002,
      opacity: 0.58,
    },
    labelHint: "Waterfront",
    meta: {
      role: "waterfront",
      edgeFraction: (edge.fractionStart + edge.fractionEnd) / 2,
    },
    ...input.nodePart,
  });

  for (let i = 0; i < input.options.pierCount; i++) {
    const amount = (i + 1) / (input.options.pierCount + 1);
    const shore = lerpPoint(edge.start, edge.end, amount);
    const land =
      firstInteriorPointToward(shore, input.center, input.isInteriorPoint) ??
      moveToward(shore, input.center, 0.1);
    const water = offsetPoint(shore, normal, input.span * (0.09 + input.rng() * 0.025));
    const path = [land, shore, water];
    input.roadPaths.push(path);
    input.features.push({
      id: `${input.idPrefix}-feature-pier-${i}`,
      kind: "pier",
      atlasKind: AtlasFeatureKind.road,
      geometry: { type: "Path", coordinates: path },
      layer: LAYER_Z.roads + 2,
      visibility: input.visibility,
      style: {
        settlement: "pier",
        strokeColor: "#5f4229",
        strokeWidth: 0.005,
        opacity: 0.92,
      },
      labelHint: `Pier ${i + 1}`,
      meta: { pierIndex: i, role: "waterfront" },
      ...input.nodePart,
    });
  }

  if (input.options.includeDock) {
    const point = firstInteriorPointToward(edge.midpoint, input.center, input.isInteriorPoint) ?? input.center;
    input.addDockObject(point, rotationToward(point, offsetPoint(point, normal, 1)), 0.9, {
      role: "waterfront",
    });
  }

  return input.options.pierCount;
}
