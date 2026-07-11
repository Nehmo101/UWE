import * as THREE from "three";

export interface Atlas3DPreview {
  points: readonly (readonly [number, number])[];
  closed?: boolean;
  color?: number;
}

export class OverlayLayer {
  readonly group = new THREE.Group();

  setPreview(preview: Atlas3DPreview | null, sampleHeight: (x: number, y: number) => number, worldWidth: number, worldDepth: number): void {
    this.clear();
    if (!preview || preview.points.length < 2) return;
    const points = preview.closed ? [...preview.points, preview.points[0]!] : preview.points;
    const vertices = points.flatMap(([x, y]) => [
      (x - 0.5) * worldWidth,
      sampleHeight(x, y) + 0.006,
      (y - 0.5) * worldDepth,
    ]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: preview.color ?? 0xc2622b, depthTest: false }));
    line.renderOrder = 10;
    this.group.add(line);
  }

  clear(): void {
    for (const child of this.group.children) {
      const line = child as THREE.Line<THREE.BufferGeometry, THREE.Material>;
      line.geometry.dispose();
      line.material.dispose();
    }
    this.group.clear();
  }

  dispose(): void {
    this.clear();
  }
}
