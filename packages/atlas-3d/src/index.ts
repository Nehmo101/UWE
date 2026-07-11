export { createAtlas3D, type Atlas3D } from "./atlas3d";
export { buildHeightfieldMesh, updateHeightsInPlace, type HeightfieldMeshData } from "./heightfield";
export {
  cameraPosition,
  clampPitch,
  createOrbitState,
  effectiveZoom,
  reduceOrbit,
  screenRay,
  worldToScreen,
  type OrbitAction,
  type OrbitCameraState,
  type Ray3,
} from "./camera-math";
export { raycastHeightfield } from "./picking";
export { SpriteAtlasAllocator, type SpriteSlot } from "./sprite-atlas";
export type { Atlas3DHooks, Atlas3DObject, Atlas3DOptions } from "./types";
export type { Atlas3DPreview } from "./overlays";
