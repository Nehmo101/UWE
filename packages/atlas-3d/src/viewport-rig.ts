/**
 * Orbit/top-down camera rig with smooth fly-to — shared by the editor and
 * the Portal viewer. Owns spherical orbit state + pan target and writes the
 * three.js camera each update.
 */

import * as THREE from "three";

export interface CameraPose {
  theta: number;
  phi: number;
  distance: number;
  target: [number, number, number];
}

export class OrbitRig {
  theta: number;
  phi: number;
  distance: number;
  readonly target = new THREE.Vector3();
  private flight: { from: CameraPose; to: CameraPose; start: number; duration: number } | null = null;

  constructor(initial: { theta: number; phi: number; distance: number }) {
    this.theta = initial.theta;
    this.phi = initial.phi;
    this.distance = initial.distance;
  }

  apply(camera: THREE.PerspectiveCamera): void {
    const sinPhi = Math.sin(this.phi);
    camera.position.set(
      this.target.x + Math.cos(this.theta) * sinPhi * this.distance,
      this.target.y + Math.cos(this.phi) * this.distance,
      this.target.z + Math.sin(this.theta) * sinPhi * this.distance,
    );
    camera.lookAt(this.target);
  }

  rotate(dx: number, dy: number, minPhi: number, maxPhi: number): void {
    this.theta += dx * 0.006;
    this.phi = Math.min(maxPhi, Math.max(minPhi, this.phi + dy * 0.006));
  }

  pan(dx: number, dy: number, limit: number): void {
    const scale = this.distance * 0.0016;
    const sin = Math.sin(this.theta);
    const cos = Math.cos(this.theta);
    this.target.x -= (dx * -sin + dy * -cos) * scale;
    this.target.z -= (dx * cos + dy * -sin) * scale;
    this.target.x = Math.min(limit, Math.max(-limit, this.target.x));
    this.target.z = Math.min(limit, Math.max(-limit, this.target.z));
  }

  zoom(direction: number, min: number, max = 8): void {
    this.distance = Math.min(max, Math.max(min, this.distance * (1 + direction * 0.08)));
  }

  pose(): CameraPose {
    return {
      theta: this.theta,
      phi: this.phi,
      distance: this.distance,
      target: [this.target.x, this.target.y, this.target.z],
    };
  }

  flyTo(pose: Partial<CameraPose>, durationMs: number, immediate: boolean): void {
    const to: CameraPose = {
      theta: pose.theta ?? this.theta,
      phi: pose.phi ?? this.phi,
      distance: pose.distance ?? this.distance,
      target: pose.target ?? [this.target.x, this.target.y, this.target.z],
    };
    if (immediate) {
      this.theta = to.theta;
      this.phi = to.phi;
      this.distance = to.distance;
      this.target.set(...to.target);
      this.flight = null;
      return;
    }
    this.flight = { from: this.pose(), to, start: performance.now(), duration: Math.max(1, durationMs) };
  }

  /** Advance an active flight; returns true while flying (camera needs apply). */
  tick(nowMs: number): boolean {
    if (!this.flight) return false;
    const t = Math.min(1, (nowMs - this.flight.start) / this.flight.duration);
    const ease = t * t * (3 - 2 * t);
    const { from, to } = this.flight;
    this.theta = from.theta + (to.theta - from.theta) * ease;
    this.phi = from.phi + (to.phi - from.phi) * ease;
    this.distance = from.distance + (to.distance - from.distance) * ease;
    this.target.set(
      from.target[0] + (to.target[0] - from.target[0]) * ease,
      from.target[1] + (to.target[1] - from.target[1]) * ease,
      from.target[2] + (to.target[2] - from.target[2]) * ease,
    );
    if (t >= 1) this.flight = null;
    return true;
  }
}
