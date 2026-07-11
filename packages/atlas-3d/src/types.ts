import type { ElevationGrid } from "@uwe/atlas/elevation";

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export interface Atlas3DObject {
  id?: string;
  _key?: string;
  paletteItemId?: string;
  glyphKey?: string;
  x: number;
  y: number;
  scale?: number;
  rotation?: number;
  style?: {
    elevation?: number | null;
    gouache?: string | null;
    tint?: { hue?: number; saturate?: number } | null;
    [key: string]: unknown;
  } | null;
}

export interface Atlas3DHooks {
  getGrid(): ElevationGrid;
  getObjects(): readonly Atlas3DObject[];
  bakeGround(size: number): HTMLCanvasElement | OffscreenCanvas | Promise<HTMLCanvasElement | OffscreenCanvas>;
  drawObjectSprite?(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    object: Atlas3DObject,
    x: number,
    y: number,
    size: number,
  ): void;
  getLightDirection?(): unknown;
  onCameraChange?(): void;
}

export interface Atlas3DOptions {
  worldWidth?: number;
  worldDepth?: number;
  heightScale?: number;
  groundBakeSize?: number;
  initialPitch?: number;
  /** Enable plain left-drag camera panning (viewers); editors reserve left-drag for tools. */
  leftPan?: boolean;
}
