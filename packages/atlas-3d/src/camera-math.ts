import type { Vec2, Vec3 } from "./types";

export interface OrbitCameraState {
  target: Vec3;
  distance: number;
  yaw: number;
  pitch: number;
  fov: number;
  aspect: number;
}

export type OrbitAction =
  | { type: "orbit"; deltaYaw: number; deltaPitch: number }
  | { type: "dolly"; factor: number }
  | { type: "pan"; dx: number; dz: number }
  | { type: "resize"; aspect: number }
  | { type: "target"; target: Vec3 };

export interface Ray3 {
  origin: Vec3;
  direction: Vec3;
}

const DEG = Math.PI / 180;

export function clampPitch(pitch: number): number {
  return Math.max(12, Math.min(89, pitch));
}

export function createOrbitState(overrides: Partial<OrbitCameraState> = {}): OrbitCameraState {
  return {
    target: overrides.target ?? [0, 0, 0],
    distance: Math.max(0.35, overrides.distance ?? 2.35),
    yaw: overrides.yaw ?? -28,
    pitch: clampPitch(overrides.pitch ?? 52),
    fov: Math.max(18, Math.min(80, overrides.fov ?? 42)),
    aspect: Math.max(0.01, overrides.aspect ?? 16 / 9),
  };
}

export function reduceOrbit(state: OrbitCameraState, action: OrbitAction): OrbitCameraState {
  if (action.type === "orbit") {
    return { ...state, yaw: state.yaw + action.deltaYaw, pitch: clampPitch(state.pitch + action.deltaPitch) };
  }
  if (action.type === "dolly") {
    return { ...state, distance: Math.max(0.35, Math.min(12, state.distance * action.factor)) };
  }
  if (action.type === "pan") {
    return { ...state, target: [state.target[0] + action.dx, state.target[1], state.target[2] + action.dz] };
  }
  if (action.type === "resize") return { ...state, aspect: Math.max(0.01, action.aspect) };
  return { ...state, target: action.target };
}

function normalise(v: Vec3): [number, number, number] {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross(a: Vec3, b: Vec3): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cameraPosition(state: OrbitCameraState): [number, number, number] {
  const yaw = state.yaw * DEG;
  const pitch = state.pitch * DEG;
  const horizontal = Math.cos(pitch) * state.distance;
  return [
    state.target[0] + Math.sin(yaw) * horizontal,
    state.target[1] + Math.sin(pitch) * state.distance,
    state.target[2] + Math.cos(yaw) * horizontal,
  ];
}

function cameraBasis(state: OrbitCameraState) {
  const position = cameraPosition(state);
  const forward = normalise([
    state.target[0] - position[0],
    state.target[1] - position[1],
    state.target[2] - position[2],
  ]);
  const right = normalise(cross(forward, [0, 1, 0]));
  const up = normalise(cross(right, forward));
  return { position, forward, right, up };
}

export function screenRay(state: OrbitCameraState, point: Vec2, viewport: Vec2): Ray3 {
  const width = Math.max(1, viewport[0]);
  const height = Math.max(1, viewport[1]);
  const ndcX = (point[0] / width) * 2 - 1;
  const ndcY = 1 - (point[1] / height) * 2;
  const halfHeight = Math.tan((state.fov * DEG) / 2);
  const basis = cameraBasis(state);
  return {
    origin: basis.position,
    direction: normalise([
      basis.forward[0] + basis.right[0] * ndcX * halfHeight * state.aspect + basis.up[0] * ndcY * halfHeight,
      basis.forward[1] + basis.right[1] * ndcX * halfHeight * state.aspect + basis.up[1] * ndcY * halfHeight,
      basis.forward[2] + basis.right[2] * ndcX * halfHeight * state.aspect + basis.up[2] * ndcY * halfHeight,
    ]),
  };
}

export function worldToScreen(
  state: OrbitCameraState,
  point: Vec3,
  viewport: Vec2,
): [number, number] | null {
  const basis = cameraBasis(state);
  const relative: Vec3 = [
    point[0] - basis.position[0],
    point[1] - basis.position[1],
    point[2] - basis.position[2],
  ];
  const depth = dot(relative, basis.forward);
  if (depth <= 1e-6) return null;
  const halfHeight = Math.tan((state.fov * DEG) / 2);
  const ndcX = dot(relative, basis.right) / (depth * halfHeight * state.aspect);
  const ndcY = dot(relative, basis.up) / (depth * halfHeight);
  return [(ndcX + 1) * viewport[0] * 0.5, (1 - ndcY) * viewport[1] * 0.5];
}

export function effectiveZoom(
  state: OrbitCameraState,
  viewportHeight: number,
  worldPixelHeight = 1280,
  worldDepth = 1.25,
): number {
  const pixelsPerSceneUnit = viewportHeight / (2 * state.distance * Math.tan((state.fov * DEG) / 2));
  return pixelsPerSceneUnit * (worldDepth / worldPixelHeight);
}
