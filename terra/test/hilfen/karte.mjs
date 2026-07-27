/* ==========================================================================
   Testkarte: eine geladene, betriebsbereite terra-Welt ohne Browser.

   `testWelt()` macht genau das, was main.js beim Start tut, minus Bild:
   Kartengroesse setzen, Basisterrain aus dem Seed erzeugen, Szene bereitstellen
   (core/store.js legt Element-Gruppen dort ab). Danach lassen sich Elemente
   anlegen und ueber core/dirty.js erzeugen — also auf demselben Weg wie im
   Editor, nicht ueber einen Nebeneingang in die einzelnen Generatoren.

   `hashElement()` fasst das VOLLSTAENDIGE Ergebnis eines Generatorlaufs
   zusammen:
     - el.inst      alle emit()-Argumente, Pool fuer Pool (12 Zahlen je Instanz)
     - el.schatten  die Kontaktschatten (7 Zahlen je Fleck)
     - el.rauch     Schornsteinpunkte
     - el.group     die eigenen Meshes (Wegband, Flusswasser, Rankenroehren)
                    mit ALLEN Geometrie-Attributen und dem Index
   Damit deckt ein einziger Hash beide Haelften der Determinismus-Zusage ab.
   ========================================================================== */
import { ladeGeneratoren } from './laden.mjs';
import { Hasher } from './hash.mjs';

/* Momentaufnahme der Vorgabewerte aus editor/tools.js (PARAMS[..].d).
   BEWUSST kopiert statt importiert: tools.js ist Bedienoberflaeche und wird
   parallel weiterentwickelt; ein Test, der seine Eingaben von dort bezieht,
   aendert sein Ergebnis, sobald jemand einen Regler verschiebt. Die Elemente
   der Tests tragen ihre Parameter deshalb VOLLSTAENDIG und aus eigener Quelle.
   Weicht diese Tabelle vom Schema ab, ist das kein Fehler — die Generatoren
   muessen mit jedem gueltigen Parametersatz deterministisch bleiben. */
export const STANDARDPARAMETER = {
  'pfad:strasse': { breite: 6, belag: 'erde', haeuser: true, stil: 'dorf', abstand: 14, streuung: 2 },
  'pfad:mauer': { hoehe: 1, dicke: 1.6, turmAbstand: 26, torAbstand: 0 },
  'pfad:fluss': { breite: 9, tiefe: 4 },
  'pfad:hecke': { stil: 'hecke', hoehe: 1 },
  'pfad:bruch': { tiefe: 90, breite: 6, zackigkeit: 0.5, seite: '1', wurzeln: true, truemmer: 2 },
  'flaeche:wald': { dichte: 1.1, klumpen: 0.55, mischung: 0.25, unterholz: 0.35 },
  'flaeche:feld': { drehung: 30, reihe: 3.2, hoehe: 1, frucht: 'weizen' },
  'flaeche:viertel': { netz: 'raster', block: 21, gasse: 3.5, drehung: 20, dichte: 1, stil: 'dorf' },
  'flaeche:wiese': { dichte: 1.2, blumen: 0.25 },
  'flaeche:burg': { mauerhoehe: 1, turmAbstand: 22, zwinger: false, palisade: false, dichte: 1 },
  'flaeche:werft': { hellingen: 2, kai: true, dichte: 1 },
  'flaeche:kloster': { groesse: 1, kirche: 'kapelle', garten: 0.5 },
  'objekt:*': { anzahl: 1, streuung: 4, groesse: 1, frei: false, nurTyp: '' },
  'objekt:inseln': { anzahl: 2, hoehe: 24, groesse: 1, streuung: 18, baeumchen: true },
  'ranke:ranke': {
    hoehe: 190, straenge: 4, dicke: 1, dickeOben: 0.45, stil: 'geflochten', steigung: 2.8,
    windungUnten: 0, windungOben: 0, kernzug: 0, blattgroesse: 1, plateaus: 3, plateau: 1,
    staedtchen: true, inseln: 2, luftwurzeln: false, stadtStil: '', stadtDichte: 1,
    stadtNetz: '', stadtRand: false, stadtBloecke: 20, treppe: false, bruecken: false,
    vereinigung: 0.35
  }
};

/** Vollstaendiger Parametersatz fuer kind:variant, optional ueberschrieben. */
export function parameterFuer(kind, variant, extra) {
  const genau = STANDARDPARAMETER[kind + ':' + variant];
  const stern = STANDARDPARAMETER[kind + ':*'];
  return Object.assign({}, stern || null, genau || null, extra || null);
}

/**
 * Baut eine betriebsbereite Welt auf.
 * @param {object} opt seed, biom, groesse (256/512/1024)
 */
export async function testWelt(opt) {
  const o = Object.assign({ seed: 1337, biom: 'wiese', groesse: 256 }, opt || null);
  const m = await ladeGeneratoren();
  const { S, setKartenGroesse, setScene, mkElement } = m.store;
  // Ueber den Loader-Haken, nicht direkt aus three-stub.mjs: so bekommt die
  // Szene dieselbe Herkunft wie die der terra-Module (siehe haken.mjs, das
  // 'three' wahlweise auf den Ersatz oder auf eine echte Datei legt).
  const THREE = await import('three');

  setScene(new THREE.Scene());
  setKartenGroesse(o.groesse);
  /* terrainGeometrienNeu() ist der Schritt, den editor/io.js nach jedem
     Groessenwechsel macht und der hier fehlte: er zieht die Felder auf die
     neue Kantenlaenge nach (felderSichern) und baut die Patches neu.

     Ohne ihn blieben bei `groesse: 512` oder `1024` die Felder auf der
     Laenge der zuletzt benutzten Karte stehen — genBase schreibt dann in ein
     zu kurzes Array, und der Rest bleibt uninitialisiert. Im Test sah das
     nicht nach einem Fehler aus, sondern nach NaN mitten im Hoehenfeld, und
     zwar nur in den Dateien, die eine groessere Karte anlegen. Gefunden
     wurde es beim Bau der Fluesse (Runde J). */
  m.terrain.terrainGeometrienNeu();
  S.worldSeed = o.seed;
  S.biom = o.biom;
  S.elements.length = 0;
  S.marker.length = 0;
  S.nextId = 1;
  S.elementSeedCounter = 0x1234;
  m.terrain.genBase(o.seed);
  // hgt aus base ableiten (ohne Flussstempel gibt es noch keine); erst danach
  // liefern heightAt/slopeAt/normalAt sinnvolle Werte.
  m.terrain.recomputeHeights(0, m.store.KARTE.vw - 1, 0, m.store.KARTE.vw - 1);
  m.terrain.computeAO(0, m.store.KARTE.vw - 1, 0, m.store.KARTE.vw - 1);

  const welt = {
    m,
    seed: o.seed,
    biom: o.biom,
    groesse: o.groesse,

    /** Legt ein Element an und haengt es in die Karte. */
    element(kind, variant, punkte, extra, seed) {
      const el = mkElement(kind, variant, punkte.map((p) => ({ x: p.x, z: p.z })),
        parameterFuer(kind, variant, extra), seed === undefined ? 0x51ee7 : seed);
      S.elements.push(el);
      return el;
    },

    /** Erzeugt EIN Element auf demselben Weg wie der Editor. */
    erzeuge(el) { m.dirty.genElement(el); return el; },

    /** Kompletter Neuaufbau (Flussstempel, Korridore, alle Elemente). */
    alleNeu() { m.dirty.rebuildAll(); },

    /** Entfernt alle Elemente wieder. */
    leeren() { while (S.elements.length) m.store.dropElement(S.elements[0]); }
  };
  return welt;
}

/* --- Beispielkarte -------------------------------------------------------
   Ein fester Satz Elemente, der jeden Generator genau einmal beschaeftigt.
   Dieselbe Karte dient dem Gesamtlauf (Ebene 1), den Invarianten (Ebene 3)
   und dem Speicher-Lade-Zyklus (Ebene 2) — was hier fehlt, wird nirgends
   geprueft, deshalb ist die Liste vollstaendig statt kurz. */
/* Seed 4711 statt der App-Vorgabe 1337: bei 1337 liegen knapp 40 % der
   256er-Karte ueber Wasser, die Haelfte der Beispielelemente erzeugte dort
   gar nichts. 4711 gibt eine zusammenhaengende Landmasse von etwa
   x,z = -90 .. +90 mit Kueste im Osten — auf ihr sitzt jedes Element auf
   Land, und die Werft findet eine echte Uferlinie. */
export const BEISPIEL_SEED = 4711;

export const BEISPIEL_LINIE = [{ x: -60, z: -40 }, { x: -10, z: -10 }, { x: 40, z: 20 }, { x: 80, z: 60 }];
export const BEISPIEL_POLY = [{ x: -40, z: -40 }, { x: 20, z: -50 }, { x: 45, z: 10 },
  { x: 0, z: 45 }, { x: -45, z: 15 }];

export const BEISPIEL_ELEMENTE = [
  ['pfad', 'strasse', [{ x: -70, z: -60 }, { x: -20, z: -30 }, { x: 30, z: -20 }], null, 0x1001],
  ['pfad', 'mauer', [{ x: 10, z: 62 }, { x: 55, z: 66 }, { x: 84, z: 46 }], null, 0x1002],
  ['pfad', 'fluss', [{ x: -85, z: 8 }, { x: -40, z: 24 }, { x: 8, z: 58 }], null, 0x1003],
  ['pfad', 'hecke', [{ x: -75, z: -10 }, { x: -40, z: 0 }], null, 0x1004],
  ['pfad', 'bruch', [{ x: 58, z: -82 }, { x: 84, z: -46 }], null, 0x1005],
  ['flaeche', 'wald', [{ x: -80, z: -86 }, { x: -34, z: -90 }, { x: -26, z: -54 },
    { x: -74, z: -50 }], null, 0x2001],
  ['flaeche', 'feld', [{ x: 20, z: 18 }, { x: 64, z: 14 }, { x: 68, z: 48 }, { x: 24, z: 54 }], null, 0x2002],
  ['flaeche', 'wiese', [{ x: -62, z: 66 }, { x: -16, z: 62 }, { x: -12, z: 92 },
    { x: -66, z: 94 }], null, 0x2003],
  ['flaeche', 'viertel', [{ x: -20, z: -40 }, { x: 20, z: -44 }, { x: 24, z: -10 },
    { x: -16, z: -6 }], null, 0x2004],
  ['flaeche', 'burg', [{ x: 54, z: -76 }, { x: 84, z: -78 }, { x: 87, z: -50 },
    { x: 57, z: -48 }], null, 0x2005],
  // Werft am Ostufer: das Polygon reicht ueber die Wasserlinie hinaus,
  // damit werftAchse eine Kaiflucht findet.
  ['flaeche', 'werft', [{ x: 74, z: 0 }, { x: 104, z: 2 }, { x: 106, z: 30 },
    { x: 76, z: 28 }], null, 0x2006],
  ['flaeche', 'kloster', [{ x: -86, z: 30 }, { x: -56, z: 28 }, { x: -53, z: 58 },
    { x: -84, z: 60 }], null, 0x2007],
  ['objekt', 'baeume', [{ x: -45, z: 40 }], { anzahl: 14, streuung: 12 }, 0x3001],
  ['objekt', 'haeuser', [{ x: 45, z: -30 }], { anzahl: 6, streuung: 10 }, 0x3002],
  ['objekt', 'felsen', [{ x: 70, z: 78 }], { anzahl: 9, streuung: 14 }, 0x3003],
  ['objekt', 'inseln', [{ x: 0, z: -62 }], null, 0x3004],
  ['ranke', 'ranke', [{ x: -30, z: 20 }], null, 0x4001]
];

/** Legt die Beispielkarte in der Welt an (ohne zu erzeugen). */
export function beispielKarte(welt) {
  const out = [];
  for (const [kind, variant, punkte, extra, seed] of BEISPIEL_ELEMENTE) {
    out.push(welt.element(kind, variant, punkte, extra, seed));
  }
  return out;
}

/** Hasht die Geometrie eines Meshes vollstaendig (Attribute + Index). */
function geometrieInHash(h, geo) {
  const namen = Object.keys(geo.attributes).sort();
  h.zahl(namen.length);
  for (const n of namen) {
    const a = geo.attributes[n];
    h.text(n).zahl(a.itemSize).zahl(a.count).folge(a.array);
  }
  h.text('#index').folge(geo.index ? geo.index.array : null);
}

/** Vollstaendiger Ergebnis-Hash eines erzeugten Elements. */
export function hashElement(el) {
  const h = new Hasher();
  h.text('#element').text(el.kind).text(String(el.variant));
  h.text('#inst');
  const pools = Object.keys(el.inst).sort();
  h.zahl(pools.length);
  for (const p of pools) { h.text(p).folge(el.inst[p]); }
  h.text('#total').zahl(el.total);
  h.text('#schatten').folge(el.schatten);
  h.text('#rauch').folge(el.rauch);
  h.text('#meshes');
  const kinder = el.group ? el.group.children : [];
  h.zahl(kinder.length);
  for (const k of kinder) {
    h.text(k.type);
    h.zahl(k.position.x).zahl(k.position.y).zahl(k.position.z);
    h.zahl(k.renderOrder);
    if (k.geometry) geometrieInHash(h, k.geometry);
    else h.text('#ohneGeometrie');
  }
  return h.hex();
}

/** Hash ueber die Instanzdaten ALLER Elemente der Karte (Gesamtlauf). */
export function hashKarte(S) {
  const h = new Hasher();
  h.zahl(S.elements.length);
  for (const el of S.elements) h.text(hashElement(el));
  return h.hex();
}

/** Hash ueber die Geometrien ALLER registrierten Pools (Ebene 1, Bauteile).
 *  Sie entstehen beim Modulstart von generators/geometry.js und lassen sich
 *  deshalb nur ueber zwei getrennte Prozesse vergleichen. */
export function hashPools(POOLS) {
  const h = new Hasher();
  const namen = Object.keys(POOLS).sort();
  h.zahl(namen.length);
  for (const n of namen) {
    h.text(n);
    h.zahl(POOLS[n].radius === undefined ? -1 : POOLS[n].radius);
    geometrieInHash(h, POOLS[n].geo);
  }
  return h.hex();
}

/** Reihenfolgeunabhaengige Sicht: nur die Instanzen EINES Elements. */
export function hashInstanzen(el) {
  const h = new Hasher();
  const pools = Object.keys(el.inst).sort();
  h.zahl(pools.length);
  for (const p of pools) h.text(p).folge(el.inst[p]);
  return h.hex();
}
