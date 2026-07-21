/**
 * Scene object layer — placed assets, path ribbons and label billboards.
 *
 * Keeps the three.js bookkeeping (build/sync/dispose, hit-testing, selection
 * highlight, animation clock) out of the editor app. Documents in, meshes out.
 */

import * as THREE from "three";
import { buildInkAsset, INK_ASSET_DEFAULT_TINT, isInkAssetKind, isInkTint, type InkAssetKind, type InkTint } from "./assets-ink";
import { createInkMaterial, createOutlineMaterial, setInkTime } from "./ink-style";
import type { PathPoint } from "./terrain-path";

export interface DocObjectState {
  localId: string;
  id?: string;
  assetKind: InkAssetKind;
  tint: InkTint;
  /** Globe: unit direction {dir:[x,y,z]}. Terrain: {x,z}. Asteroid: orbit. */
  position: Record<string, unknown>;
  scale: number;
  rotation: number;
}

export interface DocFeatureState {
  localId: string;
  id?: string;
  kind: "river" | "road" | "label";
  points: PathPoint[];
  labelText?: string;
}

export function parseDocObjects(value: unknown): DocObjectState[] {
  if (!Array.isArray(value)) return [];
  const objects: DocObjectState[] = [];
  for (const [index, raw] of value.entries()) {
    if (typeof raw !== "object" || raw === null) continue;
    const o = raw as Record<string, unknown>;
    if (!isInkAssetKind(o.assetKind)) continue;
    objects.push({
      localId: typeof o.localId === "string" ? o.localId : `obj-${index}`,
      id: typeof o.id === "string" ? o.id : undefined,
      assetKind: o.assetKind,
      tint: isInkTint(o.tint) ? o.tint : INK_ASSET_DEFAULT_TINT[o.assetKind],
      position: (typeof o.position === "object" && o.position !== null ? o.position : {}) as Record<string, unknown>,
      scale: typeof o.scale === "number" && Number.isFinite(o.scale) ? o.scale : 1,
      rotation: typeof o.rotation === "number" && Number.isFinite(o.rotation) ? o.rotation : 0,
    });
  }
  return objects;
}

export function parseDocFeatures(value: unknown): DocFeatureState[] {
  if (!Array.isArray(value)) return [];
  const features: DocFeatureState[] = [];
  for (const [index, raw] of value.entries()) {
    if (typeof raw !== "object" || raw === null) continue;
    const f = raw as Record<string, unknown>;
    if (f.kind !== "river" && f.kind !== "road" && f.kind !== "label") continue;
    const points = Array.isArray(f.points)
      ? f.points
          .filter((p): p is { x: number; z: number } =>
            typeof p === "object" && p !== null &&
            typeof (p as { x?: unknown }).x === "number" &&
            typeof (p as { z?: unknown }).z === "number",
          )
          .map((p) => ({ x: p.x, z: p.z }))
      : [];
    if (f.kind === "label" ? points.length < 1 : points.length < 2) continue;
    features.push({
      localId: typeof f.localId === "string" ? f.localId : `feat-${index}`,
      id: typeof f.id === "string" ? f.id : undefined,
      kind: f.kind,
      points,
      labelText: typeof f.labelText === "string" ? f.labelText : undefined,
    });
  }
  return features;
}

const RIVER_CENTER = new THREE.Color("#4a76a3");
const RIVER_EDGE = new THREE.Color("#27425d");
const ROAD_COLOR = new THREE.Color("#93744e");

function ribbonGeometry(points: readonly PathPoint[], heightAt: (x: number, z: number) => number, width: number, center: THREE.Color, edge: THREE.Color): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const lift = 0.02;
  type V = { x: number; y: number; z: number; c: THREE.Color };
  const push = (v: V) => {
    positions.push(v.x, v.y, v.z);
    colors.push(v.c.r, v.c.g, v.c.b);
  };
  const tri = (a: V, b: V, c: V) => {
    push(a);
    push(b);
    push(c);
  };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const px = (-dz / len) * width;
    const pz = (dx / len) * width;
    const ya = heightAt(a.x, a.z) + lift;
    const yb = heightAt(b.x, b.z) + lift;
    const L0: V = { x: a.x - px, y: ya, z: a.z - pz, c: edge };
    const L1: V = { x: b.x - px, y: yb, z: b.z - pz, c: edge };
    const C0: V = { x: a.x, y: ya, z: a.z, c: center };
    const C1: V = { x: b.x, y: yb, z: b.z, c: center };
    const R0: V = { x: a.x + px, y: ya, z: a.z + pz, c: edge };
    const R1: V = { x: b.x + px, y: yb, z: b.z + pz, c: edge };
    tri(L0, C0, C1);
    tri(L0, C1, L1);
    tri(C0, R0, R1);
    tri(C0, R1, C1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));
  return geometry;
}

function labelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const label = text.length > 0 ? text : "Label";
  canvas.width = 512;
  canvas.height = 128;
  if (context) {
    context.font = "600 56px Iowan Old Style, Palatino, Georgia, serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.strokeStyle = "#f1e8d4";
    context.lineWidth = 10;
    context.strokeText(label, 256, 64);
    context.fillStyle = "#211d17";
    context.fillText(label, 256, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.9, 0.225, 1);
  return sprite;
}

export interface ObjectLayerHost {
  mode: "globe" | "terrain";
  surfaceHeight(x: number, z: number): number;
  globeRadiusAt(dir: THREE.Vector3): number;
}

/** Manages placed assets + features as three.js children of one group. */
export class SceneObjectLayer {
  readonly group = new THREE.Group();
  private readonly host: ObjectLayerHost;
  private disposables: { dispose(): void }[] = [];
  private hitMeshes: THREE.Object3D[] = [];
  private materials: THREE.ShaderMaterial[] = [];
  private selection = new Set<string>();

  constructor(host: ObjectLayerHost) {
    this.host = host;
  }

  setSelection(localIds: ReadonlySet<string>): void {
    this.selection = new Set(localIds);
  }

  /** Raycast targets; each carries userData.localId. */
  get pickables(): readonly THREE.Object3D[] {
    return this.hitMeshes;
  }

  updateTime(seconds: number): void {
    setInkTime(this.materials, seconds);
    for (const child of this.group.children) {
      const orbit = child.userData.orbit as { radius: number; inclination?: number; phase?: number; speed?: number } | undefined;
      if (!orbit) continue;
      const angle = (orbit.phase ?? 0) + seconds * (orbit.speed ?? 0.1);
      const flat = new THREE.Vector3(Math.cos(angle) * orbit.radius, 0, Math.sin(angle) * orbit.radius);
      flat.applyAxisAngle(new THREE.Vector3(0, 0, 1), orbit.inclination ?? 0);
      child.position.copy(flat);
      child.rotation.set(seconds * 0.6, seconds * 0.8, 0);
    }
  }

  sync(objects: readonly DocObjectState[], features: readonly DocFeatureState[], time: number): void {
    this.clear();
    for (const object of objects) {
      const data = buildInkAsset(object.assetKind, object.tint);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
      geometry.setAttribute("aAnim", new THREE.BufferAttribute(data.anim, 4));
      geometry.computeVertexNormals();
      const selected = this.selection.has(object.localId);
      const fillMaterial = createInkMaterial({ objectSpaceLight: this.host.mode === "terrain" ? 1 : 0 });
      const outlineMaterial = createOutlineMaterial(data.outlineWidth * (selected ? 2.2 : 1));
      if (selected) {
        (outlineMaterial.uniforms.uInk.value as THREE.Color).set("#c2622b");
      }
      this.materials.push(fillMaterial, outlineMaterial);
      const fill = new THREE.Mesh(geometry, fillMaterial);
      const outline = new THREE.Mesh(geometry, outlineMaterial);
      const holder = new THREE.Group();
      holder.add(outline);
      holder.add(fill);
      const baseScale = (this.host.mode === "globe" ? 0.1 : 0.11) * object.scale;
      holder.scale.setScalar(baseScale);

      const orbit = object.position.orbit as { radius?: number; inclination?: number; phase?: number; speed?: number } | undefined;
      if (object.assetKind === "asteroid" && orbit && typeof orbit.radius === "number") {
        const angle = (orbit.phase ?? 0) + time * (orbit.speed ?? 0.1);
        const flat = new THREE.Vector3(Math.cos(angle) * orbit.radius, 0, Math.sin(angle) * orbit.radius);
        flat.applyAxisAngle(new THREE.Vector3(0, 0, 1), orbit.inclination ?? 0);
        holder.position.copy(flat);
        holder.rotation.set(time * 0.6, time * 0.8, 0);
        holder.userData.orbit = orbit;
      } else if (this.host.mode === "globe") {
        const dirRaw = object.position.dir as number[] | undefined;
        const dir = new THREE.Vector3(...(Array.isArray(dirRaw) && dirRaw.length === 3 ? dirRaw : [0, 1, 0])).normalize();
        holder.position.copy(dir.clone().multiplyScalar(this.host.globeRadiusAt(dir)));
        holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        holder.rotateY(object.rotation);
      } else {
        const x = typeof object.position.x === "number" ? object.position.x : 0;
        const z = typeof object.position.z === "number" ? object.position.z : 0;
        holder.position.set(x, this.host.surfaceHeight(x, z), z);
        holder.rotation.y = object.rotation;
      }
      fill.userData.localId = object.localId;
      outline.userData.localId = object.localId;
      holder.userData.localId = object.localId;
      this.hitMeshes.push(fill);
      this.group.add(holder);
      this.disposables.push({
        dispose: () => {
          geometry.dispose();
          fillMaterial.dispose();
          outlineMaterial.dispose();
        },
      });
    }

    for (const feature of features) {
      if (feature.kind === "label") {
        if (typeof document === "undefined") continue;
        const sprite = labelSprite(feature.labelText ?? "");
        const point = feature.points[0];
        const y = this.host.mode === "terrain" ? this.host.surfaceHeight(point.x, point.z) + 0.32 : 1.25;
        sprite.position.set(point.x, y, point.z);
        sprite.userData.localId = feature.localId;
        this.group.add(sprite);
        this.hitMeshes.push(sprite);
        this.disposables.push({
          dispose: () => {
            sprite.material.map?.dispose();
            sprite.material.dispose();
          },
        });
        continue;
      }
      const width = feature.kind === "river" ? 0.055 : 0.035;
      const center = feature.kind === "river" ? RIVER_CENTER : ROAD_COLOR;
      const edge = feature.kind === "river" ? RIVER_EDGE : ROAD_COLOR;
      const geometry = ribbonGeometry(feature.points, (x, z) => this.host.surfaceHeight(x, z), width, center, edge);
      const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.localId = feature.localId;
      this.group.add(mesh);
      this.hitMeshes.push(mesh);
      this.disposables.push({
        dispose: () => {
          geometry.dispose();
          material.dispose();
        },
      });
    }
  }

  clear(): void {
    for (const disposable of this.disposables) disposable.dispose();
    this.disposables = [];
    this.hitMeshes = [];
    this.materials = [];
    this.group.clear();
  }

  dispose(): void {
    this.clear();
  }
}
