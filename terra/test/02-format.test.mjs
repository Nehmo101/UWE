/* ==========================================================================
   Ebene 2 — Formatkompatibilitaet

   Vier Beispieldateien in fixtures/ decken die vier Fassungen des
   Speicherformats ab (siehe das Feld `_fassung` in jeder Datei). Geprueft
   wird dreierlei:
     - Jede Fassung LAEDT und ergibt die erwartete Elementzahl.
     - Ein Speicher-Lade-Zyklus laesst die Karte unveraendert.
     - Fehlerhafte Dateien scheitern ATOMAR: der Editorzustand bleibt exakt
       so, wie er vorher war.

   Ein Wort zu „atomar": editor/io.js trennt bewusst zwischen STRENG und
   TOLERANT. Streng geprueft wird alles, was Geometrie oder Hoehen bestimmt
   (Punkte, Zugpunkte, Deltaindizes, Kartengroesse, Farbskript) — dort wirft
   validiereKarte, und der Aufrufer laesst den Zustand unangetastet. Tolerant
   gelesen werden Stimmungsfelder (Biom, Wetter, Tageszeit) und die Kamera:
   ein unbekanntes Biom faellt auf „wiese" zurueck, eine unbrauchbare
   Kamerazahl wird uebersprungen. Beides ist dokumentierte Absicht und wird
   hier als solche geprueft, nicht als Fehler.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ladeTerra, TEST } from './hilfen/laden.mjs';
import { testWelt } from './hilfen/karte.mjs';
import { hashVon, Hasher } from './hilfen/hash.mjs';

function fixture(name) {
  return fs.readFileSync(path.join(TEST, 'fixtures', name), 'utf8');
}

/** Welt + io.js. testWelt setzt Szene, Kartengroesse und Basisterrain. */
async function ioWelt() {
  const welt = await testWelt({ seed: 1337, biom: 'wiese', groesse: 256 });
  const io = await ladeTerra('editor/io.js');
  return { welt, io };
}

/** Vollstaendiger Abdruck des Zustands, den ein Ladevorgang anfassen wuerde. */
function abdruck(m) {
  const h = new Hasher();
  h.text('#seed').zahl(m.store.S.worldSeed);
  h.text('#biom').text(m.store.S.biom);
  h.text('#karte').zahl(m.store.KARTE.map);
  h.text('#raster').text(String(m.store.S.snap));
  h.text('#elemente').wert(m.store.serializeElements());
  h.text('#marker').wert(m.store.serializeMarker());
  h.text('#stempel').wert(m.store.serializeStempel());
  h.text('#base').folge(m.terrain.base);
  return h.hex();
}

const FASSUNGEN = [
  { datei: 'v1-einzeldatei.json', version: 1, elemente: 2, groesse: 256, seed: 4711, biom: 'wiese' },
  { datei: 'v2-hoehen-vollarray.json', version: 2, elemente: 3, groesse: 256, seed: 20260101, biom: 'wiese' },
  { datei: 'v3-hoehendelta.json', version: 3, elemente: 4, groesse: 256, seed: 4711, biom: 'sumpf' },
  { datei: 'v4-kartengroesse.json', version: 4, elemente: 5, groesse: 512, seed: 90210, biom: 'schnee' }
];

test('Ebene 2 — jede Fassung laedt mit der erwarteten Elementzahl', async (t) => {
  for (const f of FASSUNGEN) {
    await t.test(f.datei, async () => {
      const { io, welt } = await ioWelt();
      const karte = io.validiereKarte(fixture(f.datei));
      assert.equal(karte.dateiVersion, f.version, 'dateiVersion');
      assert.equal(karte.elemente.length, f.elemente, 'Elementzahl aus der Datei');
      assert.equal(karte.kartenGroesse, f.groesse, 'kartenGroesse');
      assert.equal(karte.seed, f.seed, 'seed');
      assert.equal(karte.biom, f.biom, 'biom');
      // v1/v2 tragen ein Hoehen-Vollarray, v3/v4 ein Delta — nie beides.
      assert.equal(karte.hoehen === null, f.version >= 3, 'Hoehenform passt nicht zur Fassung');
      assert.equal(karte.hoehenDelta === null, f.version < 3, 'Deltaform passt nicht zur Fassung');

      io.uebernehmeKarte(karte);
      assert.equal(welt.m.store.S.elements.length, f.elemente, 'Elemente in der Karte');
      assert.equal(welt.m.store.S.worldSeed, f.seed, 'Seed uebernommen');
      assert.equal(welt.m.store.S.biom, f.biom, 'Biom uebernommen');
      assert.equal(welt.m.store.KARTE.map, f.groesse, 'Kartengroesse uebernommen');
    });
  }
});

test('Ebene 2 — Speicher-Lade-Zyklus laesst die Karte unveraendert', async (t) => {
  for (const f of FASSUNGEN) {
    await t.test(f.datei, async () => {
      const { io, welt } = await ioWelt();
      io.uebernehmeKarte(io.validiereKarte(fixture(f.datei)));

      /* Erster Speicherstand: hier wird die Datei auf die aktuelle Fassung
         gehoben (v1..v3 bekommen kartenGroesse und hoehenDelta). Ab hier
         muss jeder weitere Zyklus BUCHSTABENGLEICH sein — das ist die
         eigentliche Zusage. */
      const einmal = JSON.stringify(io.kartenDaten());
      io.uebernehmeKarte(io.validiereKarte(einmal));
      const zweimal = JSON.stringify(io.kartenDaten());
      assert.equal(zweimal, einmal, 'Der zweite Speicherstand weicht vom ersten ab');

      io.uebernehmeKarte(io.validiereKarte(zweimal));
      assert.equal(JSON.stringify(io.kartenDaten()), einmal, 'Dritter Zyklus weicht ab');

      const gespeichert = JSON.parse(einmal);
      assert.equal(gespeichert.version, 4, 'Gespeichert wird immer die aktuelle Fassung');
      assert.equal(gespeichert.format, 'terra');
      assert.equal(gespeichert.elemente.length, f.elemente);
      assert.equal(gespeichert.kartenGroesse, f.groesse);
      assert.equal(welt.m.store.S.elements.length, f.elemente);
    });
  }
});

test('Ebene 2 — unbekannte Zusatzfelder brechen das Laden nicht', async () => {
  const { io } = await ioWelt();
  const d = JSON.parse(fixture('v4-kartengroesse.json'));
  d.einFeldAusDerZukunft = { ebenen: [1, 2, 3] };
  d.elemente[0].nochEinFeld = 'egal';
  const karte = io.validiereKarte(JSON.stringify(d));
  assert.equal(karte.elemente.length, 5);
  io.uebernehmeKarte(karte);
});

/* --- Fehlerfaelle: streng geprueft, atomar ------------------------------- */
const KAPUTT = [
  ['kaputtes JSON', () => '{ das ist kein json', /JSON|Unexpected/i],
  ['Datei ohne elemente-Feld', () => JSON.stringify({ format: 'terra', version: 4, hoehenDelta: [] }),
    /Unbekanntes Format/],
  ['weder hoehen noch hoehenDelta', (d) => { delete d.hoehenDelta; return JSON.stringify(d); },
    /Unbekanntes Format/],
  ['hoehenDelta mit negativem Index', (d) => { d.hoehenDelta = [-1, 5]; return JSON.stringify(d); },
    /hoehenDelta: ung.ltiger Index/],
  ['hoehenDelta-Index jenseits der Kartengroesse',
    (d) => { d.hoehenDelta = [263169, 5]; return JSON.stringify(d); },
    /hoehenDelta: ung.ltiger Index/],
  ['hoehenDelta mit ungerader Laenge', (d) => { d.hoehenDelta = [0, 1, 2]; return JSON.stringify(d); },
    /ungerade L.nge/],
  ['hoehenDelta mit nicht endlichem Wert', (d) => { d.hoehenDelta = [0, null]; return JSON.stringify(d); },
    /hoehenDelta: ung.ltiger Wert/],
  ['unbekannte Kartengroesse', (d) => { d.kartenGroesse = 700; return JSON.stringify(d); },
    /Unbekannte Kartengr..e/],
  ['Element ohne kind', (d) => { delete d.elemente[0].kind; return JSON.stringify(d); },
    /kind fehlt/],
  ['Element ohne points', (d) => { delete d.elemente[1].points; return JSON.stringify(d); },
    /points fehlen/],
  ['Punkt mit nicht endlicher Koordinate',
    (d) => { d.elemente[1].points[0] = { x: 'zwoelf', z: 3 }; return JSON.stringify(d); },
    /Punkt 0 ung.ltig/],
  ['ungueltiger Zugpunkt einer Ranke', (d) => {
    d.elemente.push({ kind: 'ranke', variant: 'ranke', points: [{ x: 0, z: 0 }],
      params: { zugpunkte: [{ h: 0.5, dx: 1, dz: 2 }, { h: null, dx: 0, dz: 0 }] }, seed: 9 });
    return JSON.stringify(d);
  }, /Zugpunkt 1 ung.ltig/],
  ['Marker ohne Koordinate', (d) => { d.marker = [{ text: 'ohne Ort' }]; return JSON.stringify(d); },
    /Koordinate ung.ltig/],
  ['Farbskript mit unbrauchbarer Staerke',
    (d) => { d.farbskript = { licht: 1, mitte: 2, schatten: 3, staerke: 4 }; return JSON.stringify(d); },
    /staerke ung.ltig/],
  ['Stempel ohne Namen', (d) => { d.stempel[0].name = ''; return JSON.stringify(d); },
    /name fehlt/],
  ['Palettenfarbe ist keine Zahl',
    (d) => { d.palette = { farben: ['rot'], staerke: 0.5 }; return JSON.stringify(d); },
    /palette: Farbe 0/]
];

test('Ebene 2 — fehlerhafte Dateien scheitern atomar', async (t) => {
  const historie = await import('./hilfen/ersatz/history.js');
  for (const [name, bau, muster] of KAPUTT) {
    await t.test(name, async () => {
      const { io, welt } = await ioWelt();
      // Eine gueltige Karte laden, damit es ueberhaupt einen Zustand gibt,
      // der verloren gehen KOENNTE.
      io.uebernehmeKarte(io.validiereKarte(fixture('v3-hoehendelta.json')));
      const vorher = abdruck(welt.m);
      const undoVorher = historie.aufrufe.pushUndo;

      const text = bau(JSON.parse(fixture('v4-kartengroesse.json')));
      assert.throws(() => io.validiereKarte(text), muster, 'wurde nicht abgelehnt');

      assert.equal(abdruck(welt.m), vorher, 'Der Zustand hat sich trotz Fehler veraendert');
      assert.equal(historie.aufrufe.pushUndo, undoVorher,
        'Es wurde ein Undo-Punkt gesetzt, obwohl gar nicht geladen wurde');
    });
  }
});

/* --- Fehlerfaelle: bewusst tolerant -------------------------------------- */
test('Ebene 2 — unbekanntes Biom faellt still auf „wiese" zurueck', async () => {
  const { io, welt } = await ioWelt();
  const d = JSON.parse(fixture('v4-kartengroesse.json'));
  d.biom = 'schokoladenwueste';
  const karte = io.validiereKarte(JSON.stringify(d));
  assert.equal(karte.biom, 'wiese', 'Ein unbekanntes Biom ist kein Formatfehler (io.js:351)');
  io.uebernehmeKarte(karte);
  assert.equal(welt.m.store.S.biom, 'wiese');
});

test('Ebene 2 — unbekanntes Wetter faellt still auf „klar" zurueck', async () => {
  const { io } = await ioWelt();
  const atmosphaere = await import('./hilfen/ersatz/atmosphere.js');
  const d = JSON.parse(fixture('v4-kartengroesse.json'));
  d.wetter = 'meteorschauer';
  assert.equal(io.validiereKarte(JSON.stringify(d)).wetter, 'meteorschauer',
    'validiereKarte reicht den String durch — geglaettet wird erst in setWetter');
  io.uebernehmeKarte(io.validiereKarte(JSON.stringify(d)));
  assert.equal(atmosphaere.getWetterName(), 'klar');
});

test('Ebene 2 — nicht endliche Kamerawerte lassen die Kamera in Ruhe', async () => {
  const { io } = await ioWelt();
  const kamera = await import('./hilfen/ersatz/camera.js');
  const stand = () => ({ x: kamera.cam.tFocus.x, z: kamera.cam.tFocus.z,
    dist: kamera.cam.tDist, yaw: kamera.cam.tYaw, pitch: kamera.cam.tPitch });
  // Gueltige Kamera setzen …
  io.uebernehmeKarte(io.validiereKarte(fixture('v3-hoehendelta.json')));
  const vorher = stand();
  // … und dann eine Datei laden, deren Kamera unbrauchbar ist. JSON kann kein
  // NaN darstellen; genau so kommt ein kaputter Wert in der Praxis an (null,
  // Text, fehlendes Feld). uebernehmeKarte prueft jede Zahl einzeln.
  const d = JSON.parse(fixture('v3-hoehendelta.json'));
  d.kamera = { x: null, z: 'NaN', dist: {}, yaw: [], pitch: 'weit weg' };
  io.uebernehmeKarte(io.validiereKarte(JSON.stringify(d)));
  assert.deepEqual(stand(), vorher,
    'Eine unbrauchbare Kamerazahl darf den Kamerastand nicht veraendern');
});

test('Ebene 2 — v1-Kurzhoehen werden deterministisch aufgefuellt', async () => {
  /* Fassung 1 durfte ein kuerzeres Hoehenfeld mitbringen. uebernehmeKarte
     erzeugt dann erst das komplette Seed-Terrain und legt die gespeicherten
     Werte darueber — zweimaliges Laden muss dasselbe Feld ergeben. */
  const { io, welt } = await ioWelt();
  io.uebernehmeKarte(io.validiereKarte(fixture('v1-einzeldatei.json')));
  const ersteHoehen = hashVon(welt.m.terrain.base);
  // base ist ein Float32Array — der Vergleichswert muss durch dieselbe
  // Rundung, sonst scheitert der Test an 4.6 vs. 4.599999904632568.
  assert.equal(welt.m.terrain.base[0], Math.fround(3.5), 'Der gespeicherte Anfang steht nicht im Feld');
  assert.equal(welt.m.terrain.base[11], Math.fround(4.6));

  const zweite = await ioWelt();
  zweite.io.uebernehmeKarte(zweite.io.validiereKarte(fixture('v1-einzeldatei.json')));
  assert.equal(hashVon(zweite.welt.m.terrain.base), ersteHoehen);
});

test('Ebene 2 — hoehenDelta trifft genau die gespeicherten Zellen', async () => {
  const { io, welt } = await ioWelt();
  io.uebernehmeKarte(io.validiereKarte(fixture('v3-hoehendelta.json')));
  const base = welt.m.terrain.base;
  assert.equal(base[0], 12.5);
  assert.equal(base[1], 12.25);
  assert.equal(base[258], 11.75);
  assert.equal(base[66048], -3.5);
});
