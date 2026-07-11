import { lightDirectionSigns, type ElevationGrid } from "@uwe/atlas/elevation";
import * as THREE from "three";

import { cameraPosition, type OrbitCameraState } from "./camera-math";
import { buildHeightfieldMesh, updateHeightsInPlace, type HeightfieldMeshData } from "./heightfield";

export interface SceneOptions {
  worldWidth: number;
  worldDepth: number;
  heightScale: number;
}

export class AtlasScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.01, 50);
  readonly terrain: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly light = new THREE.DirectionalLight(0xfff3d2, 2.2);
  private readonly ambient = new THREE.HemisphereLight(0xfff8e5, 0x34281d, 1.35);
  private meshData: HeightfieldMeshData;
  private frame = 0;

  constructor(canvas: HTMLCanvasElement, grid: ElevationGrid, readonly options: SceneOptions) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0xd8ccae, 1);
    this.meshData = buildHeightfieldMesh(grid, options);
    const geometry = this.createGeometry(this.meshData);
    const material = new THREE.MeshStandardMaterial({ color: 0xf1e3c2, roughness: 0.91, metalness: 0 });
    this.terrain = new THREE.Mesh(geometry, material);
    this.terrain.receiveShadow = false;
    this.scene.add(this.terrain);

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(options.worldWidth * 1.08, options.worldDepth * 1.08),
      new THREE.MeshStandardMaterial({ color: 0x6f9fa8, roughness: 0.42, metalness: 0.05, transparent: true, opacity: 0.42 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.004;
    this.scene.add(water, this.light, this.ambient);
    this.scene.fog = new THREE.FogExp2(0xd8ccae, 0.055);
    this.light.position.set(-3, 5, -3);
  }

  private createGeometry(data: HeightfieldMeshData): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(data.uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geometry.computeBoundingSphere();
    return geometry;
  }

  setCamera(state: OrbitCameraState): void {
    const position = cameraPosition(state);
    this.camera.fov = state.fov;
    this.camera.aspect = state.aspect;
    this.camera.position.set(position[0], position[1], position[2]);
    this.camera.lookAt(state.target[0], state.target[1], state.target[2]);
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  resize(width: number, height: number, dpr = window.devicePixelRatio || 1): void {
    this.renderer.setPixelRatio(Math.min(2, dpr));
    this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    this.invalidate();
  }

  setLightDirection(direction: unknown): void {
    const [sx, sy] = lightDirectionSigns(direction);
    this.light.position.set(-3 * sx, 5, -3 * sy);
    this.invalidate();
  }

  setGroundTexture(source: HTMLCanvasElement | OffscreenCanvas): void {
    const texture = new THREE.CanvasTexture(source as HTMLCanvasElement);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
    const old = this.terrain.material.map;
    this.terrain.material.map = texture;
    this.terrain.material.color.set(0xffffff);
    this.terrain.material.needsUpdate = true;
    old?.dispose();
    this.invalidate();
  }

  updateHeights(grid: ElevationGrid): void {
    updateHeightsInPlace(this.meshData, grid);
    const positions = this.terrain.geometry.getAttribute("position") as THREE.BufferAttribute;
    const normals = this.terrain.geometry.getAttribute("normal") as THREE.BufferAttribute;
    positions.needsUpdate = true;
    normals.needsUpdate = true;
    this.terrain.geometry.computeBoundingSphere();
    this.invalidate();
  }

  replaceGrid(grid: ElevationGrid): void {
    this.meshData = buildHeightfieldMesh(grid, this.options);
    const old = this.terrain.geometry;
    this.terrain.geometry = this.createGeometry(this.meshData);
    old.dispose();
    this.invalidate();
  }

  invalidate(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderer.render(this.scene, this.camera);
    });
  }

  dispose(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.terrain.geometry.dispose();
    this.terrain.material.map?.dispose();
    this.terrain.material.dispose();
    this.renderer.dispose();
  }
}
