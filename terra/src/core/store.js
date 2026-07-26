import * as THREE from 'three';
// Weltkonstanten und der explizite globale Zustand (statt loser Globals).

export const MAP = 256;                  // Kacheln pro Achse
export const VW = MAP + 1;               // Vertices pro Achse
export const HALF = MAP / 2;
export const WATER = 0;                  // Wasserspiegel
export const VINE_R = 6;                 // globaler Rankenradius am Fuss - Massstabsanker
export const COS40 = Math.cos(40 * Math.PI / 180);
export const MAX_INST_PER_EL = 24000;    // Sicherheitsnetz je Element

/** Zentraler Zustand: Elemente, Seed, Raster, Biom. */
export const S = {
  worldSeed: 1337,
  elements: [],
  nextId: 1,
  elementSeedCounter: 0x1234,
  snap: false,
  biom: "wiese"
};

/* ==========================================================================
   Biom-Registry (G5). Ein Eintrag je Biom mit drei Bloecken:

   terrain — komplette Palette + Schwellen fuer terrainColor (world/terrain.js).
     Der Eintrag "wiese" enthaelt EXAKT die bisherigen Farbkonstanten und
     Schwellwerte aus terrain.js; der Default-Pfad bleibt dadurch
     byteidentisch zur alten Faerbung. Schluessel:
       grasKuehl/grasWarm/grasTrocken  drei Grundtoene der Flaeche
       erde, fels, schnee, sand        Zonenfarben (Hoehe/Hang)
       seegrund, tiefe, tritt, brandung
       driftGelb/driftBlau             F2-Farbdrift-Pole
       sandA/sandB, felsA/felsB, schneeA/schneeB   sstep-Kanten der Zonen
       saumSand/saumFels/saumSchnee    Zentren des dunklen Grenzsaums
       oase (0..1) + oaseFarbe         nur wueste: Graugruen in Senken (h<~2)

   veg — Multiplikatoren fuer die Bestueckung (generators/areas.js):
       dichte      Annahme-Wahrscheinlichkeit je Kandidat (1 = alles wie bisher)
       blumen      Faktor auf p.blumen in genWiese
       unterwuchs  Faktor auf die Unterholz-Wahrscheinlichkeit in genWald
       arten       Behalte-Wahrscheinlichkeit je Baumart (fehlende Art = 1);
                   null = keine Umgewichtung
       ersatz      Baumart, die abgelehnte Kandidaten ortsstabil ersetzt
                   (statt Luecke); null = Ablehnung laesst die Zelle leer
       uwTabelle   eigene wpick-Tabelle fuer den Unterwuchs; null = Standard
     Im wiese-Pfad sind alle Faktoren 1 bzw. null — byteidentisch.

   wasserTint — [r,g,b]-Multiplikator auf die Tageszeit-Wasserfarbe.
     BEWUSST INERT in dieser Runde: water.js/atmosphere.js sind tabu. Die
     Anbindung zieht der Orchestrator nach: in atmosphere.js direkt nach
     `mixHex(a.wasser, b.wasser, e, waterMat.color);` den Tint auf
     waterMat.color multiplizieren. Bis dahin liest kein Modul dieses Feld.
   ========================================================================== */
function farbe(hex) { return new THREE.Color(hex); }

export const BIOME = {
  wiese: {
    label: "Wiese",
    terrain: {
      grasKuehl: farbe(0x8ea86a), grasWarm: farbe(0xa8b877), grasTrocken: farbe(0xbcbd8a),
      erde: farbe(0x9d8560), fels: farbe(0xa9a99f), schnee: farbe(0xf4f6f8),
      sand: farbe(0xdfd0ab), seegrund: farbe(0xd2c6a2), tiefe: farbe(0x1f4750),
      tritt: farbe(0x8a7554), brandung: farbe(0xf2f6f4),
      driftGelb: farbe(0xb2b56e), driftBlau: farbe(0x82a87c),
      sandA: 2.0, sandB: 1.0, saumSand: 1.5,
      felsA: 12.6, felsB: 14.1, saumFels: 13.3,
      schneeA: 23, schneeB: 25, saumSchnee: 24,
      oase: 0, oaseFarbe: null
    },
    veg: { dichte: 1, blumen: 1, unterwuchs: 1, arten: null, ersatz: null, uwTabelle: null },
    wasserTint: [1, 1, 1]
  },
  wueste: {
    label: "Wüste",
    terrain: {
      // Grundton warmer, entsaettigter Sand statt Gras; Fels roetlich.
      grasKuehl: farbe(0xb89e70), grasWarm: farbe(0xc2a878), grasTrocken: farbe(0xcdb488),
      erde: farbe(0xa08058), fels: farbe(0xa0785c), schnee: farbe(0xf4f6f8),
      sand: farbe(0xe3d4ae), seegrund: farbe(0xd2c6a2), tiefe: farbe(0x1f4750),
      tritt: farbe(0x9a8258), brandung: farbe(0xf2f6f4),
      driftGelb: farbe(0xcbb075), driftBlau: farbe(0xab9f82),
      sandA: 2.4, sandB: 1.0, saumSand: 1.7,
      felsA: 12.6, felsB: 14.1, saumFels: 13.3,
      schneeA: 32, schneeB: 35, saumSchnee: 33.5,   // praktisch nie erreicht
      oase: 0.65, oaseFarbe: farbe(0x6d7f54)        // Graugruen nur in Senken
    },
    veg: {
      dichte: 0.35, blumen: 0.15, unterwuchs: 0.5,
      arten: { baum: 0.2, baum2: 0.2, bluetenbaum: 0.1, sumpfbaum: 0 },
      ersatz: "zypresse",
      uwTabelle: [["busch", 4], ["farn", 1], ["moos", 1], ["stumpf", 1],
        ["stammliegend", 1], ["fels", 5]]
    },
    wasserTint: [1, 1, 1]
  },
  kueste: {
    label: "Küste",
    terrain: {
      // Wie wiese, aber deutlich breiteres, helleres Strandband und grauer Fels.
      grasKuehl: farbe(0x8ea86a), grasWarm: farbe(0xa8b877), grasTrocken: farbe(0xbcbd8a),
      erde: farbe(0x9d8560), fels: farbe(0x9c9fa0), schnee: farbe(0xf4f6f8),
      sand: farbe(0xd8c9a2), seegrund: farbe(0xd2c6a2), tiefe: farbe(0x1f4750),
      tritt: farbe(0x8a7554), brandung: farbe(0xf2f6f4),
      driftGelb: farbe(0xb2b56e), driftBlau: farbe(0x82a87c),
      sandA: 3.8, sandB: 0.6, saumSand: 2.2,
      felsA: 12.6, felsB: 14.1, saumFels: 13.3,
      schneeA: 23, schneeB: 25, saumSchnee: 24,
      oase: 0, oaseFarbe: null
    },
    veg: { dichte: 1, blumen: 1, unterwuchs: 1, arten: null, ersatz: null, uwTabelle: null },
    wasserTint: [1.02, 1.12, 1.02]   // Richtung Tuerkis (#3fa3ad aus 0x3f93ad)
  },
  sumpf: {
    label: "Sumpf",
    terrain: {
      // Dunkles, blaugruenes Gras; Erde fast schwarzbraun; breite nasse Uferzone.
      grasKuehl: farbe(0x55684c), grasWarm: farbe(0x5c7050), grasTrocken: farbe(0x6b7a5c),
      erde: farbe(0x4a4038), fels: farbe(0x767468), schnee: farbe(0xf4f6f8),
      sand: farbe(0x6f6852), seegrund: farbe(0x55584a), tiefe: farbe(0x2a352c),
      tritt: farbe(0x4e453a), brandung: farbe(0xaab4a6),
      driftGelb: farbe(0x6c7452), driftBlau: farbe(0x4c665c),
      sandA: 3.2, sandB: 0.4, saumSand: 1.8,
      felsA: 12.6, felsB: 14.1, saumFels: 13.3,
      schneeA: 32, schneeB: 35, saumSchnee: 33.5,
      oase: 0, oaseFarbe: null
    },
    veg: {
      dichte: 1, blumen: 0.5, unterwuchs: 1.35,
      arten: { baum: 0.3, baum2: 0.3, nadelbaum: 0.55, bluetenbaum: 0.35 },
      ersatz: "sumpfbaum",
      uwTabelle: [["busch", 3], ["farn", 7], ["moos", 6], ["stumpf", 2],
        ["stammliegend", 2], ["fels", 1]]
    },
    wasserTint: [0.9, 0.5, 0.35]     // Richtung dunkles #3a4a3c
  },
  schnee: {
    label: "Schnee",
    terrain: {
      // Kaltes Graugruen unten, Weiss/Blauweiss ab ~4; Steilhang-Fels bricht
      // durch, weil der Hang-Fels NACH dem Schnee-Lerp aufgetragen wird.
      grasKuehl: farbe(0x7c8a76), grasWarm: farbe(0x8a9480), grasTrocken: farbe(0x99a08e),
      erde: farbe(0x6e685e), fels: farbe(0x8b9298), schnee: farbe(0xe8edf2),
      sand: farbe(0xccd2d4), seegrund: farbe(0xb6c0c4), tiefe: farbe(0x22404e),
      tritt: farbe(0x7c807a), brandung: farbe(0xeef3f6),
      driftGelb: farbe(0x9aa189), driftBlau: farbe(0x84929a),
      sandA: 2.0, sandB: 1.0, saumSand: 1.5,
      felsA: 12.6, felsB: 14.1, saumFels: 13.3,
      schneeA: 3.5, schneeB: 5.5, saumSchnee: 4.5,
      oase: 0, oaseFarbe: null
    },
    veg: {
      dichte: 0.6, blumen: 0.1, unterwuchs: 0.7,
      arten: { baum: 0.25, baum2: 0.25, bluetenbaum: 0.1, sumpfbaum: 0.1, zypresse: 0.4 },
      ersatz: "nadelbaum",
      uwTabelle: [["busch", 3], ["farn", 1], ["moos", 4], ["stumpf", 2],
        ["stammliegend", 2], ["fels", 4]]
    },
    wasserTint: [0.85, 0.95, 1.05]   // stahlblau, kuehl entsaettigt
  }
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

