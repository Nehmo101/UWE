/**
 * Tusche-Look for three.js — hard cel bands + inverted-hull ink outline.
 *
 * The map light is fixed relative to the object (objectSpaceLight = 1) so
 * shading never jumps while the map rotates; the globe uses world lighting
 * (sun stays put, planet turns).
 */

import * as THREE from "three";
import type { PlanetMeshData } from "./planet-mesh";

export const INK_COLOR = new THREE.Color("#211d17");
export const PAPER_COLOR = new THREE.Color("#f1e8d4");

export interface InkMaterialOptions {
  /** 1 = light fixed to the object (maps), 0 = world light (globe). */
  objectSpaceLight: number;
  lightDirection?: THREE.Vector3;
}

const VERTEX = /* glsl */ `
  attribute vec3 color;
  attribute vec4 aAnim;
  uniform float uTime;
  varying vec3 vColor;
  varying vec3 vNormalObject;
  varying vec3 vNormalWorld;
  void main() {
    vColor = color;
    vNormalObject = normalize(normal);
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    vec3 p = position + aAnim.xyz * sin(uTime + aAnim.w);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uLightDir;
  uniform float uObjectSpaceLight;
  varying vec3 vColor;
  varying vec3 vNormalObject;
  varying vec3 vNormalWorld;
  void main() {
    vec3 n = normalize(mix(vNormalWorld, vNormalObject, uObjectSpaceLight));
    float d = max(dot(n, normalize(uLightDir)), 0.0);
    d = d > 0.72 ? 1.0 : (d > 0.38 ? 0.62 : 0.34);
    gl_FragColor = vec4(vColor * (0.45 + 0.55 * d), 1.0);
  }
`;

const OUTLINE_VERTEX = /* glsl */ `
  attribute vec4 aAnim;
  uniform float uWidth;
  uniform float uTime;
  void main() {
    vec3 p = position + normalize(normal) * uWidth + aAnim.xyz * sin(uTime + aAnim.w);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const OUTLINE_FRAGMENT = /* glsl */ `
  uniform vec3 uInk;
  void main() {
    gl_FragColor = vec4(uInk, 1.0);
  }
`;

export function createInkMaterial(options: InkMaterialOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uLightDir: { value: options.lightDirection?.clone() ?? new THREE.Vector3(0.5, 0.85, 0.55) },
      uObjectSpaceLight: { value: options.objectSpaceLight },
      uTime: { value: 0 },
    },
  });
}

export function createOutlineMaterial(width: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: OUTLINE_VERTEX,
    fragmentShader: OUTLINE_FRAGMENT,
    uniforms: {
      uWidth: { value: width },
      uInk: { value: INK_COLOR.clone() },
      uTime: { value: 0 },
    },
    side: THREE.BackSide,
  });
}

/** Advance the idle animation clock on ink/outline materials. */
export function setInkTime(materials: readonly THREE.ShaderMaterial[], seconds: number): void {
  for (const material of materials) {
    const uniform = material.uniforms.uTime;
    if (uniform) uniform.value = seconds;
  }
}

/** Buffer geometry with flat facets (non-indexed) — the drawn Tusche look. */
export function buildFlatGeometry(data: PlanetMeshData): THREE.BufferGeometry {
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  indexed.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
  indexed.setIndex(new THREE.BufferAttribute(data.indices, 1));
  const flat = indexed.toNonIndexed();
  indexed.dispose();
  flat.computeVertexNormals();
  ensureAnimAttribute(flat);
  return flat;
}

/** ShaderMaterial requires every declared attribute — default aAnim to zeros. */
export function ensureAnimAttribute(geometry: THREE.BufferGeometry): void {
  if (!geometry.getAttribute("aAnim")) {
    const count = geometry.getAttribute("position").count;
    geometry.setAttribute("aAnim", new THREE.BufferAttribute(new Float32Array(count * 4), 4));
  }
}

export interface InkMeshGroup {
  group: THREE.Group;
  fill: THREE.Mesh;
  outline: THREE.Mesh;
  dispose(): void;
}

/** Fill + outline pair sharing one geometry. */
export function buildInkMeshGroup(
  geometry: THREE.BufferGeometry,
  options: InkMaterialOptions & { outlineWidth: number },
): InkMeshGroup {
  const fillMaterial = createInkMaterial(options);
  const outlineMaterial = createOutlineMaterial(options.outlineWidth);
  const fill = new THREE.Mesh(geometry, fillMaterial);
  const outline = new THREE.Mesh(geometry, outlineMaterial);
  const group = new THREE.Group();
  group.add(outline);
  group.add(fill);
  return {
    group,
    fill,
    outline,
    dispose() {
      geometry.dispose();
      fillMaterial.dispose();
      outlineMaterial.dispose();
    },
  };
}
