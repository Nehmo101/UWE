/**
 * Carve operations — the "Apfel-Prinzip".
 *
 * A terrain/planet is a signed distance field; carving subtracts regions from
 * it (bite, wedge, cave, tunnel, split). Ops are stored as an ordered JSON
 * list; the same list always re-meshes to the same world (deterministic).
 * Cut faces carry their own paint layers (inner seas, groves, ember) because
 * every inner surface is a full canvas.
 */

export type Vec3 = readonly [number, number, number];

export interface CarvePaintLayer {
  /** Painted patch on the cut face: palette hue + disc in cut-face UV space. */
  hue: string;
  center: readonly [number, number];
  radius: number;
}

export interface CarveOpBase {
  id: string;
  /** Cut-face material preset (fels | sediment | kristall | glut). */
  cutMaterial?: string;
  /** Painted content on the exposed inner surface. */
  paint?: CarvePaintLayer[];
  /** Non-destructive stack: disabled ops stay stored but are not applied. */
  disabled?: boolean;
}

export interface CarveBite extends CarveOpBase {
  kind: "bite";
  center: Vec3;
  radius: number;
}

export interface CarveCave extends CarveOpBase {
  kind: "cave";
  center: Vec3;
  radius: number;
}

export interface CarveTunnel extends CarveOpBase {
  kind: "tunnel";
  from: Vec3;
  to: Vec3;
  radius: number;
}

export interface CarveWedge extends CarveOpBase {
  kind: "wedge";
  /** Sector removed around +Y through the planet center, angles in radians. */
  angleStart: number;
  angleEnd: number;
}

export interface CarveSplit extends CarveOpBase {
  kind: "split";
  /** Unit normal of the split plane through the origin. */
  normal: Vec3;
  /** Total gap width — halves are pulled apart by gap/2 each. */
  gap: number;
  /**
   * Number of world roots bridging the gap (apple-core bundle). Optional —
   * the renderer applies its default when unset.
   */
  roots?: number;
}

export type CarveOp = CarveBite | CarveCave | CarveTunnel | CarveWedge | CarveSplit;

const CARVE_KINDS = new Set(["bite", "cave", "tunnel", "wedge", "split"]);

/** Valid range for the split op's world-root count. */
export const SPLIT_ROOTS_MIN = 1;
export const SPLIT_ROOTS_MAX = 24;

function parseSplitRoots(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(SPLIT_ROOTS_MAX, Math.max(SPLIT_ROOTS_MIN, Math.round(value)));
}

function isVec3(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === "number" && Number.isFinite(n));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parsePaint(value: unknown): CarvePaintLayer[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const layers: CarvePaintLayer[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const layer = raw as Record<string, unknown>;
    const center = layer.center;
    if (
      typeof layer.hue === "string" &&
      Array.isArray(center) &&
      center.length === 2 &&
      isFiniteNumber(center[0]) &&
      isFiniteNumber(center[1]) &&
      isFiniteNumber(layer.radius)
    ) {
      layers.push({ hue: layer.hue, center: [center[0], center[1]], radius: layer.radius });
    }
  }
  return layers.length > 0 ? layers : undefined;
}

/** Parse an unknown JSON value into a validated, ordered carve-op list. Invalid entries are dropped. */
export function parseCarveOps(value: unknown): CarveOp[] {
  if (!Array.isArray(value)) return [];
  const ops: CarveOp[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const op = raw as Record<string, unknown>;
    if (typeof op.id !== "string" || typeof op.kind !== "string" || !CARVE_KINDS.has(op.kind)) continue;
    const base: CarveOpBase = {
      id: op.id,
      cutMaterial: typeof op.cutMaterial === "string" ? op.cutMaterial : undefined,
      paint: parsePaint(op.paint),
      ...(op.disabled === true ? { disabled: true } : {}),
    };
    switch (op.kind) {
      case "bite":
      case "cave":
        if (isVec3(op.center) && isFiniteNumber(op.radius) && op.radius > 0) {
          ops.push({ ...base, kind: op.kind, center: op.center, radius: op.radius });
        }
        break;
      case "tunnel":
        if (isVec3(op.from) && isVec3(op.to) && isFiniteNumber(op.radius) && op.radius > 0) {
          ops.push({ ...base, kind: "tunnel", from: op.from, to: op.to, radius: op.radius });
        }
        break;
      case "wedge":
        if (isFiniteNumber(op.angleStart) && isFiniteNumber(op.angleEnd)) {
          ops.push({ ...base, kind: "wedge", angleStart: op.angleStart, angleEnd: op.angleEnd });
        }
        break;
      case "split":
        if (isVec3(op.normal) && isFiniteNumber(op.gap) && op.gap >= 0) {
          const roots = parseSplitRoots(op.roots);
          ops.push({ ...base, kind: "split", normal: op.normal, gap: op.gap, ...(roots !== undefined ? { roots } : {}) });
        }
        break;
    }
  }
  return ops;
}

/** Stable serialization: key order is fixed so equal op lists yield equal JSON. */
export function serializeCarveOps(ops: readonly CarveOp[]): string {
  return JSON.stringify(
    ops.map((op) => {
      const paint = op.paint?.map((p) => ({ hue: p.hue, center: p.center, radius: p.radius }));
      const base = { cutMaterial: op.cutMaterial ?? null, paint: paint ?? null, disabled: op.disabled ?? null };
      switch (op.kind) {
        case "bite":
        case "cave":
          return { id: op.id, kind: op.kind, center: op.center, radius: op.radius, ...base };
        case "tunnel":
          return { id: op.id, kind: op.kind, from: op.from, to: op.to, radius: op.radius, ...base };
        case "wedge":
          return { id: op.id, kind: op.kind, angleStart: op.angleStart, angleEnd: op.angleEnd, ...base };
        case "split":
          return { id: op.id, kind: op.kind, normal: op.normal, gap: op.gap, roots: op.roots ?? null, ...base };
      }
    }),
  );
}

// --- pure SDF math (consumed by @uwe/atlas-3d for meshing) ---

function length3(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

function sdSphere(p: Vec3, center: Vec3, radius: number): number {
  return length3(p[0] - center[0], p[1] - center[1], p[2] - center[2]) - radius;
}

function sdCapsule(p: Vec3, a: Vec3, b: Vec3, radius: number): number {
  const pa: Vec3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const ba: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const baLen2 = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2];
  const h = baLen2 > 0 ? Math.min(1, Math.max(0, (pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / baLen2)) : 0;
  return length3(pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h) - radius;
}

/** Signed distance of the REMOVED region of a single op (negative inside the removed volume). */
export function carveOpDistance(op: CarveOp, p: Vec3): number {
  switch (op.kind) {
    case "bite":
    case "cave":
      return sdSphere(p, op.center, op.radius);
    case "tunnel":
      return sdCapsule(p, op.from, op.to, op.radius);
    case "wedge": {
      // Sector around +Y: inside when atan2(z, x) lies within [angleStart, angleEnd].
      const angle = Math.atan2(p[2], p[0]);
      const mid = (op.angleStart + op.angleEnd) / 2;
      const half = Math.abs(op.angleEnd - op.angleStart) / 2;
      let delta = angle - mid;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      const radial = Math.hypot(p[0], p[2]);
      // Approximate angular distance as arc length at the point's radius.
      return (Math.abs(delta) - half) * Math.max(radial, 1e-6);
    }
    case "split": {
      const d = p[0] * op.normal[0] + p[1] * op.normal[1] + p[2] * op.normal[2];
      return Math.abs(d) - op.gap / 2;
    }
  }
}

/**
 * CSG subtraction of every op from a base distance:
 * result = max(base, -opDistance) per op, applied in order.
 */
export function applyCarveOps(baseDistance: number, p: Vec3, ops: readonly CarveOp[]): number {
  let d = baseDistance;
  for (const op of ops) {
    if (op.disabled) continue;
    d = Math.max(d, -carveOpDistance(op, p));
  }
  return d;
}

/** Index of the op whose removed region the point lies in (for cut-face materials), or -1. */
export function dominantCarveOp(p: Vec3, ops: readonly CarveOp[]): number {
  let best = -1;
  let bestDepth = 0;
  for (let i = 0; i < ops.length; i++) {
    if (ops[i].disabled) continue;
    const d = carveOpDistance(ops[i], p);
    if (d < bestDepth) {
      bestDepth = d;
      best = i;
    }
  }
  return best;
}
