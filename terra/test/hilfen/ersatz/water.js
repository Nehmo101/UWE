/* Ersatz fuer world/water.js — Wasserebene, Meeresboden, Schaumstreifen.
   Reines Rendering (haengt an camera.js und den Uniforms der Bruchmaske);
   io.js ruft davon nur wasserNeuBauen() nach einem Wechsel der Kartengroesse. */
import * as THREE from 'three';

export const water = new THREE.Mesh();
export const waterMat = new THREE.MeshBasicMaterial();
export const seabed = new THREE.Mesh();
export const aufrufe = { wasserNeuBauen: 0 };

export function initWater() {}
export function wasserSichtbar() { return true; }
export function updateWater() {}
export function wasserNeuBauen() { aufrufe.wasserNeuBauen++; }
export function setStreifen() {}
