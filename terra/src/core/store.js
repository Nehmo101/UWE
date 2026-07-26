import * as THREE from 'three';
// Weltkonstanten und der explizite globale Zustand (statt loser Globals).

export const MAP = 256;                  // Kacheln pro Achse
export const VW = MAP + 1;               // Vertices pro Achse
export const HALF = MAP / 2;
export const WATER = 0;                  // Wasserspiegel
export const VINE_R = 6;                 // globaler Rankenradius am Fuss - Massstabsanker
export const COS40 = Math.cos(40 * Math.PI / 180);
export const MAX_INST_PER_EL = 24000;    // Sicherheitsnetz je Element

/** Zentraler Zustand: Elemente, Seed, Raster. */
export const S = {
  worldSeed: 1337,
  elements: [],
  nextId: 1,
  elementSeedCounter: 0x1234,
  snap: false
};

/** Szene wird von main gesetzt; Module holen sie hier. */
export const sceneRef = { scene: null };
export function setScene(sc) { sceneRef.scene = sc; }

export function nextSeed() {
  S.elementSeedCounter = (S.elementSeedCounter + 0x9e3779b9) | 0;
  return S.elementSeedCounter;
}

export function mkElement(kind, variant, points, params, seed) {
  return {
    id: S.nextId++,
    kind: kind,             // pfad | flaeche | objekt | ranke
    variant: variant,
    points: points,         // [{x,z}]
    params: params,
    seed: seed,
    inst: {},               // Instanzdaten je Pool
    schatten: [],           // abgeleitete Kontaktschatten (nicht gespeichert)
    rauch: [],              // Schornsteinpositionen für den Rauch
    total: 0,
    group: null,            // eigene Meshes (Ranken, Flusswasser)
    streets: null           // Viertel: erzeugtes Wegenetz
  };
}

export function groupOf(el) {
  if (!el.group) { el.group = new THREE.Group(); sceneRef.scene.add(el.group); }
  return el.group;
}

export function clearElement(el) {
  el.inst = {};
  el.schatten.length = 0;
  el.rauch.length = 0;
  el.total = 0;
  if (el.group) {
    for (var i = el.group.children.length - 1; i >= 0; i--) {
      var c = el.group.children[i];
      if (c.geometry) c.geometry.dispose();
      // Materialien: alle Erzeuger von Element-Kind-Meshes (paths.js,
      // vines.js) nutzen geteilte Modul-Materialien (wegBandMat, flussMat,
      // vineMat, leafMat, rockMat) — die duerfen hier NICHT disposed werden,
      // sonst verlieren alle anderen Elemente ihr Material. Konvention:
      // nur Meshes mit userData.eigenesMaterial = true besitzen ein
      // exklusives Material und geben es hier frei. Das ist der einfachste
      // Weg, der garantiert kein geteiltes Material zerstoert.
      if (c.userData && c.userData.eigenesMaterial && c.material) {
        if (Array.isArray(c.material)) {
          for (var mi = 0; mi < c.material.length; mi++) c.material[mi].dispose();
        } else {
          c.material.dispose();
        }
      }
      el.group.remove(c);
    }
  }
}

export function dropElement(el) {
  clearElement(el);
  if (el.group) { sceneRef.scene.remove(el.group); el.group = null; }
  var i = S.elements.indexOf(el);
  if (i >= 0) S.elements.splice(i, 1);
}

export function serializeElements() {
  var out = [];
  for (var i = 0; i < S.elements.length; i++) {
    var e = S.elements[i];
    out.push({ id: e.id, kind: e.kind, variant: e.variant, points: e.points,
      params: e.params, seed: e.seed });
  }
  return out;
}

export function hydrate(list) {
  while (S.elements.length) dropElement(S.elements[0]);
  for (var i = 0; i < list.length; i++) {
    var d = list[i];
    var el = mkElement(d.kind, d.variant, d.points, d.params, d.seed);
    el.id = d.id || el.id;
    S.nextId = Math.max(S.nextId, el.id + 1);
    S.elements.push(el);
  }
}

