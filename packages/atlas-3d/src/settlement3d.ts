/**
 * Siedlungs-Generator — one click plants a deterministic hamlet.
 *
 * Pure layout math: houses ring a small plaza with hash-based (not random)
 * jitter, a watchtower guards the largest gap, and a road stub connects the
 * plaza to the nearest edge. Same click position + seed → same settlement,
 * in line with the "no random variation" owner decision.
 */

import type { DocFeatureState, DocObjectState } from "./scene-objects";

export interface Settlement3DOptions {
  center: { x: number; z: number };
  seed: number;
  /** Overall footprint radius in map units. */
  radius?: number;
  houseCount?: number;
  /** Prefix for generated localIds (caller supplies its sequence base). */
  idPrefix: string;
}

export interface Settlement3DResult {
  objects: DocObjectState[];
  features: DocFeatureState[];
}

function hash01(a: number, b: number, seed: number): number {
  let n = Math.imul(a * 1597 + b * 51749 + seed * 7919, 2654435761);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function generateSettlement3D(options: Settlement3DOptions): Settlement3DResult {
  const radius = options.radius ?? 0.42;
  const houseCount = Math.max(3, Math.min(9, options.houseCount ?? 6));
  const { center, seed, idPrefix } = options;

  const objects: DocObjectState[] = [];
  let localSeq = 0;
  const nextId = () => `${idPrefix}-${localSeq++}`;

  // houses ring the plaza; deterministic jitter keeps the lanes organic
  const angles: number[] = [];
  for (let i = 0; i < houseCount; i++) {
    const jitter = (hash01(i, 1, seed) - 0.5) * ((Math.PI * 2) / houseCount) * 0.5;
    const angle = (i / houseCount) * Math.PI * 2 + jitter;
    angles.push(angle);
    const ring = radius * (0.62 + hash01(i, 2, seed) * 0.3);
    const x = center.x + Math.cos(angle) * ring;
    const z = center.z + Math.sin(angle) * ring;
    objects.push({
      localId: nextId(),
      assetKind: "house",
      tint: "terra",
      position: { x, z },
      scale: 0.75 + hash01(i, 3, seed) * 0.3,
      // face the plaza
      rotation: Math.atan2(center.x - x, center.z - z),
    });
  }

  // watchtower in the widest gap between houses
  let widestGap = 0;
  let towerAngle = 0;
  const sorted = [...angles].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + Math.PI * 2;
    const gap = next - sorted[i];
    if (gap > widestGap) {
      widestGap = gap;
      towerAngle = sorted[i] + gap / 2;
    }
  }
  objects.push({
    localId: nextId(),
    assetKind: "tower",
    tint: "paper",
    position: {
      x: center.x + Math.cos(towerAngle) * radius * 1.1,
      z: center.z + Math.sin(towerAngle) * radius * 1.1,
    },
    scale: 0.85,
    rotation: 0,
  });

  // village tree on the plaza
  objects.push({
    localId: nextId(),
    assetKind: "tree",
    tint: "teal",
    position: {
      x: center.x + (hash01(7, 7, seed) - 0.5) * radius * 0.3,
      z: center.z + (hash01(8, 8, seed) - 0.5) * radius * 0.3,
    },
    scale: 1.1,
    rotation: 0,
  });

  // road stub from the plaza outward, opposite the tower
  const roadAngle = towerAngle + Math.PI;
  const features: DocFeatureState[] = [
    {
      localId: `${idPrefix}-weg`,
      kind: "road",
      points: [0.15, 0.6, 1.1, 1.7].map((t) => ({
        x: center.x + Math.cos(roadAngle) * radius * t,
        z: center.z + Math.sin(roadAngle) * radius * t + (hash01(Math.round(t * 10), 9, seed) - 0.5) * 0.06,
      })),
    },
  ];

  return { objects, features };
}
