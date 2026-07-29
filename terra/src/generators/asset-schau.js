/*
 * Vollstaendige, deterministische Galerie aller physischen Pool-Assets.
 *
 * Die normale Objektplatzierung prueft Biom, Hang, Kollision und Massstab.
 * Eine Asset-Schau braucht bewusst das Gegenteil: genau eine Instanz jedes
 * physischen Pools, auch wenn das Objekt semantisch nicht an diesen Ort
 * gehoert. Darum schreibt `setzeAssetSchauInstanzen` den bestehenden
 * 12-Zahlen-Instanzvertrag direkt, statt 505 Sonderfaelle durch die normalen
 * Generatoren zu schicken. Kartenzeichen (`sig_*`) bleiben ausgeschlossen.
 */
import { POOLS, markDirty, schattenAn } from '../core/pools.js';
import { S, mkElement } from '../core/store.js';
import {
  ARCHITEKTUR_ASSETS,
  ARCHITEKTUR_ASSET_NAMEN,
  ARCHITEKTUR_STILE,
  ARCHITEKTUR_VARIANTEN
} from '../assets/architektur-katalog.js';

export const ASSET_SCHAU_ERWARTETE_POOLS = 505;
export const ASSET_SCHAU_ARCHITEKTUR_ZEILEN = 12;
export const ASSET_SCHAU_ARCHITEKTUR_SPALTEN = 18;
export const ASSET_SCHAU_KARTENGROESSE = 512;

const SIG_PREFIX = 'sig_';
const PACK_BREITE = 448;
const ARCH_SCHRITT_X = 14;
const ARCH_SCHRITT_Z = 15;
const ZELLE = 12;
const BLOCK_ABSTAND = 10;
const BEREICH_ABSTAND = 24;
const VORNE = Math.PI * 0.07;

export const ASSET_SCHAU_FAMILIEN = Object.freeze([
  Object.freeze({ id: 'arbor', label: 'Arbor, Ranken und Wunderpflanzen' }),
  Object.freeze({ id: 'luftwelt', label: 'Luftschiffe, Flugzuege und Schwebearchipele' }),
  Object.freeze({ id: 'wasserwelt', label: 'Kuesten, Schiffe und Wasserbau' }),
  Object.freeze({ id: 'wehrbau', label: 'Burgen, Wehranlagen und Ruinen' }),
  Object.freeze({ id: 'landleben', label: 'Landwirtschaft und Tiere' }),
  Object.freeze({ id: 'natur', label: 'Baeume, Pflanzen und Pilze' }),
  Object.freeze({ id: 'geologie', label: 'Felsen, Eis und Naturmale' }),
  Object.freeze({ id: 'siedlung', label: 'Haeuser, Hallen und Heiligtuemer' }),
  Object.freeze({ id: 'infrastruktur', label: 'Bruecken, Wege und Versorgung' }),
  Object.freeze({ id: 'requisiten', label: 'Handwerk, Markt und Requisiten' })
]);

/* Die Regeln sind absichtlich grob und stabil. Neue Pools landen im
 * Requisitenblock, bis ihre Familie bewusst entschieden wird; sie gehen
 * dadurch niemals aus der Vollstaendigkeits-Schau verloren. */
const FAMILIEN_REGELN = Object.freeze([
  ['arbor', /^(?:arbor|blatt|elfen|lichtbluete|lichtsammler|ranken|saft|samen|sporen|wurzel)/],
  ['luftwelt', /^(?:luftinsel|luftschiff|luftzug)/],
  ['wasserwelt', /(?:aalreuse|anleger|bake|boje|boot|fischer|floss|hafen|helling|kai|kahn|kogge|kutter|leuchtfeuer|leuchtturm|moorsteg|netz|reuse|ruderschiff|schiff|slipbahn|steg$|tauhaufen|uferdamm|werft|wrack)/],
  ['wehrbau', /(?:barbakane|bastion|bergfried|burg|geschuetz|kettenturm|mauer|palisad|pechnase|ruine|schildmauer|schloss|torhaus|wachturm|wehr|zugbruecke|zwinger)/],
  ['landleben', /(?:acker|bienen|dresch|feld|garbe|garten|gerber|heu|hopfen|ochsen|pferch|pferd|reben|rind|salzgarten|schaf|scheune|tauben|torf|traenke|vieh|vogelscheuche|wollgras|ziege)/],
  ['natur', /(?:bambus|baum|blume|busch|farn|gras|koralle|moos|muschel|nadelbaum|obstbaum|palme|pilz|schilf|seerose|seetang|stamm|stumpf|sumpfbaum|treibholz|zypresse)/],
  ['geologie', /(?:basalt|bruchkante|eisfels|eisscholle|fels|gebein|geroell|geysir|gletscher|grabhuegel|lava|menhir|obelisk|opferstein|riss|sandwehe|saeulenstumpf|schlamm|schneewall|schwebefels|steinkreis|statuentorso|thermal|truemmer)/],
  ['siedlung', /(?:glashuette|haus|huette|iglu|industrie|kapelle|kathedral|kleinzelt|kuppel|lagerhaus|langhaus|pavillon|pelzzelt|schmiede|speicher|stollen|tempel|tholos|turm|villa|wohnblock|wuestenzelt|zwergenhalle)/],
  ['infrastruktur', /(?:aquaedukt|arkade|bogen|bruecke|durchfahrt|kanal|kaskaden|lattenzaun|leiter|pfosten|wassermuehle|wasserrad|windmuehle|windpumpe|zisterne)/]
]);

function familieFuer(name) {
  for (var i = 0; i < FAMILIEN_REGELN.length; i++) {
    if (FAMILIEN_REGELN[i][1].test(name)) return FAMILIEN_REGELN[i][0];
  }
  return 'requisiten';
}

function anzeigeSkala(pool) {
  var r = pool && Number.isFinite(pool.radius) ? pool.radius : 1;
  if (r < 0.35) return 3;
  if (r < 0.65) return 2.5;
  if (r < 1) return 1.9;
  if (r < 1.4) return 1.45;
  return 1;
}

function zellgroesseFuer(namen, registry) {
  var groesste = ZELLE;
  for (var i = 0; i < namen.length; i++) {
    var pool = registry[namen[i]];
    var durchmesser = pool.radius * anzeigeSkala(pool) * 2 + 2;
    groesste = Math.max(groesste, Math.ceil(durchmesser * 2) / 2);
  }
  return groesste;
}

function physischeNamen(registry) {
  return Object.keys(registry).filter(function (name) {
    return name.indexOf(SIG_PREFIX) !== 0;
  }).sort();
}

function verschiebePunkt(p, dx, dz) {
  p.x += dx;
  p.z += dz;
  return p;
}

function blockGrenzen(block, dx, dz) {
  block.minX += dx;
  block.maxX += dx;
  block.minZ += dz;
  block.maxZ += dz;
  verschiebePunkt(block.labelPosition, dx, dz);
}

function berechneBounds(platzierungen, registry) {
  var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (var i = 0; i < platzierungen.length; i++) {
    var p = platzierungen[i];
    var radius = registry[p.name].radius * p.scale;
    minX = Math.min(minX, p.x - radius);
    maxX = Math.max(maxX, p.x + radius);
    minZ = Math.min(minZ, p.z - radius);
    maxZ = Math.max(maxZ, p.z + radius);
  }
  return Object.freeze({
    minX, maxX, minZ, maxZ,
    width: maxX - minX,
    depth: maxZ - minZ,
    centerX: (minX + maxX) * 0.5,
    centerZ: (minZ + maxZ) * 0.5
  });
}

/**
 * Reine Layoutfunktion. Sie liest die Registry, erzeugt aber weder Elemente
 * noch Meshes. Das Ergebnis eignet sich deshalb auch fuer Kameraframing,
 * Beschriftung und Tests.
 */
export function baueAssetSchauLayout(registry) {
  registry = registry || POOLS;
  var alle = physischeNamen(registry);
  if (alle.length !== ASSET_SCHAU_ERWARTETE_POOLS) {
    throw new Error('Asset-Schau erwartet ' + ASSET_SCHAU_ERWARTETE_POOLS
      + ' physische Pools, Registry liefert ' + alle.length);
  }

  var archNamen = ARCHITEKTUR_ASSET_NAMEN.filter(function (name) {
    return !!registry[name];
  });
  if (ARCHITEKTUR_STILE.length !== ASSET_SCHAU_ARCHITEKTUR_ZEILEN ||
      ARCHITEKTUR_VARIANTEN.length !== ASSET_SCHAU_ARCHITEKTUR_SPALTEN ||
      archNamen.length !== 216) {
    throw new Error('Architekturblock verletzt den stabilen 12x18-Vertrag');
  }

  var archSet = new Set(archNamen);
  var platzierungen = [];
  var bloecke = [];
  var archBreite = ASSET_SCHAU_ARCHITEKTUR_SPALTEN * ARCH_SCHRITT_X;
  var archTiefe = ASSET_SCHAU_ARCHITEKTUR_ZEILEN * ARCH_SCHRITT_Z;
  var archX = (PACK_BREITE - archBreite) * 0.5;

  for (var a = 0; a < ARCHITEKTUR_ASSETS.length; a++) {
    var asset = ARCHITEKTUR_ASSETS[a];
    var pool = registry[asset.id];
    platzierungen.push({
      name: asset.id,
      family: 'architektur',
      blockId: 'architektur',
      row: asset.stilIndex,
      column: asset.variantenIndex,
      x: archX + ARCH_SCHRITT_X * (asset.variantenIndex + 0.5),
      y: 0,
      z: ARCH_SCHRITT_Z * (asset.stilIndex + 0.5),
      yaw: VORNE,
      scale: anzeigeSkala(pool),
      label: asset.label
    });
  }
  bloecke.push({
    id: 'architektur',
    label: 'Architektur 12 x 18',
    rows: ASSET_SCHAU_ARCHITEKTUR_ZEILEN,
    columns: ASSET_SCHAU_ARCHITEKTUR_SPALTEN,
    count: 216,
    minX: archX,
    maxX: archX + archBreite,
    minZ: 0,
    maxZ: archTiefe,
    labelPosition: { x: PACK_BREITE * 0.5, z: -6 }
  });

  var gruppen = Object.fromEntries(ASSET_SCHAU_FAMILIEN.map(function (f) {
    return [f.id, []];
  }));
  for (var n = 0; n < alle.length; n++) {
    if (!archSet.has(alle[n])) gruppen[familieFuer(alle[n])].push(alle[n]);
  }
  for (var f = 0; f < ASSET_SCHAU_FAMILIEN.length; f++) {
    gruppen[ASSET_SCHAU_FAMILIEN[f].id].sort();
  }

  var cursorX = 0;
  var cursorZ = archTiefe + BEREICH_ABSTAND;
  var reihenTiefe = 0;
  for (var fi = 0; fi < ASSET_SCHAU_FAMILIEN.length; fi++) {
    var familie = ASSET_SCHAU_FAMILIEN[fi];
    var namen = gruppen[familie.id];
    if (!namen.length) continue;
    var spalten = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(namen.length * 1.45))));
    var zeilen = Math.ceil(namen.length / spalten);
    var zelle = zellgroesseFuer(namen, registry);
    var breite = spalten * zelle;
    var tiefe = zeilen * zelle;
    if (cursorX > 0 && cursorX + breite > PACK_BREITE) {
      cursorX = 0;
      cursorZ += reihenTiefe + BLOCK_ABSTAND;
      reihenTiefe = 0;
    }
    var block = {
      id: familie.id,
      label: familie.label,
      rows: zeilen,
      columns: spalten,
      count: namen.length,
      cellSize: zelle,
      minX: cursorX,
      maxX: cursorX + breite,
      minZ: cursorZ,
      maxZ: cursorZ + tiefe,
      labelPosition: { x: cursorX + breite * 0.5, z: cursorZ - 4 }
    };
    bloecke.push(block);

    for (var ni = 0; ni < namen.length; ni++) {
      var name = namen[ni];
      var row = Math.floor(ni / spalten);
      var column = ni % spalten;
      platzierungen.push({
        name,
        family: familie.id,
        blockId: familie.id,
        row,
        column,
        x: cursorX + zelle * (column + 0.5),
        y: 0,
        z: cursorZ + zelle * (row + 0.5),
        yaw: VORNE,
        scale: anzeigeSkala(registry[name]),
        label: name
      });
    }
    cursorX += breite + BLOCK_ABSTAND;
    reihenTiefe = Math.max(reihenTiefe, tiefe);
  }

  var gesamtTiefe = cursorZ + reihenTiefe;
  var dx = -PACK_BREITE * 0.5;
  var dz = -gesamtTiefe * 0.5;
  for (var pi = 0; pi < platzierungen.length; pi++) {
    verschiebePunkt(platzierungen[pi], dx, dz);
  }
  for (var bi = 0; bi < bloecke.length; bi++) blockGrenzen(bloecke[bi], dx, dz);
  /* Nicht jede Packzeile nutzt die volle Breite. Auf den tatsaechlichen
   * Geometrie-Bounds nachzentrieren, damit Kamera und 512er-Karte nicht fuer
   * einen leeren Rand bezahlen. */
  var vorBounds = berechneBounds(platzierungen, registry);
  dx = -vorBounds.centerX;
  dz = -vorBounds.centerZ;
  for (pi = 0; pi < platzierungen.length; pi++) {
    verschiebePunkt(platzierungen[pi], dx, dz);
  }
  for (bi = 0; bi < bloecke.length; bi++) blockGrenzen(bloecke[bi], dx, dz);

  return Object.freeze({
    version: 1,
    placements: Object.freeze(platzierungen.map(Object.freeze)),
    blocks: Object.freeze(bloecke.map(function (b) {
      Object.freeze(b.labelPosition);
      return Object.freeze(b);
    })),
    bounds: berechneBounds(platzierungen, registry),
    recommendedMapSize: ASSET_SCHAU_KARTENGROESSE,
    counts: Object.freeze({
      physical: platzierungen.length,
      architecture: archNamen.length,
      other: platzierungen.length - archNamen.length
    })
  });
}

function poolBodenOffset(pool, scale) {
  if (!pool.geo.boundingBox) pool.geo.computeBoundingBox();
  var minY = pool.geo.boundingBox && pool.geo.boundingBox.min.y;
  return Number.isFinite(minY) ? -minY * scale : 0;
}

/**
 * Schreibt jede Platzierung exakt einmal in ein Store-Element. `hoeheAn`
 * liefert optional den lokalen Boden; ohne Callback entsteht eine flache
 * Galerie auf y=0.
 */
export function setzeAssetSchauInstanzen(el, layout, optionen) {
  if (!el || !el.inst) throw new Error('Asset-Schau braucht ein Store-Element');
  layout = layout || baueAssetSchauLayout();
  optionen = optionen || {};
  var hoeheAn = typeof optionen.hoeheAn === 'function' ? optionen.hoeheAn : function () { return 0; };

  el.inst = {};
  el.schatten.length = 0;
  el.rauch.length = 0;
  el.total = 0;
  el.karteTotal = 0;
  for (var i = 0; i < layout.placements.length; i++) {
    var p = layout.placements[i];
    var pool = POOLS[p.name];
    if (!pool) throw new Error('Asset-Schau kennt Pool nicht: ' + p.name);
    if (el.inst[p.name]) throw new Error('Doppelte Asset-Schau-Instanz: ' + p.name);
    var boden = Number(hoeheAn(p.x, p.z, p));
    if (!Number.isFinite(boden)) throw new Error('Ungueltige Schauhoehe fuer ' + p.name);
    var y = boden + poolBodenOffset(pool, p.scale);
    el.inst[p.name] = [
      p.x, y, p.z,
      0, p.yaw, 0,
      p.scale, p.scale, p.scale,
      1, 1, 1
    ];
    var schattenRadius = pool.radius * p.scale;
    if (schattenRadius >= 0.6) {
      schattenAn(el, p.x, boden, p.z, Math.min(8, schattenRadius * 1.45));
    }
    el.total++;
  }
  el.assetSchau = {
    version: layout.version,
    blocks: layout.blocks,
    bounds: layout.bounds,
    counts: layout.counts
  };
  return el;
}

/**
 * Komforteinstieg fuer `?schau=assets`. Idempotent innerhalb eines laufenden
 * Stores: ein zweiter Aufruf gibt dasselbe Element zurueck und vergibt keine
 * doppelte Runtime-ID.
 */
export function erzeugeAssetSchau(optionen) {
  optionen = optionen || {};
  var einhaengen = optionen.einhaengen !== false;
  if (einhaengen) {
    for (var i = 0; i < S.elements.length; i++) {
      var vorhanden = S.elements[i];
      if (vorhanden.kind === 'objekt' && vorhanden.variant === 'asset-schau') {
        return { element: vorhanden, layout: vorhanden.assetSchauLayout,
          reused: true };
      }
    }
  }

  var layout = optionen.layout || baueAssetSchauLayout();
  var el = mkElement('objekt', 'asset-schau', [], {
    schau: 'assets',
    physical: layout.counts.physical
  }, Number.isFinite(optionen.seed) ? optionen.seed : 0x41535345);
  setzeAssetSchauInstanzen(el, layout, optionen);
  el.assetSchauLayout = layout;
  if (einhaengen) {
    S.elements.push(el);
    if (optionen.markiere !== false) {
      markDirty(layout.placements.map(function (p) { return p.name; }));
    }
  }
  return { element: el, layout, reused: false };
}

export function assetSchauPoolNamen(registry) {
  return Object.freeze(physischeNamen(registry || POOLS));
}
