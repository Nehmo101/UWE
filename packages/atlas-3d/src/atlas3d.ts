import { sampleElevation } from "@uwe/atlas/elevation";

import { BillboardLayer } from "./billboards";
import { createOrbitState, effectiveZoom, reduceOrbit, screenRay, worldToScreen, type OrbitCameraState } from "./camera-math";
import { OrbitControlsBridge } from "./controls";
import { GroundTextureBaker } from "./ground-texture";
import { OverlayLayer, type Atlas3DPreview } from "./overlays";
import { raycastHeightfield } from "./picking";
import { AtlasScene } from "./scene";
import type { Atlas3DHooks, Atlas3DOptions } from "./types";

export interface Atlas3D {
  screenToWorldN(x: number, y: number): [number, number] | null;
  worldNToScreen(x: number, y: number): [number, number] | null;
  effectiveZoom(): number;
  invalidate(): void;
  invalidateGround(immediate?: boolean): void;
  updateHeights(): void;
  syncObjects(): void;
  setSelection(keys: readonly string[]): void;
  setPreview(preview: Atlas3DPreview | null): void;
  resize(): void;
  destroy(): void;
}

export function createAtlas3D(canvas: HTMLCanvasElement, hooks: Atlas3DHooks, options: Atlas3DOptions = {}): Atlas3D {
  const worldWidth = options.worldWidth ?? 2;
  const worldDepth = options.worldDepth ?? 1.25;
  const heightScale = options.heightScale ?? 0.45;
  const scene = new AtlasScene(canvas, hooks.getGrid(), { worldWidth, worldDepth, heightScale });
  const billboards = new BillboardLayer(hooks, heightScale);
  const overlays = new OverlayLayer();
  scene.scene.add(billboards.mesh, overlays.group);
  let cameraState = createOrbitState({ pitch: options.initialPitch ?? 52 });

  const applyCamera = (next: OrbitCameraState): void => {
    cameraState = next;
    scene.setCamera(cameraState);
    hooks.onCameraChange?.();
  };
  const controls = new OrbitControlsBridge(canvas, () => cameraState, applyCamera, options.leftPan !== false);
  const baker = new GroundTextureBaker(hooks, options.groundBakeSize ?? 2048, (source) => scene.setGroundTexture(source));

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    cameraState = reduceOrbit(cameraState, { type: "resize", aspect: width / height });
    scene.resize(width, height);
    scene.setCamera(cameraState);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  scene.setLightDirection(hooks.getLightDirection?.());
  baker.invalidate(true);

  const api: Atlas3D = {
    screenToWorldN(x, y) {
      const rect = canvas.getBoundingClientRect();
      const ray = screenRay(cameraState, [x, y], [rect.width, rect.height]);
      return raycastHeightfield(ray, hooks.getGrid(), { worldWidth, worldDepth, heightScale });
    },
    worldNToScreen(x, y) {
      const rect = canvas.getBoundingClientRect();
      return worldToScreen(
        cameraState,
        [(x - 0.5) * worldWidth, sampleElevation(hooks.getGrid(), x, y) * heightScale, (y - 0.5) * worldDepth],
        [rect.width, rect.height],
      );
    },
    effectiveZoom() {
      return effectiveZoom(cameraState, canvas.getBoundingClientRect().height, 1280, worldDepth);
    },
    invalidate: () => scene.invalidate(),
    invalidateGround: (immediate = false) => baker.invalidate(immediate),
    updateHeights() {
      scene.updateHeights(hooks.getGrid());
      scene.setLightDirection(hooks.getLightDirection?.());
      api.syncObjects();
    },
    syncObjects() {
      billboards.sync(hooks.getObjects(), hooks.getGrid(), worldWidth, worldDepth);
      scene.invalidate();
    },
    setSelection(keys) {
      billboards.setSelection(keys);
      scene.invalidate();
    },
    setPreview(preview) {
      overlays.setPreview(preview, (x, y) => sampleElevation(hooks.getGrid(), x, y) * heightScale, worldWidth, worldDepth);
      scene.invalidate();
    },
    resize,
    destroy() {
      observer.disconnect();
      controls.dispose();
      baker.dispose();
      billboards.dispose();
      overlays.dispose();
      scene.dispose();
    },
  };
  api.syncObjects();
  return api;
}
