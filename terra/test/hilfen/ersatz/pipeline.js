/* Ersatz fuer render/pipeline.js — WebGL-Renderer, Composer, PNG-Export.
   In Node gibt es keinen GL-Kontext. Die Setter/Getter fuer Farbskript,
   Palette, Malschicht und Multiplane sind hier ZUSTANDSTRAGEND nachgebaut,
   weil editor/io.js sie beim Speichern liest und beim Laden schreibt: nur so
   ist der Speicher-Lade-Zyklus (Ebene 2) eine echte Aussage. Die Standardwerte
   entsprechen dem abgeschalteten Zweig (staerke 0), genau wie im Original. */
import * as THREE from 'three';

export const scene = new THREE.Scene();
export const aufrufe = { renderFrame: 0, exportPNG: 0, setLook: 0 };

let farbskript = { licht: 0xffffff, mitte: 0xffffff, schatten: 0xffffff, staerke: 0 };
let palette = { farben: [], staerke: 0 };
let malschicht = { staerke: 0 };
let multiplane = { staerke: 0 };
let papierkante = { staerke: 0 };
let post = true;

export const PALETTE_STANDARD = { farben: [], staerke: 0 };
export const MAL_DEZENT = { staerke: 0 };

export function initPipeline() {}
export function resizePipeline() {}
export function setLook() { aufrufe.setLook++; }
export function setPost(an) { post = !!an; }
export function getPost() { return post; }
export function renderFrame() { aufrufe.renderFrame++; }
export function getRenderInfo() { return { calls: 0, triangles: 0 }; }
export function exportPNG() { aufrufe.exportPNG++; }
export function getRenderer() { return null; }

export function setFarbskript(s) {
  farbskript = s
    ? { licht: s.licht, mitte: s.mitte, schatten: s.schatten, staerke: s.staerke }
    : { licht: 0xffffff, mitte: 0xffffff, schatten: 0xffffff, staerke: 0 };
}
export function getFarbskript() { return Object.assign({}, farbskript); }
export function setPapierkante(p) { papierkante = p || { staerke: 0 }; }
export function getPapierkante() { return Object.assign({}, papierkante); }
export function setPalette(farben, staerke, ganz) {
  if (ganz && Array.isArray(ganz.farben)) palette = { farben: ganz.farben.slice(), staerke: ganz.staerke || 0 };
  else palette = { farben: Array.isArray(farben) ? farben.slice() : [], staerke: staerke || 0 };
}
export function getPalette() { return { farben: palette.farben.slice(), staerke: palette.staerke }; }
export function setMalschicht(m) { malschicht = m ? Object.assign({}, m) : { staerke: 0 }; }
export function getMalschicht() { return Object.assign({}, malschicht); }
export function setMultiplane(m) { multiplane = m ? Object.assign({}, m) : { staerke: 0 }; }
export function getMultiplane() { return Object.assign({}, multiplane); }
