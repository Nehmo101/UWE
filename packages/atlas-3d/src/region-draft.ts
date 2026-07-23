/**
 * Region-draft state for the drill-down tool: clicked surface points plus the
 * face normal at each hit. Points are stored RAW (with true depth) — also on
 * the globe, so regions on crater floors, cut faces and tunnel walls keep
 * their 3D position instead of being collapsed onto the unit sphere.
 */

import * as THREE from "three";
import type { EditorDecor } from "./editor-decor";

export interface Atlas3DRegionDraft {
  /**
   * Globe: raw surface hit points (world units — may lie inside the hull).
   * Terrain: [x, y, z] map points.
   */
  points: [number, number, number][];
  /** Unit surface normal at each hit, same order as points. */
  normals: [number, number, number][];
  mode: "globe" | "terrain";
}

export class RegionDraftState {
  private readonly mode: "globe" | "terrain";
  private readonly decor: EditorDecor;
  private readonly onChange?: (count: number) => void;
  private readonly points: THREE.Vector3[] = [];
  private readonly normals: THREE.Vector3[] = [];

  constructor(mode: "globe" | "terrain", decor: EditorDecor, onChange?: (count: number) => void) {
    this.mode = mode;
    this.decor = decor;
    this.onChange = onChange;
  }

  get count(): number {
    return this.points.length;
  }

  add(point: THREE.Vector3, normal: THREE.Vector3): void {
    this.points.push(point.clone());
    this.normals.push(normal.clone().normalize());
    this.decor.updateRegionMarkers(this.points, this.normals);
    this.onChange?.(this.points.length);
  }

  clear(): void {
    if (this.points.length === 0) return;
    this.points.length = 0;
    this.normals.length = 0;
    this.decor.updateRegionMarkers(this.points, this.normals);
    this.onChange?.(0);
  }

  toDraft(): Atlas3DRegionDraft | null {
    if (this.points.length < 3) return null;
    return {
      mode: this.mode,
      points: this.points.map((p) => [p.x, p.y, p.z]),
      normals: this.normals.map((n) => [n.x, n.y, n.z]),
    };
  }
}
