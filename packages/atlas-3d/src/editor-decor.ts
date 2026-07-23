/**
 * Editor viewport decorations: translucent water plane, the inherited
 * silhouette drawn as ink line, and the region-draft markers (ember dots +
 * outline). Split out of editor-app to keep both files within budget.
 */

import * as THREE from "three";
import type { Vec2 } from "@uwe/atlas-editor/geometry";

const INK = new THREE.Color("#211d17");
const WATER_BLUE = new THREE.Color("#4a76a3");
const EMBER = new THREE.Color("#c2622b");
const PAPER = new THREE.Color("#f1e8d4");

export type GridOverlayKind = "aus" | "quad" | "hex";
export type WeatherKind = "klar" | "wolken" | "regen" | "schnee";

function hash01(a: number, b: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export class EditorDecor {
  private readonly scene: THREE.Scene;
  private readonly mode: "globe" | "terrain";
  private readonly mapSize: number;
  private waterMesh: THREE.Mesh | null = null;
  private silhouetteLine: THREE.LineLoop | null = null;
  private markers: THREE.Group | null = null;
  private gridLines: THREE.LineSegments | null = null;
  private weatherGroup: THREE.Group | null = null;
  private precipitation: THREE.Points | null = null;
  private precipitationSpeed = 0;
  private lastTickTime: number | null = null;

  constructor(scene: THREE.Scene, mode: "globe" | "terrain", mapSize: number) {
    this.scene = scene;
    this.mode = mode;
    this.mapSize = mapSize;
  }

  updateWater(waterLevel: number): void {
    if (this.waterMesh) {
      this.scene.remove(this.waterMesh);
      (this.waterMesh.material as THREE.Material).dispose();
      this.waterMesh.geometry.dispose();
      this.waterMesh = null;
    }
    if (this.mode !== "terrain") return;
    const geometry = new THREE.PlaneGeometry(this.mapSize * 2.4, this.mapSize * 2.4);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: WATER_BLUE, transparent: true, opacity: 0.55 });
    this.waterMesh = new THREE.Mesh(geometry, material);
    this.waterMesh.position.y = waterLevel;
    this.scene.add(this.waterMesh);
  }

  updateSilhouette(silhouette: readonly Vec2[] | null, waterLevel: number): void {
    if (this.silhouetteLine) {
      this.scene.remove(this.silhouetteLine);
      this.silhouetteLine.geometry.dispose();
      (this.silhouetteLine.material as THREE.Material).dispose();
      this.silhouetteLine = null;
    }
    if (this.mode !== "terrain" || !silhouette || silhouette.length < 3) return;
    const points = silhouette.map(([x, z]) => new THREE.Vector3(x, waterLevel + 0.03, z));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.6 });
    this.silhouetteLine = new THREE.LineLoop(geometry, material);
    this.scene.add(this.silhouetteLine);
  }

  /**
   * Draft markers sit slightly OFF the clicked surface along its normal (not
   * radially), so they stay visible on crater floors and cut faces too.
   */
  updateRegionMarkers(regionPoints: readonly THREE.Vector3[], normals?: readonly THREE.Vector3[]): void {
    if (this.markers) {
      this.scene.remove(this.markers);
      this.markers.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineLoop) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      this.markers = null;
    }
    if (regionPoints.length === 0) return;
    const offsetOf = (point: THREE.Vector3, index: number): THREE.Vector3 => {
      if (this.mode === "terrain") return new THREE.Vector3(0, 1, 0);
      const normal = normals?.[index];
      return normal && normal.lengthSq() > 1e-9 ? normal.clone().normalize() : point.clone().normalize();
    };
    this.markers = new THREE.Group();
    for (const [index, point] of regionPoints.entries()) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 8, 8),
        new THREE.MeshBasicMaterial({ color: EMBER }),
      );
      marker.position.copy(point).addScaledVector(offsetOf(point, index), this.mode === "globe" ? 0.012 : 0.03);
      this.markers.add(marker);
    }
    if (regionPoints.length >= 2) {
      const lifted = regionPoints.map((p, index) =>
        p.clone().addScaledVector(offsetOf(p, index), this.mode === "globe" ? 0.015 : 0.03),
      );
      const line = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(lifted),
        new THREE.LineBasicMaterial({ color: EMBER }),
      );
      this.markers.add(line);
    }
    this.scene.add(this.markers);
  }

  /** Square/hex grid overlay for the tabletop view — flat levels only. */
  updateGrid(kind: GridOverlayKind): void {
    if (this.gridLines) {
      this.scene.remove(this.gridLines);
      this.gridLines.geometry.dispose();
      (this.gridLines.material as THREE.Material).dispose();
      this.gridLines = null;
    }
    if (this.mode !== "terrain" || kind === "aus") return;
    const size = this.mapSize;
    const y = 0.025;
    const points: THREE.Vector3[] = [];
    if (kind === "quad") {
      const step = size / 6;
      for (let i = -6; i <= 6; i++) {
        points.push(new THREE.Vector3(i * step, y, -size), new THREE.Vector3(i * step, y, size));
        points.push(new THREE.Vector3(-size, y, i * step), new THREE.Vector3(size, y, i * step));
      }
    } else {
      // pointy-top hexes, radius size/7
      const r = size / 7;
      const w = Math.sqrt(3) * r;
      for (let row = -8; row <= 8; row++) {
        for (let col = -8; col <= 8; col++) {
          const cx = col * w + (row % 2 === 0 ? 0 : w / 2);
          const cz = row * r * 1.5;
          if (Math.abs(cx) > size + r || Math.abs(cz) > size + r) continue;
          for (let corner = 0; corner < 6; corner++) {
            const a1 = ((corner + 0.5) / 6) * Math.PI * 2;
            const a2 = ((corner + 1.5) / 6) * Math.PI * 2;
            points.push(
              new THREE.Vector3(cx + Math.sin(a1) * r, y, cz + Math.cos(a1) * r),
              new THREE.Vector3(cx + Math.sin(a2) * r, y, cz + Math.cos(a2) * r),
            );
          }
        }
      }
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.22 });
    this.gridLines = new THREE.LineSegments(geometry, material);
    this.scene.add(this.gridLines);
  }

  /** Weather overlay: cloud puffs plus falling rain/snow particles (see tick()). */
  updateWeather(weather: WeatherKind): void {
    if (this.weatherGroup) {
      this.scene.remove(this.weatherGroup);
      this.weatherGroup.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      this.weatherGroup = null;
      this.precipitation = null;
    }
    if (weather === "klar") return;
    this.weatherGroup = new THREE.Group();

    const cloudMaterial = new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, opacity: 0.42 });
    const puffCount = this.mode === "globe" ? 9 : 6;
    for (let i = 0; i < puffCount; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.14 + hash01(i, 1) * 0.1, 10, 8), cloudMaterial.clone());
      puff.scale.set(1.7, 0.55, 1);
      if (this.mode === "globe") {
        const theta = hash01(i, 2) * Math.PI * 2;
        const phi = Math.acos(hash01(i, 3) * 1.6 - 0.8);
        puff.position.setFromSphericalCoords(1.42, phi, theta);
      } else {
        puff.position.set((hash01(i, 4) - 0.5) * this.mapSize * 1.8, 1.05 + hash01(i, 5) * 0.25, (hash01(i, 6) - 0.5) * this.mapSize * 1.8);
      }
      this.weatherGroup.add(puff);
    }
    cloudMaterial.dispose();

    if (weather === "regen" || weather === "schnee") {
      const count = 420;
      const positions = new Float32Array(count * 3);
      const range = this.mode === "globe" ? 2.1 : this.mapSize * 1.6;
      const heightRange = this.mode === "globe" ? 2.1 : 1.3;
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (hash01(i, 7) - 0.5) * range * 2;
        positions[i * 3 + 1] = hash01(i, 8) * heightRange;
        positions[i * 3 + 2] = (hash01(i, 9) - 0.5) * range * 2;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color: weather === "regen" ? WATER_BLUE : PAPER,
        size: weather === "regen" ? 0.014 : 0.022,
        transparent: true,
        opacity: 0.75,
        sizeAttenuation: true,
      });
      this.precipitation = new THREE.Points(geometry, material);
      this.precipitationSpeed = weather === "regen" ? 1.6 : 0.35;
      this.weatherGroup.add(this.precipitation);
    }
    this.scene.add(this.weatherGroup);
  }

  /** Advance falling particles; called from the render loop with the frame time (ms). */
  tick(timeMs: number): void {
    const last = this.lastTickTime;
    this.lastTickTime = timeMs;
    if (!this.precipitation || last === null) return;
    const dt = Math.min(0.1, Math.max(0, (timeMs - last) / 1000));
    const attribute = this.precipitation.geometry.attributes.position as THREE.BufferAttribute;
    const heightRange = this.mode === "globe" ? 2.1 : 1.3;
    const floor = this.mode === "globe" ? -heightRange : -0.1;
    for (let i = 0; i < attribute.count; i++) {
      let y = attribute.getY(i) - this.precipitationSpeed * dt;
      if (y < floor) y += heightRange - floor;
      attribute.setY(i, y);
    }
    attribute.needsUpdate = true;
  }

  dispose(): void {
    if (this.waterMesh) {
      this.scene.remove(this.waterMesh);
      (this.waterMesh.material as THREE.Material).dispose();
      this.waterMesh.geometry.dispose();
      this.waterMesh = null;
    }
    this.updateSilhouette(null, 0);
    this.updateRegionMarkers([]);
    this.updateGrid("aus");
    this.updateWeather("klar");
  }
}
