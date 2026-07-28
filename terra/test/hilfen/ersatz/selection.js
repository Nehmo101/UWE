/* Ersatz fuer editor/selection.js — Griffe, Marker-Stecknadeln und
   Auswahlrahmen sind Szenenobjekte und Mausarbeit; fuer Format- und
   Generatorpruefungen traegt davon nichts bei. Die Gruppen sind einfache
   Objekte mit `children`, damit Aufrufer sie wie Three-Gruppen behandeln
   koennen. */
import * as THREE from 'three';

export const preview = new THREE.Group();
export const handles = new THREE.Group();
export const brushRing = new THREE.Mesh();
export const markerGruppe = new THREE.Group();
export const auswahlRahmen = new THREE.Group();
export const aufrufe = { rebuildHandles: 0, rebuildMarker: 0, waehleMarker: 0 };
export let markerAuswahl = -1;

export function setPreview() {}
export function clearPreview() {}
export function rebuildHandles() { aufrufe.rebuildHandles++; }
export function updateHandlePositions() {}
export function updateBrushRing() {}
export function distToPolyline() { return Infinity; }
export function naechstesSegment() { return -1; }
export function pickElement() { return null; }
export function select() {}
export function auswahlUmschalten() {}
export function aktiverGriff() { return -1; }
export function setAktiverGriff() {}
export function zugGriffIndex() { return -1; }
export function zugGriffElement() { return null; }
export function zugpunktListe() { return []; }
export function rankeAchsenTreffer() { return null; }
export function zugPixelProHoehe() { return 1; }
export function rebuildMarker() { aufrufe.rebuildMarker++; }
export function updateMarkerPositions() {}
export function markerTreffer() { return -1; }
export function waehleMarker(i) { aufrufe.waehleMarker++; markerAuswahl = i; }
export function getMarkerAuswahl() { return markerAuswahl; }
export function rebuildAuswahlRahmen() {}
// I4/Runde H: der Beschriftungsabgleich ist Szenenarbeit — im Test ein Zaehler.
export function beschriftungenAktualisieren() { aufrufe.beschriftungenAktualisieren = (aufrufe.beschriftungenAktualisieren || 0) + 1; }
