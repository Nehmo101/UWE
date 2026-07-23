/**
 * Weltwurzeln — the white world-roots.
 *
 * Lore-central asset: paper-white strands that spiral HIGHER than everything
 * else and, on a split globe, bridge the gap between the world halves.
 *
 * Bridge shape ("Apfel-Prinzip"): the strands do NOT run as parallel offset
 * tubes. Like the core of a bitten apple they fan out on each cut face, grow
 * together into one slim braided bundle on the split axis at mid-gap, and fan
 * out again into the other half — visually holding the two levels together.
 */

import * as THREE from "three";
import { createInkMaterial, createOutlineMaterial } from "./ink-style";

const PAPER = new THREE.Color("#f1e8d4");
const PAPER_DARK = new THREE.Color("#d9cba1");

function deterministicOffset(index: number, salt: number): number {
  const n = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function tubeWithColor(curve: THREE.Curve<THREE.Vector3>, radius: number, color: THREE.Color): THREE.BufferGeometry {
  const geometry = new THREE.TubeGeometry(curve, 24, radius, 6, false);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export interface WorldRootBridgeOptions {
  /** Split plane normal — roots run along it through the gap. */
  normal: THREE.Vector3;
  gap: number;
  planetRadius: number;
  count: number;
  seed: number;
}

/** Roots bridging the two halves of a split planet. */
export function buildWorldRootBridge(options: WorldRootBridgeOptions): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const fillMaterial = createInkMaterial({ objectSpaceLight: 0 });
  const outlineMaterial = createOutlineMaterial(0.012 * options.planetRadius);

  const axis = options.normal.clone().normalize();
  const anyUp = Math.abs(axis.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(axis, anyUp).normalize();
  const up = new THREE.Vector3().crossVectors(side, axis).normalize();
  const reach = options.gap / 2 + options.planetRadius * 0.22;

  for (let i = 0; i < options.count; i++) {
    const baseAngle = (i / options.count) * Math.PI * 2 + deterministicOffset(i, options.seed) * 0.8;
    const ring = options.planetRadius * (0.3 + deterministicOffset(i, options.seed + 1) * 0.25);
    // Shared slim waist on the axis — the strands merge into one core bundle.
    const core = options.planetRadius * (0.05 + deterministicOffset(i, options.seed + 3) * 0.03);
    const twist = 0.9 + deterministicOffset(i, options.seed + 4) * 0.8;
    const points: THREE.Vector3[] = [];
    const segments = 10;
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const along = -reach + t * reach * 2;
      // Concave apple-core silhouette: wide at the cut faces, pinched center.
      const w = Math.abs(2 * t - 1);
      const radial = core + (ring - core) * Math.pow(w, 1.6);
      const angle = baseAngle + twist * (t - 0.5);
      const bulge = Math.sin(t * Math.PI);
      const wobbleAmp = 0.05 * bulge * w * options.planetRadius;
      const offset = side
        .clone()
        .multiplyScalar(Math.cos(angle) * radial)
        .addScaledVector(up, Math.sin(angle) * radial);
      const wobble = side
        .clone()
        .multiplyScalar(Math.sin(t * Math.PI * 3 + i) * wobbleAmp)
        .addScaledVector(up, Math.cos(t * Math.PI * 3 + i * 2) * wobbleAmp);
      points.push(axis.clone().multiplyScalar(along).add(offset).add(wobble));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const radius = options.planetRadius * (0.035 + bulgeRadius(i, options.seed));
    const geometry = tubeWithColor(curve, radius, i % 2 === 0 ? PAPER : PAPER_DARK);
    geometries.push(geometry);
    const outline = new THREE.Mesh(geometry, outlineMaterial);
    const fill = new THREE.Mesh(geometry, fillMaterial);
    group.add(outline);
    group.add(fill);
  }

  return {
    group,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      fillMaterial.dispose();
      outlineMaterial.dispose();
    },
  };

  function bulgeRadius(index: number, salt: number): number {
    return deterministicOffset(index, salt + 2) * 0.02;
  }
}
