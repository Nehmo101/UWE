import { sampleElevation, type ElevationGrid } from "@uwe/atlas/elevation";
import * as THREE from "three";

import { SpriteAtlasAllocator } from "./sprite-atlas";
import type { Atlas3DHooks, Atlas3DObject } from "./types";

const MAX_INSTANCES = 2048;
const ATLAS_CELLS = 8;
const ATLAS_SIZE = 1024;

function objectKey(object: Atlas3DObject): string {
  return String(object.style?.gouache ?? object.paletteItemId ?? object.glyphKey ?? object.id ?? object._key ?? "object");
}

function objectId(object: Atlas3DObject): string {
  return String(object._key ?? object.id ?? objectKey(object));
}

export class BillboardLayer {
  readonly mesh: THREE.InstancedMesh;
  private readonly atlas = document.createElement("canvas");
  private readonly texture: THREE.CanvasTexture;
  private readonly allocator = new SpriteAtlasAllocator(ATLAS_CELLS, ATLAS_CELLS);
  private readonly uvRects = new Float32Array(MAX_INSTANCES * 4);
  private readonly scales = new Float32Array(MAX_INSTANCES);
  private readonly selected = new Float32Array(MAX_INSTANCES);
  private objects: readonly Atlas3DObject[] = [];
  private selection = new Set<string>();

  constructor(private readonly hooks: Atlas3DHooks, private readonly heightScale: number) {
    this.atlas.width = ATLAS_SIZE;
    this.atlas.height = ATLAS_SIZE;
    this.texture = new THREE.CanvasTexture(this.atlas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.needsUpdate = true;

    const baseGeometry = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setIndex(baseGeometry.index);
    geometry.setAttribute("position", baseGeometry.getAttribute("position"));
    geometry.setAttribute("normal", baseGeometry.getAttribute("normal"));
    geometry.setAttribute("uv", baseGeometry.getAttribute("uv"));
    baseGeometry.dispose();
    geometry.setAttribute("instanceUvRect", new THREE.InstancedBufferAttribute(this.uvRects, 4));
    geometry.setAttribute("instanceScale", new THREE.InstancedBufferAttribute(this.scales, 1));
    geometry.setAttribute("instanceSelected", new THREE.InstancedBufferAttribute(this.selected, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { atlasMap: { value: this.texture } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        attribute vec4 instanceUvRect;
        attribute float instanceScale;
        attribute float instanceSelected;
        varying vec2 vUv;
        varying float vSelected;
        void main() {
          vUv = instanceUvRect.xy + uv * instanceUvRect.zw;
          vSelected = instanceSelected;
          vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          centre.xy += position.xy * instanceScale;
          gl_Position = projectionMatrix * centre;
        }
      `,
      fragmentShader: `
        uniform sampler2D atlasMap;
        varying vec2 vUv;
        varying float vSelected;
        void main() {
          vec4 colour = texture2D(atlasMap, vUv);
          if (colour.a < 0.03) discard;
          colour.rgb = mix(colour.rgb, vec3(1.0, 0.45, 0.12), vSelected * 0.52);
          gl_FragColor = colour;
        }
      `,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  sync(objects: readonly Atlas3DObject[], grid: ElevationGrid, worldWidth: number, worldDepth: number): void {
    this.objects = objects.slice(0, MAX_INSTANCES);
    const context = this.atlas.getContext("2d");
    if (!context) return;
    const drawn = new Set<string>();
    const matrix = new THREE.Matrix4();
    const cellSize = ATLAS_SIZE / ATLAS_CELLS;

    this.objects.forEach((object, index) => {
      const key = objectKey(object);
      const slot = this.allocator.allocate(key);
      if (!slot) return;
      if (!drawn.has(key)) {
        drawn.add(key);
        const x = slot.column * cellSize;
        const y = slot.row * cellSize;
        context.clearRect(x, y, cellSize, cellSize);
        if (this.hooks.drawObjectSprite) {
          this.hooks.drawObjectSprite(context, object, x + cellSize / 2, y + cellSize * 0.7, cellSize * 0.72);
        } else {
          context.fillStyle = "#3b2b1d";
          context.beginPath();
          context.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.18, 0, Math.PI * 2);
          context.fill();
        }
      }
      const elevation = sampleElevation(grid, object.x, object.y) + Math.max(0, Number(object.style?.elevation ?? 0));
      matrix.makeTranslation(
        (object.x - 0.5) * worldWidth,
        elevation * this.heightScale + 0.055 * (object.scale ?? 1),
        (object.y - 0.5) * worldDepth,
      );
      this.mesh.setMatrixAt(index, matrix);
      this.uvRects.set([slot.u, slot.v, slot.width, slot.height], index * 4);
      this.scales[index] = 0.13 * Math.max(0.2, object.scale ?? 1);
      this.selected[index] = this.selection.has(objectId(object)) ? 1 : 0;
    });
    this.mesh.count = this.objects.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    for (const name of ["instanceUvRect", "instanceScale", "instanceSelected"]) {
      (this.mesh.geometry.getAttribute(name) as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
    this.texture.needsUpdate = true;
  }

  setSelection(keys: readonly string[]): void {
    this.selection = new Set(keys);
    this.objects.forEach((object, index) => {
      this.selected[index] = this.selection.has(objectId(object)) ? 1 : 0;
    });
    (this.mesh.geometry.getAttribute("instanceSelected") as THREE.InstancedBufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    const materials = Array.isArray(this.mesh.material) ? this.mesh.material : [this.mesh.material];
    for (const material of materials) material.dispose();
  }
}
