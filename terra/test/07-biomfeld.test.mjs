/* ==========================================================================
   Ebene 7 — Biomflaechen (I2, world/biomfeld.js)

   Das Modul rechnet Polygone in ein Gitter um, mischt Paletten und schlaegt
   aus dem Gelaende Biomgebiete vor. Es haengt an keinem Browser, an keinem
   THREE-Zeichenweg und an keinem globalen Zustand — Hoehen, Hang und Abfluss
   kommen als Argument herein. Deshalb kann diese Ebene das Modul EINZELN
   pruefen und braucht keine Testwelt.

   Geprueft werden acht Zusagen:
     1 Determinismus            gleiche Eingabe -> bitgleiches Feld
     2 reine Funktion           biomAn haengt nur an der Position
     3 innen/aussen/Uebergang   255 innen, 0 weit aussen, Rampe in `weich`
     4 ausgefranst              die Grenze folgt der Polygonkante NICHT exakt
     5 Ueberlagerung            zwei Flaechen ergeben die dokumentierte Regel
     6 Vorschlag                brauchbare, bearbeitbare Polygone
     7 Mischcache               Stufe 0/15 exakt, monoton, kein undefined
     8 LUT                      je Biom eine Zeile, keine NaN, Wertebereich
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeTerra } from './hilfen/laden.mjs';

const B = await ladeTerra('world/biomfeld.js');
const { BIOME } = await ladeTerra('core/store.js');
const { fractal, clamp } = await ladeTerra('core/rng.js');

const MAP = 256, VW = MAP + 1, HALF = MAP / 2, N = VW * VW;

/* Ein Gelaende in der Groessenordnung von genBaseIn: Amplitude 26, feine
   zweite Oktave, Randabbruch nach -22. Bewusst hier gebaut und nicht aus
   terrain.js geholt — das Modul soll ohne die Weltmaschine pruefbar sein,
   und genau das wird hier mitgeprueft. */
function gelaende(seed) {
  const h = new Float32Array(N);
  for (let j = 0; j < VW; j++) {
    for (let i = 0; i < VW; i++) {
      const x = i - HALF, z = j - HALF;
      let v = fractal(x * 0.012, z * 0.012, seed) * 26 - 6;
      v += (fractal(x * 0.05, z * 0.05, seed + 11) - 0.5) * 4;
      const d = Math.min(Math.min(i, VW - 1 - i), Math.min(j, VW - 1 - j));
      const t = clamp(d / 55, 0, 1);
      h[j * VW + i] = -22 + (v + 22) * (t * t * (3 - 2 * t));
    }
  }
  return h;
}

function kreis(cx, cz, r, n) {
  const p = [];
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2;
    p.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r });
  }
  return p;
}

function rechteck(x0, z0, x1, z1) {
  return [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
}

function flaeche(biom, points, weich) {
  return { kind: 'flaeche', variant: 'biom', points, params: { biom, weich } };
}

const G = (x, z) => (Math.round(z + HALF) * VW + Math.round(x + HALF));

/* ==========================================================================
   1 — Determinismus
   ========================================================================== */

test('Ebene 7 — zweimal ableiten ergibt bitgleiche Felder', () => {
  const fl = [flaeche('moor', kreis(0, 0, 60, 9), 8)];
  const a = B.biomFeldBauen(fl, VW, MAP, { seed: 1337 });
  const b = B.biomFeldBauen(fl, VW, MAP, { seed: 1337 });
  assert.deepEqual(Array.from(a.feld), Array.from(b.feld));
  assert.deepEqual(Array.from(a.gewicht), Array.from(b.gewicht));
});

test('Ebene 7 — zwei Seeds ergeben verschiedene Felder (die Pruefung ist nicht blind)', () => {
  const fl = [flaeche('moor', kreis(0, 0, 60, 9), 8)];
  const a = B.biomFeldBauen(fl, VW, MAP, { seed: 1337 });
  const b = B.biomFeldBauen(fl, VW, MAP, { seed: 4711 });
  let anders = 0;
  for (let k = 0; k < N; k++) if (a.gewicht[k] !== b.gewicht[k]) anders++;
  // Nur der Saum darf sich unterscheiden — der Kern haengt nicht am Seed.
  assert.ok(anders > 200, `zu wenige Unterschiede: ${anders}`);
  assert.equal(a.feld[G(0, 0)], b.feld[G(0, 0)]);
  assert.equal(a.gewicht[G(0, 0)], 255);
  assert.equal(b.gewicht[G(0, 0)], 255);
});

test('Ebene 7 — Teilaufbau liefert dasselbe wie der Vollaufbau', () => {
  const fl = [flaeche('moor', kreis(-40, -30, 45, 8), 8),
              flaeche('karst', kreis(40, 30, 45, 8), 8)];
  const voll = B.biomFeldBauen(fl, VW, MAP, { seed: 1337 });
  // Zweites Feld: erst alles, dann die Box des ersten Elements neu — das ist
  // genau der Weg, den ein Commit einer einzelnen Flaeche geht.
  const teil = B.biomFeldBauen(fl, VW, MAP, { seed: 1337 });
  const box = B.biomBox(fl[0], VW, MAP);
  B.biomFeldBauen(fl, VW, MAP, { seed: 1337, feld: teil.feld, gewicht: teil.gewicht, box });
  assert.deepEqual(Array.from(teil.gewicht), Array.from(voll.gewicht));
  assert.deepEqual(Array.from(teil.feld), Array.from(voll.feld));
});

/* ==========================================================================
   2 — Reine Funktion
   ========================================================================== */

test('Ebene 7 — biomAn haengt nur an der Position, nicht an der Aufrufreihenfolge', () => {
  const fl = [flaeche('sumpf', kreis(10, -5, 50, 7), 10)];
  const { feld, gewicht } = B.biomFeldBauen(fl, VW, MAP, { seed: 1337 });
  const stellen = [];
  for (let k = 0; k < 400; k++) {
    stellen.push({ x: (k * 37 % 220) - 110, z: (k * 61 % 220) - 110 });
  }
  const vorwaerts = stellen.map(p => B.biomAn(feld, gewicht, VW, MAP, p.x, p.z));
  const rueckwaerts = stellen.slice().reverse()
    .map(p => B.biomAn(feld, gewicht, VW, MAP, p.x, p.z)).reverse();
  for (let k = 0; k < stellen.length; k++) {
    assert.equal(vorwaerts[k].biom, rueckwaerts[k].biom);
    assert.equal(vorwaerts[k].gewicht, rueckwaerts[k].gewicht);
  }
  // dieselbe Position dreimal hintereinander
  for (const p of stellen.slice(0, 20)) {
    const a = B.biomAn(feld, gewicht, VW, MAP, p.x, p.z);
    const b = B.biomAn(feld, gewicht, VW, MAP, p.x, p.z);
    assert.deepEqual(a, b);
  }
  // out-Objekt darf das Ergebnis nicht veraendern
  const out = { biom: 'x', index: 9, gewicht: 0.5 };
  const mit = B.biomAn(feld, gewicht, VW, MAP, 10, -5, out);
  const ohne = B.biomAn(feld, gewicht, VW, MAP, 10, -5);
  assert.equal(mit, out);
  assert.deepEqual({ ...mit }, { ...ohne });
});

test('Ebene 7 — biomHartAn ist ortsstabil und liefert immer einen gueltigen Namen', () => {
  const fl = [flaeche('tundra', kreis(0, 0, 55, 9), 12)];
  const { feld, gewicht } = B.biomFeldBauen(fl, VW, MAP, { seed: 1337 });
  for (let k = 0; k < 500; k++) {
    const x = (k * 29 % 200) - 100, z = (k * 53 % 200) - 100;
    const a = B.biomHartAn(feld, gewicht, VW, MAP, x, z, 'wiese', 1337);
    const b = B.biomHartAn(feld, gewicht, VW, MAP, x, z, 'wiese', 1337);
    assert.equal(a, b);
    assert.ok(BIOME[a], `unbekanntes Biom ${a}`);
    assert.ok(a === 'wiese' || a === 'tundra');
  }
  // im Kern immer das Flaechenbiom, weit draussen immer das Basisbiom
  assert.equal(B.biomHartAn(feld, gewicht, VW, MAP, 0, 0, 'wiese', 1337), 'tundra');
  assert.equal(B.biomHartAn(feld, gewicht, VW, MAP, 120, 120, 'wiese', 1337), 'wiese');
});

/* ==========================================================================
   3 — Innen ist innen
   ========================================================================== */

test('Ebene 7 — innen 255, weit aussen 0, Uebergang in der Breite von `weich`', () => {
  const weich = 8;
  const pts = rechteck(-50, -50, 50, 50);
  const { feld, gewicht } = B.biomFeldBauen([flaeche('moor', pts, weich)], VW, MAP, { seed: 1337 });
  const moor = B.biomIndex('moor');
  // Der Uebergang ist hoechstens weich/2 breit plus die Ausfransung
  // (FRANSEN 0.30 x Stoeramplitude 1.75 x weich) — zusammen 1.025 x weich.
  const zone = weich * 1.025;
  let innenFehler = 0, aussenFehler = 0, geprueft = 0;
  for (let z = -49 + zone; z <= 49 - zone; z += 3) {
    for (let x = -49 + zone; x <= 49 - zone; x += 3) {
      geprueft++;
      if (gewicht[G(x, z)] !== 255 || feld[G(x, z)] !== moor) innenFehler++;
    }
  }
  assert.ok(geprueft > 100);
  assert.equal(innenFehler, 0, `${innenFehler} von ${geprueft} Innenpunkten nicht voll`);
  for (let z = -120; z <= 120; z += 3) {
    for (let x = -120; x <= 120; x += 3) {
      const d = Math.max(Math.abs(x), Math.abs(z));
      if (d < 50 + zone + 1) continue;
      if (gewicht[G(x, z)] !== 0) aussenFehler++;
    }
  }
  assert.equal(aussenFehler, 0, `${aussenFehler} Aussenpunkte tragen Gewicht`);
});

test('Ebene 7 — `weich` steuert die Breite des Uebergangs', () => {
  const pts = rechteck(-50, -50, 50, 50);
  const breite = (w) => {
    const { gewicht } = B.biomFeldBauen([flaeche('moor', pts, w)], VW, MAP, { seed: 1337 });
    // Anzahl Zellen mit Zwischenwerten auf der Mittelzeile z = 0
    let n = 0;
    for (let x = -120; x <= 120; x++) {
      const g = gewicht[G(x, 0)];
      if (g > 0 && g < 255) n++;
    }
    return n;
  };
  const schmal = breite(4), mittel = breite(12), breit = breite(24);
  assert.ok(schmal < mittel, `weich 4 (${schmal}) muss schmaler sein als 12 (${mittel})`);
  assert.ok(mittel < breit, `weich 12 (${mittel}) muss schmaler sein als 24 (${breit})`);
  // Zwei Kanten je Zeile, jede hoechstens 2 x 1.025 x weich breit
  assert.ok(breit <= 2 * 2 * 1.025 * 24 + 4, `Uebergang zu breit: ${breit}`);
});

/* ==========================================================================
   4 — Ausgefranst, nicht gerade

   Der Sinn der Sache: die Polygonkante darf im Bild keine Polygonkante sein.
   Gemessen wird an einer GERADEN Kante, wo der Grenzverlauf ohne Ausfransung
   exakt konstant waere.
   ========================================================================== */

test('Ebene 7 — die abgeleitete Grenze folgt der Polygonkante nicht exakt', () => {
  const weich = 8;
  const pts = rechteck(-60, -60, 60, 60);
  const { gewicht } = B.biomFeldBauen([flaeche('karst', pts, weich)], VW, MAP, { seed: 1337 });
  // Fuer jede Zeile z: die Stelle, an der das Gewicht auf der rechten Kante
  // unter 128 faellt. Ohne Ausfransung waere das ueberall exakt x = 60.
  const lagen = [];
  for (let z = -55; z <= 55; z++) {
    let gefunden = null;
    for (let x = 40; x <= 80; x++) {
      if (gewicht[G(x, z)] < 128) { gefunden = x; break; }
    }
    if (gefunden !== null) lagen.push(gefunden);
  }
  assert.ok(lagen.length > 100, 'zu wenige Messpunkte');
  const mittel = lagen.reduce((a, b) => a + b, 0) / lagen.length;
  const streu = Math.sqrt(lagen.reduce((a, b) => a + (b - mittel) ** 2, 0) / lagen.length);
  const spanne = Math.max(...lagen) - Math.min(...lagen);
  /* Benannte Schranken. Untergrenze: weniger als eine Welteinheit Streuung
     waere im Bild eine Gerade — genau der Zustand, den I2 abschaffen soll.
     Obergrenze: mehr als die halbe Ausfransungsamplitude
     (FRANSEN 0.30 x 1.75 x weich = 4.2) hiesse, dass die Grenze die Form des
     Polygons verliert und der Bearbeiter nicht mehr trifft, was er zeichnet. */
  assert.ok(streu > 1.0, `Grenze zu gerade: Streuung ${streu.toFixed(2)}`);
  assert.ok(streu < 4.2, `Grenze zu wild: Streuung ${streu.toFixed(2)}`);
  assert.ok(spanne >= 4, `Grenze zu gerade: Spanne ${spanne}`);
  // Gegenprobe: mit weich = 0.25 (harte Kante) darf sie fast gerade sein.
  const hart = B.biomFeldBauen([flaeche('karst', pts, 0)], VW, MAP, { seed: 1337 }).gewicht;
  const hartLagen = [];
  for (let z = -55; z <= 55; z++) {
    for (let x = 40; x <= 80; x++) {
      if (hart[G(x, z)] < 128) { hartLagen.push(x); break; }
    }
  }
  assert.equal(Math.max(...hartLagen) - Math.min(...hartLagen), 0,
    'weich = 0 muss eine harte, gerade Kante ergeben');
});

/* ==========================================================================
   5 — Ueberlagerung
   ========================================================================== */

test('Ebene 7 — bei Ueberlagerung gewinnt im Kern die zuletzt gezeichnete Flaeche', () => {
  const a = flaeche('moor', rechteck(-60, -30, 10, 30), 8);
  const b = flaeche('karst', rechteck(-10, -30, 60, 30), 8);
  const ab = B.biomFeldBauen([a, b], VW, MAP, { seed: 1337 });
  const ba = B.biomFeldBauen([b, a], VW, MAP, { seed: 1337 });
  const moor = B.biomIndex('moor'), karst = B.biomIndex('karst');
  // Im Schnittbereich (-10..10) sind beide voll gedeckt -> die letzte gewinnt.
  assert.equal(ab.feld[G(0, 0)], karst);
  assert.equal(ba.feld[G(0, 0)], moor);
  assert.equal(ab.gewicht[G(0, 0)], 255);
  assert.equal(ba.gewicht[G(0, 0)], 255);
  // Ausserhalb des Schnitts bleibt jede bei sich, unabhaengig von der Reihenfolge.
  assert.equal(ab.feld[G(-40, 0)], moor);
  assert.equal(ba.feld[G(-40, 0)], moor);
  assert.equal(ab.feld[G(40, 0)], karst);
  assert.equal(ba.feld[G(40, 0)], karst);
});

test('Ebene 7 — im Saum gewinnt die staerkere Deckung, nicht die spaetere', () => {
  // Grosse volle Flaeche, danach eine weit entfernte zweite, deren AUSFRANSUNG
  // gerade eben hineinreicht. Ohne die Maximumregel wuerde sie den Kern der
  // ersten mit Gewicht 3 ueberschreiben.
  const kern = flaeche('moor', rechteck(-60, -60, 60, 60), 6);
  const streift = flaeche('karst', rechteck(58, -60, 200, 60), 30);
  const r = B.biomFeldBauen([kern, streift], VW, MAP, { seed: 1337 });
  const moor = B.biomIndex('moor');
  assert.equal(r.feld[G(0, 0)], moor);
  assert.equal(r.gewicht[G(0, 0)], 255);
  // Das Gewicht ist ueber die Elementliste monoton — es kann nie sinken.
  const nur = B.biomFeldBauen([kern], VW, MAP, { seed: 1337 });
  let gesunken = 0;
  for (let k = 0; k < N; k++) if (r.gewicht[k] < nur.gewicht[k]) gesunken++;
  assert.equal(gesunken, 0, `${gesunken} Zellen haben durch die zweite Flaeche Gewicht VERLOREN`);
});

test('Ebene 7 — unbekanntes Biom und entartete Polygone werden still ueberlesen', () => {
  const fl = [
    flaeche('gibtesnicht', kreis(0, 0, 40, 8), 8),
    flaeche('moor', [{ x: 0, z: 0 }, { x: 1, z: 1 }], 8),   // zu wenige Punkte
    { kind: 'flaeche', variant: 'wald', points: kreis(0, 0, 40, 8), params: {} }
  ];
  const r = B.biomFeldBauen(fl, VW, MAP, { seed: 1337 });
  let belegt = 0;
  for (let k = 0; k < N; k++) if (r.gewicht[k] > 0) belegt++;
  assert.equal(belegt, 0);
  for (let k = 0; k < N; k++) assert.equal(r.feld[k], B.BIOM_KEINS);
});

/* ==========================================================================
   6 — Der Vorschlag ergibt brauchbare Polygone
   ========================================================================== */

const vorschlag = B.biomeVorschlagen({ hoehe: gelaende(1337) }, VW, MAP, { seed: 1337 });

test('Ebene 7 — der Vorschlag ist weder leer noch ein Polygon ueber die ganze Karte', () => {
  assert.ok(vorschlag.length >= 4, `nur ${vorschlag.length} Gebiete`);
  assert.ok(vorschlag.length <= 200, `${vorschlag.length} Gebiete sind nicht mehr bearbeitbar`);
  const groesste = Math.max(...vorschlag.map(v => v.zellen)) / N;
  assert.ok(groesste < 0.85, `ein Gebiet deckt ${(groesste * 100).toFixed(0)} % der Karte`);
  // Mehr als ein Biom — sonst waere es die alte Karteneigenschaft mit Umweg.
  const arten = new Set(vorschlag.map(v => v.biom));
  assert.ok(arten.size >= 3, `nur ${arten.size} verschiedene Biome`);
});

test('Ebene 7 — jedes vorgeschlagene Biom existiert in BIOME', () => {
  for (const v of vorschlag) assert.ok(BIOME[v.biom], `unbekanntes Biom ${v.biom}`);
});

test('Ebene 7 — die Punktzahl bleibt in der Naehe der Zielgroesse', () => {
  const punkte = vorschlag.map(v => v.points.length);
  for (const p of punkte) assert.ok(p >= 3, 'Polygon mit weniger als 3 Punkten');
  const med = punkte.slice().sort((a, b) => a - b)[punkte.length >> 1];
  assert.ok(med <= B.ZIEL_PUNKTE, `Median ${med} ueber der Zielgroesse ${B.ZIEL_PUNKTE}`);
  /* Die Zielgroesse ist ein Ziel, keine Zusage: bei stark zerfransten
     Kuestengebieten bricht die Vereinfachung ab, sobald sie den Rand zum
     Selbstschnitt bringen wuerde. Gemessen ueber 256/512/1024 lag der
     schlechteste Fall bei 35 Punkten; das Doppelte der Zielgroesse ist die
     Schranke, ab der ein Polygon im Editor nicht mehr zu greifen waere. */
  const max = Math.max(...punkte);
  assert.ok(max <= B.ZIEL_PUNKTE * 2, `groesstes Polygon hat ${max} Punkte`);
});

test('Ebene 7 — keine NaN in den Koordinaten, alles auf der Karte', () => {
  for (const v of vorschlag) {
    for (const p of v.points) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), `NaN in ${v.biom}`);
      assert.ok(p.x >= -HALF - 1 && p.x <= HALF + 1, `x ${p.x} ausserhalb der Karte`);
      assert.ok(p.z >= -HALF - 1 && p.z <= HALF + 1, `z ${p.z} ausserhalb der Karte`);
    }
  }
});

test('Ebene 7 — kein vereinfachter Rand schneidet sich selbst', () => {
  /* Garantiert wird das nicht durch Konstruktion, sondern durch Suche:
     zuPolygon steigert die Douglas-Peucker-Toleranz und behaelt nur
     schnittfreie Staende. Was NICHT garantiert werden kann, ist Schnittfreiheit
     bei einem Gebiet, das schon auf Zellebene ueber eine einzelne Zelle mit
     sich selbst verbunden ist (Sanduhr) — dort beruehrt sich der Rand, ohne
     sich zu kreuzen. Der Test prueft deshalb echte Kreuzungen, keine
     Beruehrungen. */
  for (const v of vorschlag) {
    assert.equal(B.selbstSchnitt(v.points), false, `${v.biom} schneidet sich selbst`);
  }
});

test('Ebene 7 — der Vorschlag ist deterministisch und reagiert auf die Klimaachse', () => {
  const h = gelaende(1337);
  const a = B.biomeVorschlagen({ hoehe: h }, VW, MAP, { seed: 1337 });
  const b = B.biomeVorschlagen({ hoehe: h }, VW, MAP, { seed: 1337 });
  assert.deepEqual(JSON.stringify(a), JSON.stringify(b));
  const heiss = B.biomeVorschlagen({ hoehe: h }, VW, MAP,
    { seed: 1337, klima: { grund: 0.95, staerke: 0.1 } });
  const kalt = B.biomeVorschlagen({ hoehe: h }, VW, MAP,
    { seed: 1337, klima: { grund: 0.05, staerke: 0.1 } });
  const namen = (v) => new Set(v.map(q => q.biom));
  const warmArten = namen(heiss), kaltArten = namen(kalt);
  assert.notDeepEqual([...warmArten].sort(), [...kaltArten].sort());
  assert.ok(kaltArten.has('eis') || kaltArten.has('tundra'),
    `kaltes Klima ohne Eis/Tundra: ${[...kaltArten]}`);
  assert.ok(warmArten.has('wueste') || warmArten.has('salzwueste') ||
    warmArten.has('regenwald') || warmArten.has('korallenbank'),
    `heisses Klima ohne heisses Biom: ${[...warmArten]}`);
});

test('Ebene 7 — ein mitgeliefertes Abflussfeld wird benutzt, fehlt es, geht es auch ohne', () => {
  const h = gelaende(1337);
  const ohne = B.biomeVorschlagen({ hoehe: h }, VW, MAP, { seed: 1337 });
  // Sehr nasses Abflussfeld: die Feuchte muss sichtbar steigen.
  const abfluss = new Float32Array(N).fill(500);
  const nass = B.biomeVorschlagen({ hoehe: h, abfluss }, VW, MAP, { seed: 1337 });
  assert.ok(ohne.length > 0 && nass.length > 0);
  const feucht = new Set(['moor', 'sumpf', 'regenwald', 'nebelwald', 'mangrove', 'bluetental']);
  const anteil = (v) => v.filter(q => feucht.has(q.biom)).reduce((a, q) => a + q.zellen, 0);
  assert.ok(anteil(nass) > anteil(ohne),
    `Abfluss ohne Wirkung: ${anteil(nass)} vs ${anteil(ohne)}`);
});

/* ==========================================================================
   7 — Mischcache
   ========================================================================== */

test('Ebene 7 — Stufe 0 ist die Basispalette, Stufe 15 die Flaechenpalette', () => {
  const basis = BIOME.wiese.terrain, flaech = BIOME.moor.terrain;
  const p0 = B.mischPalette('wiese', 'moor', 0);
  const p15 = B.mischPalette('wiese', 'moor', B.MISCH_STUFEN - 1);
  for (const k of Object.keys(basis)) {
    const a = basis[k], b = p0[k];
    if (a && typeof a.r === 'number') {
      assert.ok(Math.abs(a.r - b.r) < 1e-12 && Math.abs(a.g - b.g) < 1e-12 &&
        Math.abs(a.b - b.b) < 1e-12, `Stufe 0 weicht bei ${k} ab`);
    } else if (typeof a === 'number') {
      assert.equal(b, a, `Stufe 0 weicht bei ${k} ab`);
    }
  }
  for (const k of Object.keys(flaech)) {
    const a = flaech[k], b = p15[k];
    if (a && typeof a.r === 'number') {
      assert.ok(Math.abs(a.r - b.r) < 1e-12 && Math.abs(a.g - b.g) < 1e-12 &&
        Math.abs(a.b - b.b) < 1e-12, `Stufe 15 weicht bei ${k} ab`);
    } else if (typeof a === 'number') {
      assert.equal(b, a, `Stufe 15 weicht bei ${k} ab`);
    }
  }
});

test('Ebene 7 — die Stufen dazwischen sind monoton', () => {
  const paare = [['wiese', 'moor'], ['salzwueste', 'vulkan'], ['eis', 'regenwald'],
    ['kueste', 'klippenmeer'], ['wueste', 'schnee']];
  for (const [a, b] of paare) {
    const stufen = [];
    for (let s = 0; s < B.MISCH_STUFEN; s++) stufen.push(B.mischPalette(a, b, s));
    for (const k of Object.keys(stufen[0])) {
      const v0 = stufen[0][k], v15 = stufen[B.MISCH_STUFEN - 1][k];
      if (v0 && typeof v0.r === 'number' && v15 && typeof v15.r === 'number') {
        for (const ch of ['r', 'g', 'b']) {
          const richtung = Math.sign(v15[ch] - v0[ch]);
          for (let s = 1; s < B.MISCH_STUFEN; s++) {
            const d = stufen[s][k][ch] - stufen[s - 1][k][ch];
            assert.ok(Math.sign(d) === richtung || Math.abs(d) < 1e-12,
              `${a}->${b} ${k}.${ch} nicht monoton bei Stufe ${s}`);
          }
        }
      } else if (typeof v0 === 'number' && typeof v15 === 'number') {
        const richtung = Math.sign(v15 - v0);
        for (let s = 1; s < B.MISCH_STUFEN; s++) {
          const d = stufen[s][k] - stufen[s - 1][k];
          assert.ok(Math.sign(d) === richtung || Math.abs(d) < 1e-12,
            `${a}->${b} ${k} nicht monoton bei Stufe ${s}`);
        }
      }
    }
  }
});

test('Ebene 7 — keine Palettenstufe enthaelt undefined', () => {
  // In Runde G stand genau dieser Fehler in einer Palettenrampe.
  const N_B = B.BIOM_ANZAHL;
  for (let a = 0; a < N_B; a++) {
    for (let b = 0; b < N_B; b++) {
      for (const s of [0, 1, 7, 14, 15]) {
        const p = B.mischPalette(a, b, s);
        for (const k of Object.keys(p)) {
          assert.notEqual(p[k], undefined,
            `${B.BIOM_NAMEN[a]}->${B.BIOM_NAMEN[b]} Stufe ${s}: ${k} ist undefined`);
        }
        // jeder Schluessel, den terrainColor liest, muss da sein
        for (const k of ['grasKuehl', 'grasWarm', 'grasTrocken', 'erde', 'fels',
          'schnee', 'sand', 'seegrund', 'tiefe', 'tritt', 'brandung',
          'driftGelb', 'driftBlau', 'sandA', 'sandB', 'saumSand', 'felsA',
          'felsB', 'saumFels', 'schneeA', 'schneeB', 'saumSchnee', 'oase',
          'brandungA', 'brandungB', 'brandungStaerke']) {
          assert.ok(k in p, `${B.BIOM_NAMEN[a]}->${B.BIOM_NAMEN[b]}: ${k} fehlt`);
          assert.notEqual(p[k], undefined);
        }
        for (const k of Object.keys(p)) {
          const v = p[k];
          if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k} ist NaN`);
          if (v && typeof v.r === 'number') {
            assert.ok(Number.isFinite(v.r) && Number.isFinite(v.g) && Number.isFinite(v.b),
              `${k} hat NaN-Kanal`);
          }
        }
      }
    }
  }
});

test('Ebene 7 — der Cache liefert dieselbe Instanz und cacheLeeren wirkt', () => {
  B.cacheLeeren();
  assert.equal(B.mischCacheGroesse(), 0);
  const a = B.mischPalette('wiese', 'moor', 7);
  const b = B.mischPalette('wiese', 'moor', 7);
  assert.equal(a, b, 'zweiter Aufruf baut die Palette neu');
  assert.equal(B.mischCacheGroesse(), 1);
  B.mischPalette('wiese', 'moor', 8);
  assert.equal(B.mischCacheGroesse(), 2);
  B.cacheLeeren();
  assert.equal(B.mischCacheGroesse(), 0);
  const c = B.mischPalette('wiese', 'moor', 7);
  assert.notEqual(c, a, 'cacheLeeren hat den Eintrag nicht verworfen');
  assert.deepEqual(c.sandA, a.sandA);
});

test('Ebene 7 — mischStufe bildet 0..255 sauber auf 0..15 ab', () => {
  assert.equal(B.mischStufe(0), 0);
  assert.equal(B.mischStufe(255), B.MISCH_STUFEN - 1);
  let letzte = -1;
  for (let g = 0; g <= 255; g++) {
    const s = B.mischStufe(g);
    assert.ok(s >= 0 && s < B.MISCH_STUFEN, `Stufe ${s} ausserhalb`);
    assert.ok(s >= letzte, 'mischStufe ist nicht monoton');
    letzte = s;
  }
});

/* ==========================================================================
   8 — Biom-LUT
   ========================================================================== */

test('Ebene 7 — die LUT hat je Biom eine Zeile, keine NaN, Werte im Bereich', () => {
  for (const spalten of [4, 8]) {
    const lut = B.biomLutDaten({ spalten });
    const fmt = B.biomLutFormat({ spalten });
    assert.equal(lut.length, B.BIOM_ANZAHL * spalten);
    assert.equal(fmt.zeilen, B.BIOM_ANZAHL);
    assert.equal(fmt.namen.length, spalten);
    assert.deepEqual(fmt.reihenfolge, B.BIOM_NAMEN);
    for (let i = 0; i < lut.length; i++) assert.ok(Number.isFinite(lut[i]), `NaN an ${i}`);
    for (let r = 0; r < B.BIOM_ANZAHL; r++) {
      const o = r * spalten, name = B.BIOM_NAMEN[r];
      for (let c = 0; c < 4; c++) {
        assert.ok(lut[o + c] >= 0 && lut[o + c] <= 1,
          `${name}.${fmt.namen[c]} = ${lut[o + c]} ausserhalb 0..1`);
      }
      // Gegenprobe gegen die Registry. Math.fround, weil die LUT ein
      // Float32Array ist: 0.7 liegt dort als 0.699999988079071.
      const b = BIOME[name];
      assert.equal(lut[o], Math.fround(b.schnee ? b.schnee.auflage : 0));
      assert.equal(lut[o + 3], Math.fround(b.vfx ? b.vfx.dichte : 0));
      if (spalten === 8) {
        assert.ok(lut[o + 4] <= lut[o + 5], `${name}: Schneekante verkehrt herum`);
        assert.ok(lut[o + 6] <= lut[o + 7], `${name}: Schneehoehenband verkehrt herum`);
      }
    }
  }
});

test('Ebene 7 — mindestens ein Biom traegt Schnee und mindestens eines Partikel', () => {
  const lut = B.biomLutDaten();
  let schnee = 0, partikel = 0;
  for (let r = 0; r < B.BIOM_ANZAHL; r++) {
    if (lut[r * 4] > 0) schnee++;
    if (lut[r * 4 + 3] > 0) partikel++;
  }
  assert.ok(schnee >= 3, `nur ${schnee} Biome mit Schneeauflage`);
  assert.ok(partikel >= 8, `nur ${partikel} Biome mit Partikeln`);
});

/* ==========================================================================
   Nebenzusagen des Index
   ========================================================================== */

test('Ebene 7 — biomIndex/biomName sind zueinander invers', () => {
  for (let i = 0; i < B.BIOM_ANZAHL; i++) {
    assert.equal(B.biomIndex(B.biomName(i)), i);
  }
  for (const n of Object.keys(BIOME)) assert.equal(B.biomName(B.biomIndex(n)), n);
  assert.equal(B.biomIndex('gibtesnicht'), B.BIOM_KEINS);
  assert.equal(B.biomName(B.BIOM_KEINS), null);
  assert.equal(B.biomName(-1), null);
  // Der Index muss in ein Uint8-Feld passen, ohne mit dem Leerwert zu kollidieren.
  assert.ok(B.BIOM_ANZAHL < B.BIOM_KEINS);
});
