/* Ersatz fuer editor/camera.js. Der echte Kamerablock daempft gegen die
   Bildrate, raycastet gegen das Terrain und haengt am DOM. Gebraucht wird
   davon nur der ZUSTAND: io.js schreibt beim Laden die gespeicherten Werte
   hinein und liest sie beim Speichern wieder aus. Genau diesen Zustand bildet
   der Ersatz nach — damit bleibt die Kamerapruefung (NaN darf nichts
   veraendern) aussagekraeftig. */
import * as THREE from 'three';

export const cam = {
  focus: new THREE.Vector3(0, 0, 0),
  tFocus: new THREE.Vector3(0, 0, 0),
  dist: 120, tDist: 120,
  yaw: 0.6, tYaw: 0.6,
  pitch: -0.7, tPitch: -0.7
};
export const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 4000);
export const raycaster = new THREE.Raycaster();
export const _ndc = new THREE.Vector2();
export const AUFNAHME_VORGABE = { fov: 32 };

let aufnahme = false;
export function setAufnahme(an) { aufnahme = !!an; }
export function istAufnahme() { return aufnahme; }
export function updateCamera() {
  cam.focus.copy(cam.tFocus);
  cam.dist = cam.tDist; cam.yaw = cam.tYaw; cam.pitch = cam.tPitch;
}
export function zoomT() { return 0; }
export function autoPitch() { return cam.tPitch; }
export function moveFocus() {}
export function fokusGrenze() { return 168; }
export function rayFrom() { return null; }
export function rayTerrain() { return null; }
export function rayPlane() { return null; }
export function groundPoint() { return null; }
export function aufnahmeAufMotiv() {}
export function aufnahmeNdc() { return _ndc; }
export function horizontPitch() { return 0; }
export function halbwinkel() { return 0.3; }
