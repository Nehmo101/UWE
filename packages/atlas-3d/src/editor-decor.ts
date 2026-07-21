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

export class EditorDecor {
  private readonly scene: THREE.Scene;
  private readonly mode: "globe" | "terrain";
  private readonly mapSize: number;
  private waterMesh: THREE.Mesh | null = null;
  private silhouetteLine: THREE.LineLoop | null = null;
  private markers: THREE.Group | null = null;

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

  updateRegionMarkers(regionPoints: readonly THREE.Vector3[]): void {
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
    this.markers = new THREE.Group();
    for (const point of regionPoints) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 8, 8),
        new THREE.MeshBasicMaterial({ color: EMBER }),
      );
      marker.position.copy(point).multiplyScalar(this.mode === "globe" ? 1.01 : 1);
      if (this.mode === "terrain") marker.position.y = point.y + 0.03;
      this.markers.add(marker);
    }
    if (regionPoints.length >= 2) {
      const lifted = regionPoints.map((p) =>
        this.mode === "globe" ? p.clone().multiplyScalar(1.012) : new THREE.Vector3(p.x, p.y + 0.03, p.z),
      );
      const line = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(lifted),
        new THREE.LineBasicMaterial({ color: EMBER }),
      );
      this.markers.add(line);
    }
    this.scene.add(this.markers);
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
  }
}
