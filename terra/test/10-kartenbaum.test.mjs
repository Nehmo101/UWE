/* ==========================================================================
   Ebene 10 — Kartenbaum (I1, world/kartenbaum.js)

   Das Modul rechnet die Ebenen-Hierarchie: Massstab, Baum, abgeleitete Hoehen,
   Silhouette, Vererbung, Format v5. Es haengt an keinem Browser, an keinem
   THREE-Zeichenweg und an keinem globalen Zustand — Hoehenfelder kommen als
   Argument herein. Diese Ebene prueft das Modul deshalb EINZELN und baut sich
   ihr Elterngelaende selbst; genau das wird damit mitgeprueft.

   Geprueft werden neun Zusagen:
     1 Hoehengleichheit   ein gemeinsamer Punkt hat auf beiden Karten dieselbe
                          Hoehe — die Grobform bitgenau, das Ergebnis innerhalb
                          von HOEHEN_TOLERANZ
     2 ortsfestes Detail  Ausschnitt um eine Elternzelle verschoben ⇒ das Detail
                          wandert BITGLEICH mit, es wird nicht neu gewuerfelt
     3 Determinismus      zweimal ableiten ist bitgleich, zwei Seeds nicht
     4 keine Terrassen    die Kruemmung auf den Elternknotenlinien ist nicht
                          groesser als daneben (bilinear reisst diese Schranke
                          um vier Groessenordnungen)
     5 Baum-Invarianten   Zyklus abgelehnt, verwaistes Kind gerettet, Pfad zur
                          Wurzel, Kind nie groeber als Elternteil
     6 Vererbung          geerbt folgt, eigen nicht; Herkunft stimmt; drei Ebenen
     7 Format             v4 laedt als Wurzelkarte, v5 ist ein Fixpunkt,
                          kaputte Baeume scheitern atomar
     8 Handarbeit         Nachziehen behaelt sie, Neu ableiten verwirft sie
     9 Silhouette         1 innen, 0 weit aussen, Uebergang in der Sollbreite
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ladeTerra, TEST } from './hilfen/laden.mjs';

const K = await ladeTerra('world/kartenbaum.js');
const { fractal, clamp } = await ladeTerra('core/rng.js');

/* --- Ein Elterngelaende in der Groessenordnung von genBaseIn ---------------
   Amplitude 26, feine zweite Oktave, Randabbruch nach -22 — dieselben Zahlen
   wie HOEHEN_STANDARD in core/store.js. Bewusst hier gebaut und nicht aus
   terrain.js geholt: das Modul soll ohne die Weltmaschine pruefbar sein. */
function gelaende(seed, MAP) {
  const VW = MAP + 1, HALF = MAP / 2, h = new Float32Array(VW * VW);
  for (let j = 0; j < VW; j++) {
    for (let i = 0; i < VW; i++) {
      const x = i - HALF, z = j - HALF;
      let v = fractal(x * 0.006, z * 0.006, seed) * 26 - 6;
      v += (fractal(x * 0.03, z * 0.03, seed + 77) - 0.5) * 4;
      const d = Math.min(i, j, MAP - i, MAP - j);
      h[j * VW + i] = -22 + (v + 22) * clamp(d / 55, 0, 1);
    }
  }
  return h;
}

const E_MAP = 256, E_VW = E_MAP + 1, E_HALF = E_MAP / 2;
const ELTERN = gelaende(4711, E_MAP);
/* Zoom 8: Kind 256er Gitter auf 32 Elternzellen. Der Rahmen liegt auf ganzen
   Elternzellen und die Seite ist eine Zweierpotenz — genau die Bedingung, unter
   der jeder Elternknoten exakt auf einem Kindknoten liegt. */
const RAHMEN = { x0: -32, z0: -16, seite: 32 };
const K_MAP = 256, K_VW = K_MAP + 1, ZOOM = K_MAP / RAHMEN.seite;

function ableiten(opt) {
  return K.leiteHoehenAb(ELTERN, Object.assign({
    elternVW: E_VW, elternMAP: E_MAP, rahmen: RAHMEN,
    VW: K_VW, MAP: K_MAP, seed: 99
  }, opt || {}));
}

/* ==========================================================================
   0 — Massstab: eine Zahl, keine Schublade
   ========================================================================== */

test('Ebene 10 — der Massstab rechnet in beide Richtungen und benennt sich', () => {
  assert.equal(K.kanteInMetern(1024, 250), 256000);
  assert.equal(K.einheitFuerKante(1024, 256000), 250);
  assert.equal(K.weltZuMeter(4, 25), 100);
  assert.equal(K.meterZuWelt(100, 25), 4);
  assert.equal(K.massstabName(1), 'ort');
  assert.equal(K.massstabName(25), 'landschaft');
  assert.equal(K.massstabName(250), 'region');
  assert.equal(K.massstabName(2000), 'kontinent');
  // Ein Zwischenwert bekommt einen Namen und keine Fehlermeldung — 8 m/Zelle
  // ist eine gueltige Karte, keine Schublade.
  assert.equal(K.massstabName(8), 'landschaft');
  // Ausserhalb der Leiter faellt der Name auf die Enden, statt undefined zu sein.
  assert.equal(K.massstabName(0.05), 'ort');
  assert.equal(K.massstabName(99999), 'kontinent');
  // Lage IM Band logarithmisch: zwischen 60 und 600 liegt die Mitte bei ~190.
  const info = K.massstabInfo(Math.sqrt(60 * 600));
  assert.equal(info.name, 'region');
  assert.ok(Math.abs(info.t - 0.5) < 1e-12, 't = ' + info.t);
});

/* ==========================================================================
   1 — Hoehengleichheit: DIE zentrale Zusage

   Ein Punkt, den beide Karten zeigen, muss dort dieselbe Hoehe haben. Die
   Pruefung zerlegt das in zwei Haelften, weil beide getrennt kaputtgehen
   koennen:
     a) die GROBFORM ist an einem gemeinsamen Knoten BITGENAU der Elternwert.
        Das ist die Eigenschaft des interpolierenden Catmull-Rom-Kerns; eine
        approximierende Variante (B-Spline) waere hier sofort auffaellig.
     b) das FERTIGE Feld weicht um hoechstens HOEHEN_TOLERANZ ab. Das ist die
        Detailamplitude, und sie ist hart gedeckelt.
   ========================================================================== */

/** Alle Punkte, die auf Eltern- und Kindgitter zugleich liegen. */
function gemeinsamePunkte() {
  const paare = [];
  for (let j = 0; j <= RAHMEN.seite; j++) {
    for (let i = 0; i <= RAHMEN.seite; i++) {
      const px = RAHMEN.x0 + i, pz = RAHMEN.z0 + j;
      paare.push({
        eltern: ELTERN[(pz + E_HALF) * E_VW + (px + E_HALF)],
        kindIndex: (j * ZOOM) * K_VW + i * ZOOM
      });
    }
  }
  return paare;
}

test('Ebene 10 — die Grobform trifft an gemeinsamen Punkten bitgenau die Elternhoehe', () => {
  const grob = ableiten({ detailStaerke: 0 });
  const paare = gemeinsamePunkte();
  assert.equal(paare.length, 33 * 33);
  let abweichend = 0;
  for (const p of paare) if (grob.hoehen[p.kindIndex] !== p.eltern) abweichend++;
  assert.equal(abweichend, 0,
    abweichend + ' von ' + paare.length + ' gemeinsamen Punkten weichen ab — '
    + 'die Interpolation ist nicht mehr interpolierend');
});

test('Ebene 10 — das fertige Kindgelaende bleibt in der Hoehentoleranz', () => {
  const ab = ableiten();
  assert.ok(ab.oktaven > 0, 'ohne Detailoktaven prueft dieser Fall nichts');
  let max = 0, quadrate = 0;
  const paare = gemeinsamePunkte();
  for (const p of paare) {
    const d = Math.abs(ab.hoehen[p.kindIndex] - p.eltern);
    if (d > max) max = d;
    quadrate += d * d;
  }
  const rms = Math.sqrt(quadrate / paare.length);
  assert.ok(max <= K.HOEHEN_TOLERANZ,
    'groesste Abweichung ' + max.toFixed(4) + ' > Toleranz ' + K.HOEHEN_TOLERANZ);
  // Die zweite, schaerfere Schranke: das Modul sagt selbst, wie gross sein
  // Detail geworden ist, und mehr darf die Abweichung nicht sein.
  assert.ok(max <= ab.detailMax + 1e-6,
    'Abweichung ' + max.toFixed(4) + ' groesser als das gemeldete Detail ' + ab.detailMax.toFixed(4));
  // Gemessen (Seed 4711, Zoom 8): max 0.155, RMS 0.035 bei einer Reliefspanne
  // von 4.0 Welteinheiten im Ausschnitt — also 3.9 % bzw. 0.9 %. Die Schranke
  // ist grosszuegig gewaehlt, damit sie an einem anderen Gelaende nicht
  // zufaellig reisst.
  assert.ok(rms < 0.25, 'RMS ' + rms.toFixed(4) + ' — das Detail uebertoent die Grobform');
});

test('Ebene 10 — ohne Vergroesserung entsteht kein Detail', () => {
  /* Zoom 1 heisst: es gibt keine neue Information. Sie trotzdem zu erfinden
     waere genau die Luege, die dieses Modul verhindern soll. */
  const eins = K.leiteHoehenAb(ELTERN, {
    elternVW: E_VW, elternMAP: E_MAP, rahmen: { x0: -128, z0: -128, seite: 256 },
    VW: E_VW, MAP: E_MAP, seed: 99
  });
  assert.equal(eins.zoom, 1);
  assert.equal(eins.oktaven, 0);
  assert.equal(eins.detailMax, 0);
  for (let i = 0; i < E_VW * E_VW; i++) {
    if (eins.hoehen[i] !== ELTERN[i]) assert.fail('Zoom 1 hat das Feld an Index ' + i + ' veraendert');
  }
});

/* ==========================================================================
   2 — Ortsfestes Detail

   Der Ausschnitt wandert um EINE Elternzelle nach rechts. Derselbe Weltpunkt
   liegt danach auf einem um ZOOM Spalten versetzten Kindindex — und muss
   dort denselben Wert tragen. Bitgleich, nicht ungefaehr: der Rahmenursprung
   ist ganzzahlig und die Seite eine Zweierpotenz, also sind alle
   Abtastpositionen dyadische Brueche und in Gleitkomma exakt.

   Eine naive Umsetzung wuerfelt das Detail ueber den Kindgitterindex. Die
   faellt hier durch, weil dann das gesamte Detail um ZOOM Spalten falsch liegt.
   ========================================================================== */

test('Ebene 10 — ein verschobener Ausschnitt nimmt sein Detail bitgleich mit', () => {
  const a = ableiten();
  const b = K.leiteHoehenAb(ELTERN, {
    elternVW: E_VW, elternMAP: E_MAP,
    rahmen: { x0: RAHMEN.x0 + 1, z0: RAHMEN.z0, seite: RAHMEN.seite },
    VW: K_VW, MAP: K_MAP, seed: 99
  });
  let geprueft = 0, abweichend = 0, maxD = 0;
  for (let j = 0; j < K_VW; j++) {
    for (let i = ZOOM; i < K_VW; i++) {
      const va = a.hoehen[j * K_VW + i], vb = b.hoehen[j * K_VW + i - ZOOM];
      geprueft++;
      if (va !== vb) { abweichend++; maxD = Math.max(maxD, Math.abs(va - vb)); }
    }
  }
  assert.ok(geprueft > 60000, 'zu wenige Vergleichspunkte: ' + geprueft);
  assert.equal(abweichend, 0,
    abweichend + ' von ' + geprueft + ' Punkten wandern nicht mit (groesste Abweichung '
    + maxD + ') — das Detail haengt am Gitterindex statt am Ort');
});

test('Ebene 10 — die Gegenprobe: ortsfest heisst nicht "ueberall gleich"', () => {
  /* Ohne diese Gegenprobe waere die Pruefung oben auch dann gruen, wenn das
     Detail konstant null waere. */
  const a = ableiten();
  let verschieden = 0;
  for (let i = 1; i < K_VW * K_VW; i++) if (a.hoehen[i] !== a.hoehen[i - 1]) verschieden++;
  assert.ok(verschieden > K_VW * K_VW * 0.9, 'das Feld ist praktisch konstant');
  assert.ok(a.detailMax > 0.01, 'detailMax = ' + a.detailMax + ' — es gibt gar kein Detail');
});

/* ==========================================================================
   3 — Determinismus
   ========================================================================== */

test('Ebene 10 — zweimal ableiten ergibt bitgleiche Felder', () => {
  const a = ableiten(), b = ableiten();
  assert.equal(a.hoehen.length, b.hoehen.length);
  for (let i = 0; i < a.hoehen.length; i++) {
    if (a.hoehen[i] !== b.hoehen[i]) assert.fail('Index ' + i + ': ' + a.hoehen[i] + ' != ' + b.hoehen[i]);
  }
  assert.equal(a.detailMax, b.detailMax);
});

test('Ebene 10 — zwei Seeds ergeben verschiedenes Detail, aber dieselbe Grobform', () => {
  const a = ableiten({ seed: 99 }), b = ableiten({ seed: 100 });
  let verschieden = 0;
  for (let i = 0; i < a.hoehen.length; i++) if (a.hoehen[i] !== b.hoehen[i]) verschieden++;
  assert.ok(verschieden > a.hoehen.length * 0.9,
    'nur ' + verschieden + ' Zellen unterscheiden sich — der Seed wirkt kaum');
  // Die Grobform darf am Seed NICHT haengen: sie kommt allein aus dem Elternfeld.
  const ga = ableiten({ seed: 99, detailStaerke: 0 });
  const gb = ableiten({ seed: 100, detailStaerke: 0 });
  for (let i = 0; i < ga.hoehen.length; i++) {
    if (ga.hoehen[i] !== gb.hoehen[i]) assert.fail('die Grobform haengt am Seed (Index ' + i + ')');
  }
});

test('Ebene 10 — ein anderes Elterngelaende ergibt ein anderes Kind', () => {
  const anders = gelaende(4712, E_MAP);
  const a = ableiten();
  const b = K.leiteHoehenAb(anders, {
    elternVW: E_VW, elternMAP: E_MAP, rahmen: RAHMEN, VW: K_VW, MAP: K_MAP, seed: 99
  });
  let verschieden = 0;
  for (let i = 0; i < a.hoehen.length; i++) if (a.hoehen[i] !== b.hoehen[i]) verschieden++;
  assert.ok(verschieden > a.hoehen.length * 0.9, 'die Ableitung liest das Elternfeld kaum');
});

/* ==========================================================================
   4 — Keine Terrassen

   Bilineare Interpolation ist C0: innerhalb einer Elternzelle ist das Feld
   entlang jeder Achse eine Gerade, die gesamte Kruemmung sitzt auf den
   Zellgrenzen. Genau das sind die Terrassen und Rautenmuster.

   Das Mass ist deshalb ein VERHAELTNIS, kein Absolutwert: mittlerer Betrag des
   Fuenf-Punkte-Laplace AUF den Elternknotenlinien geteilt durch denselben Wert
   DANEBEN. Ein glattes Feld liegt bei 1. Ein Absolutwert waere von der
   Reliefhoehe abhaengig und damit kein Massstab.
   ========================================================================== */

function knotenlinienVerhaeltnis(feld, VW, zoom) {
  let auf = 0, nAuf = 0, neben = 0, nNeben = 0;
  for (let j = 1; j < VW - 1; j++) {
    for (let i = 1; i < VW - 1; i++) {
      const k = j * VW + i;
      const L = Math.abs(feld[k - 1] + feld[k + 1] + feld[k - VW] + feld[k + VW] - 4 * feld[k]);
      if (i % zoom === 0 || j % zoom === 0) { auf += L; nAuf++; } else { neben += L; nNeben++; }
    }
  }
  return (auf / nAuf) / ((neben / nNeben) || Number.MIN_VALUE);
}

test('Ebene 10 — die abgeleitete Grobform zeigt keine Kruemmung auf dem Elterngitter', () => {
  const kubisch = ableiten({ detailStaerke: 0 });
  const bilinear = ableiten({ detailStaerke: 0, interpolation: 'bilinear' });
  const vK = knotenlinienVerhaeltnis(kubisch.hoehen, K_VW, ZOOM);
  const vB = knotenlinienVerhaeltnis(bilinear.hoehen, K_VW, ZOOM);
  // Die Gegenprobe steht zuerst: ohne sie waere unklar, ob das Mass ueberhaupt
  // etwas misst. Bilinear reisst die Schranke um Groessenordnungen.
  assert.ok(vB > 50, 'die bilineare Gegenprobe liegt bei ' + vB.toFixed(2)
    + ' — das Mass erkennt Terrassen nicht mehr');
  assert.ok(vK < 1.5, 'Knotenlinien-Verhaeltnis ' + vK.toFixed(3)
    + ' — die Kruemmung sammelt sich auf dem Elterngitter (Terrassen)');
});

test('Ebene 10 — auch mit Detail bleibt das Elterngitter unsichtbar', () => {
  const voll = ableiten();
  const v = knotenlinienVerhaeltnis(voll.hoehen, K_VW, ZOOM);
  assert.ok(v < 1.5, 'Knotenlinien-Verhaeltnis mit Detail: ' + v.toFixed(3));
});

/* ==========================================================================
   5 — Baum-Invarianten
   ========================================================================== */

function karte(id, elternId, einheitMeter, extra) {
  return Object.assign({ id, elternId, titel: id, einheitMeter,
    kartenGroesse: 256, seed: 1, elemente: [], eigen: {} }, extra || {});
}

const BEISPIELBAUM = () => K.baueKartenbaum([
  karte('k0', null, 250),
  karte('k1', 'k0', 25),
  karte('k2', 'k1', 2),
  karte('k3', 'k0', 25)
]);

test('Ebene 10 — Pfad zur Wurzel, Kinder und Nachfahren stimmen', () => {
  const b = BEISPIELBAUM();
  assert.equal(b.wurzelId, 'k0');
  assert.deepEqual(K.pfadZurWurzel(b, 'k2'), ['k0', 'k1', 'k2']);
  assert.deepEqual(K.pfadZurWurzel(b, 'k0'), ['k0']);
  assert.deepEqual(K.pfadZurWurzel(b, 'gibtsnicht'), []);
  assert.deepEqual(K.kinderVon(b, 'k0'), ['k1', 'k3']);
  assert.deepEqual(K.nachfahren(b, 'k0'), ['k1', 'k2', 'k3']);
  assert.equal(K.knoten(b, 'k2').tiefe, 2);
  assert.ok(K.istVorfahr(b, 'k0', 'k2'));
  assert.ok(!K.istVorfahr(b, 'k2', 'k0'));
  assert.ok(!K.istVorfahr(b, 'k1', 'k1'), 'eine Karte ist nicht ihr eigener Vorfahr');
  assert.equal(b.warnungen.length, 0);
});

test('Ebene 10 — ein Zyklus wird abgelehnt', () => {
  assert.throws(() => K.baueKartenbaum([
    karte('k0', null, 250), karte('k1', 'k2', 25), karte('k2', 'k1', 2)
  ]), /Zyklus/);
  // Auch der Fall ohne jeden wurzelfaehigen Knoten muss auffliegen.
  assert.throws(() => K.baueKartenbaum([
    karte('a', 'b', 10), karte('b', 'a', 10)
  ]), /Zyklus/);
  // Und der Wechsel, der erst einen Zyklus ERZEUGEN wuerde.
  const b = BEISPIELBAUM();
  assert.throws(() => K.pruefeElternWechsel(b, 'k0', 'k2'), /Zyklus/);
  assert.throws(() => K.pruefeElternWechsel(b, 'k1', 'k1'), /eigenes Elternteil/);
  assert.equal(K.pruefeElternWechsel(b, 'k2', 'k3'), true);
});

test('Ebene 10 — doppelte Kennungen werden abgelehnt', () => {
  assert.throws(() => K.baueKartenbaum([
    karte('k0', null, 250), karte('k1', 'k0', 25), karte('k1', 'k0', 25)
  ]), /doppelt/);
});

test('Ebene 10 — ein Kind darf nicht groeber sein als sein Elternteil', () => {
  assert.throws(() => K.baueKartenbaum([
    karte('k0', null, 25), karte('k1', 'k0', 250)
  ]), /groeber/);
  // Gleich fein ist erlaubt (ein Beiblatt desselben Massstabs).
  assert.doesNotThrow(() => K.baueKartenbaum([karte('k0', null, 25), karte('k1', 'k0', 25)]));
  // k3 ist mit 25 m/Zelle groeber als k2 mit 2 — und liegt NICHT ueber k2, der
  // Zyklustest darf hier also nicht zuerst zuschlagen.
  const b = BEISPIELBAUM();
  assert.throws(() => K.pruefeElternWechsel(b, 'k3', 'k2'), /groeber/);
});

test('Ebene 10 — eine verwaiste Karte laesst die Datei NICHT scheitern', () => {
  /* Entscheidung des Moduls: ein Elternverweis ins Leere ist eine LUECKE, kein
     Widerspruch. Die Karte haengt sich an die Wurzel, wird als verwaist
     markiert, verliert Ausschnitt und Ableitung — und bleibt erreichbar. */
  const b = K.baueKartenbaum([
    karte('k0', null, 250),
    karte('k1', 'k0', 25),
    karte('kx', 'weg', 2, { ausschnitt: [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 0, z: 4 }],
      hoehenQuelle: 'abgeleitet' })
  ]);
  assert.equal(b.ordnung.length, 3, 'die verwaiste Karte ist nicht erreichbar');
  assert.equal(K.knoten(b, 'kx').elternId, 'k0');
  assert.equal(K.knoten(b, 'kx').verwaist, true);
  assert.equal(b.warnungen.filter(w => w.art === 'verwaist').length, 1);
  // Der Eingabesatz bleibt unangetastet — repariert wird nur der Knoten.
  assert.equal(b.karten[2].elternId, 'weg');
  // Beim Festschreiben wird die Reparatur uebernommen und der sinnlos gewordene
  // Ausschnitt faellt weg (er ist in Koordinaten einer Karte formuliert, die es
  // nicht gibt).
  const datei = K.schreibeBaumDatei(b);
  const kx = datei.karten.find(k => k.id === 'kx');
  assert.equal(kx.elternId, 'k0');
  assert.equal(kx.ausschnitt, undefined);
  assert.equal(kx.hoehenQuelle, 'eigen');
  // Ein zweites Laden meldet nichts mehr.
  assert.equal(K.leseBaumDatei(datei).warnungen.length, 0);
});

test('Ebene 10 — die Massstabspruefung gilt fuer verwaiste Karten nicht', () => {
  /* Ihre Elternschaft ist ersatzweise; ein Massstabsvergleich gegen eine Wurzel,
     mit der sie nie etwas zu tun hatte, wuerde die Datei grundlos ablehnen. */
  assert.doesNotThrow(() => K.baueKartenbaum([
    karte('k0', null, 1), karte('kx', 'weg', 2000)
  ]));
});

test('Ebene 10 — mitKarte und ohneKarte lassen den alten Baum unangetastet', () => {
  const b = BEISPIELBAUM();
  const c = K.mitKarte(b, karte('k9', 'k2', 1));
  assert.equal(b.ordnung.length, 4);
  assert.equal(c.ordnung.length, 5);
  const d = K.ohneKarte(c, 'k1');
  assert.deepEqual(d.ordnung, ['k0', 'k3'], 'k2 und k9 haetten mitgehen muessen');
  assert.throws(() => K.ohneKarte(b, 'k0'), /Wurzelkarte/);
});

/* ==========================================================================
   6 — Anlegen einer Kindkarte aus einem Polygon
   ========================================================================== */

test('Ebene 10 — legeKindkarteAn rechnet Rahmen, Zoom und Massstab aus', () => {
  const b = K.baueKartenbaum([Object.assign(karte('k0', null, 250), { kartenGroesse: 256, seed: 4711 })]);
  const poly = [{ x: -30, z: -14 }, { x: -6, z: -16 }, { x: -4, z: 8 }, { x: -28, z: 6 }];
  const kind = K.legeKindkarteAn(b, 'k0', poly, { titel: 'Talgrund' });
  assert.equal(kind.elternId, 'k0');
  assert.equal(kind.titel, 'Talgrund');
  assert.equal(kind.hoehenQuelle, 'abgeleitet');
  // Polygon 26x24 plus 2x2 Rand ⇒ 30 Elternzellen. Groesste Zweierpotenz mit
  // 256/zoom >= 30 ist zoom 8, also seite 32.
  assert.equal(kind.rahmen.seite, 32);
  assert.equal(kind.einheitMeter, 250 / 8);
  assert.equal(K.massstabName(kind.einheitMeter), 'landschaft');
  // Der Rahmen faellt auf ganze Elternzellen und umschliesst das Polygon.
  assert.equal(kind.rahmen.x0, Math.round(kind.rahmen.x0));
  assert.ok(kind.rahmen.x0 <= -30 && kind.rahmen.x0 + 32 >= -4);
  // Zweimal anlegen ergibt denselben Seed — er haengt am Ort, nicht an einem
  // Zaehler, der in keiner Datei steht.
  assert.equal(K.legeKindkarteAn(b, 'k0', poly).seed, kind.seed);
  // Ein Ausschnitt, der die ganze Karte umfasst, kann nicht feiner werden.
  const gross = [{ x: -128, z: -128 }, { x: 128, z: -128 }, { x: 128, z: 128 }, { x: -128, z: 128 }];
  const flach = K.legeKindkarteAn(b, 'k0', gross);
  assert.equal(flach.rahmen.seite, 256);
  assert.equal(flach.einheitMeter, 250);
  // …und der Baum nimmt ihn an, weil "gleich fein" erlaubt ist.
  assert.doesNotThrow(() => K.mitKarte(b, flach));
});

test('Ebene 10 — der Rahmen wird in die Elternkarte hineingeschoben', () => {
  const b = K.baueKartenbaum([karte('k0', null, 250)]);
  const eck = [{ x: -128, z: -128 }, { x: -110, z: -128 }, { x: -110, z: -110 }];
  const kind = K.legeKindkarteAn(b, 'k0', eck);
  assert.ok(kind.rahmen.x0 >= -128, 'x0 = ' + kind.rahmen.x0 + ' liegt ausserhalb der Elternkarte');
  assert.ok(kind.rahmen.z0 >= -128);
  assert.ok(kind.rahmen.x0 + kind.rahmen.seite <= 128);
});

/* ==========================================================================
   7 — Vererbung
   ========================================================================== */

test('Ebene 10 — geerbte Felder folgen dem Elternteil, ueberschriebene nicht', () => {
  const wurzel = karte('k0', null, 250, { eigen: { biom: 'schnee', wetter: 'sturm' } });
  const kind = karte('k1', 'k0', 25, { eigen: { wetter: 'klar' } });
  const b = K.baueKartenbaum([wurzel, kind]);

  const geerbt = K.loeseFeld(b, 'k1', 'biom');
  assert.equal(geerbt.wert, 'schnee');
  assert.equal(geerbt.geerbt, true);
  assert.equal(geerbt.quelleId, 'k0');
  assert.equal(geerbt.stufen, 1);

  const eigen = K.loeseFeld(b, 'k1', 'wetter');
  assert.equal(eigen.wert, 'klar');
  assert.equal(eigen.geerbt, false);
  assert.equal(eigen.quelleId, 'k1');
  assert.equal(eigen.stufen, 0);

  // Elternteil aendern ⇒ das geerbte Feld folgt, das eigene bleibt.
  K.setzeEigen(wurzel, 'biom', 'moor');
  K.setzeEigen(wurzel, 'wetter', 'regen');
  assert.equal(K.loeseFeld(b, 'k1', 'biom').wert, 'moor');
  assert.equal(K.loeseFeld(b, 'k1', 'wetter').wert, 'klar');

  // Zuruecknehmen ⇒ das Feld erbt wieder.
  K.erbeWieder(kind, 'wetter');
  const zurueck = K.loeseFeld(b, 'k1', 'wetter');
  assert.equal(zurueck.wert, 'regen');
  assert.equal(zurueck.geerbt, true);
  assert.equal(zurueck.quelleTitel, 'k0');
});

test('Ebene 10 — eine Kette ueber drei Ebenen loest auf die naechste Quelle auf', () => {
  const b = K.baueKartenbaum([
    karte('k0', null, 250, { eigen: { biom: 'schnee', tageszeit: 'nacht' } }),
    karte('k1', 'k0', 25, { eigen: { biom: 'moor' } }),
    karte('k2', 'k1', 2, {})
  ]);
  const biom = K.loeseFeld(b, 'k2', 'biom');
  assert.equal(biom.wert, 'moor');
  assert.equal(biom.quelleId, 'k1', 'die NAECHSTE Quelle gewinnt, nicht die Wurzel');
  assert.equal(biom.stufen, 1);
  const zeit = K.loeseFeld(b, 'k2', 'tageszeit');
  assert.equal(zeit.wert, 'nacht');
  assert.equal(zeit.quelleId, 'k0');
  assert.equal(zeit.stufen, 2);
});

test('Ebene 10 — ein Feld, das niemand setzt, faellt auf die Vorgabe', () => {
  const b = BEISPIELBAUM();
  const f = K.loeseFeld(b, 'k2', 'biom');
  assert.equal(f.wert, K.ERB_STANDARD.biom);
  assert.equal(f.quelleId, null);
  assert.equal(f.geerbt, true);
});

test('Ebene 10 — null ist ein Wert, kein "nicht gesetzt"', () => {
  /* farbskript: null heisst "diese Karte hat bewusst keines" und muss sich von
     "diese Karte erbt eines" unterscheiden — sonst schluepft das Farbskript der
     Elternkarte durch und verschiebt die Farben der ganzen Kindkarte. */
  const b = K.baueKartenbaum([
    karte('k0', null, 250, { eigen: { farbskript: { licht: 1, mitte: 2, schatten: 3, staerke: 0.5 } } }),
    karte('k1', 'k0', 25, { eigen: { farbskript: null } })
  ]);
  const f = K.loeseFeld(b, 'k1', 'farbskript');
  assert.equal(f.wert, null);
  assert.equal(f.geerbt, false);
  assert.equal(f.quelleId, 'k1');
});

test('Ebene 10 — nicht vererbte Felder und Tippfehler werden abgewiesen', () => {
  const k = karte('k1', 'k0', 25);
  assert.throws(() => K.setzeEigen(k, 'kartenGroesse', 512), /wird nicht vererbt/);
  assert.throws(() => K.setzeEigen(k, 'elemente', []), /wird nicht vererbt/);
  assert.throws(() => K.setzeEigen(k, 'biiom', 'moor'), /kein Erbfeld/);
  const b = BEISPIELBAUM();
  assert.throws(() => K.loeseFeld(b, 'k1', 'kartenGroesse'), /kein Erbfeld/);
  assert.throws(() => K.loeseFeld(b, 'gibtsnicht', 'biom'), /Unbekannte Karte/);
});

test('Ebene 10 — loeseFelder und erbWerte decken die ganze Liste ab', () => {
  const b = K.baueKartenbaum([
    karte('k0', null, 250, { eigen: { biom: 'schnee' } }),
    karte('k1', 'k0', 25)
  ]);
  const alle = K.loeseFelder(b, 'k1');
  assert.deepEqual(Object.keys(alle).sort(), K.ERBFELDER.slice().sort());
  assert.equal(alle.biom.quelleId, 'k0');
  assert.equal(K.erbWerte(b, 'k1').biom, 'schnee');
  assert.equal(K.erbWerte(b, 'k1').wetter, K.ERB_STANDARD.wetter);
});

/* ==========================================================================
   8 — Handarbeit: Nachziehen behaelt sie, Neu ableiten verwirft sie
   ========================================================================== */

test('Ebene 10 — Nachziehen behaelt die Handarbeit, Neu ableiten verwirft sie', () => {
  const alt = ableiten();
  // Der Nutzer gräbt von Hand einen Graben.
  const bearbeitet = Float32Array.from(alt.hoehen);
  const stellen = [];
  for (let j = 100; j < 140; j++) {
    for (let i = 100; i < 140; i++) {
      const k = j * K_VW + i;
      bearbeitet[k] -= 3;
      stellen.push(k);
    }
  }
  const delta = K.handarbeitErmitteln(bearbeitet, alt.hoehen, K_VW * K_VW);
  assert.equal(delta.length, stellen.length * 2, 'die Handarbeit ist nicht vollstaendig erfasst');
  for (let q = 1; q < delta.length; q += 2) assert.equal(delta[q], -3);

  // Jetzt aendert sich die Elternkarte: der Berg wird um 5 angehoben.
  const gehoben = Float32Array.from(ELTERN);
  for (let i = 0; i < gehoben.length; i++) gehoben[i] += 5;
  const neu = K.leiteHoehenAb(gehoben, {
    elternVW: E_VW, elternMAP: E_MAP, rahmen: RAHMEN, VW: K_VW, MAP: K_MAP, seed: 99
  });

  // Nachziehen: neue Elternform, Handarbeit bleibt.
  const nachgezogen = K.hoehenNachziehen(neu.hoehen, delta);
  for (const k of stellen) {
    assert.ok(Math.abs(nachgezogen[k] - (neu.hoehen[k] - 3)) < 1e-4,
      'die Handarbeit ist beim Nachziehen verlorengegangen');
  }
  // …und die Anhebung der Elternkarte ist trotzdem angekommen.
  assert.ok(Math.abs(nachgezogen[stellen[0]] - bearbeitet[stellen[0]] - 5) < 1e-3,
    'die Elternaenderung ist nicht durchgeflossen');
  // Ausserhalb der Handarbeit ist das Feld genau die neue Ableitung.
  assert.equal(nachgezogen[0], neu.hoehen[0]);

  // Neu ableiten: Handarbeit weg.
  const frisch = K.hoehenNeuAbleiten(neu.hoehen);
  assert.deepEqual(frisch.delta, []);
  for (const k of stellen) assert.equal(frisch.hoehen[k], neu.hoehen[k]);
  // Die Ableitung selbst bleibt in beiden Faellen unangetastet — der Aufrufer
  // haelt sie oft noch als Vergleichsfeld.
  assert.notEqual(nachgezogen, neu.hoehen);
  assert.notEqual(frisch.hoehen, neu.hoehen);
});

test('Ebene 10 — die Handarbeit ist eine DIFFERENZ, kein Absolutwert', () => {
  /* Der Unterschied zum hoehenDelta der Wurzelkarte, und er ist der Grund,
     warum "Nachziehen" ueberhaupt funktioniert: stuenden dort absolute Hoehen,
     naegelte jede angefasste Zelle die alte Hoehe fest und die Handarbeit risse
     Loecher in den neuen Berg. */
  const basisA = new Float32Array([10, 10, 10, 10]);
  const bearbeitet = new Float32Array([10, 7, 10, 10]);
  const delta = K.handarbeitErmitteln(bearbeitet, basisA, 4);
  assert.deepEqual(Array.from(delta), [1, -3]);
  const basisB = new Float32Array([20, 20, 20, 20]);
  const gezogen = K.hoehenNachziehen(basisB, delta);
  assert.deepEqual(Array.from(gezogen), [20, 17, 20, 20]);
});

/* ==========================================================================
   9 — Silhouette
   ========================================================================== */

const SIL_POLY = [{ x: -28, z: -12 }, { x: -8, z: -14 }, { x: -6, z: 6 }, { x: -26, z: 8 }];

test('Ebene 10 — die Maske ist innen 1, weit aussen 0 und dazwischen weich', () => {
  const weich = 16;
  const m = K.silhouetteMaske(SIL_POLY, RAHMEN, K_VW, K_MAP, { weich });
  const gitter = (x, z) => {
    const p = K.elternZuKind(RAHMEN, K_MAP, x, z);
    return m[Math.round(p.j) * K_VW + Math.round(p.i)];
  };
  // Tief drinnen: exakt 1, nicht 0.999…
  assert.equal(gitter(-17, -3), 1);
  assert.equal(gitter(-20, 0), 1);
  // Weit draussen: exakt 0.
  assert.equal(m[0], 0);
  assert.equal(m[m.length - 1], 0);
  assert.equal(gitter(0, 0), 0);
  // Der Uebergang liegt an der Polygonkante und ist `weich` breit. Gemessen
  // wird entlang einer Zeile durch die Flaeche, in KINDzellen.
  const p0 = K.elternZuKind(RAHMEN, K_MAP, -28, -3);
  const zeile = Math.round(K.elternZuKind(RAHMEN, K_MAP, 0, -3).j) * K_VW;
  let ersteEins = -1;
  for (let i = 0; i < K_VW; i++) if (m[zeile + i] === 1) { ersteEins = i; break; }
  assert.ok(ersteEins > 0, 'die Zeile trifft die Flaeche gar nicht');
  let letzteNull = -1;
  for (let i = ersteEins; i >= 0; i--) if (m[zeile + i] === 0) { letzteNull = i; break; }
  const breite = ersteEins - letzteNull;
  // Die Chamfer-Distanz weicht unter 4 % von der euklidischen ab, und der
  // Uebergang wird auf ganze Zellen abgetastet — deshalb ein Fenster statt
  // einer Gleichheit.
  assert.ok(breite >= weich - 2 && breite <= weich + 4,
    'Uebergangsbreite ' + breite + ' Zellen statt ' + weich);
  // …und er liegt an der Kante des Polygons (x = -28 ⇒ Kindindex p0.i).
  assert.ok(Math.abs((letzteNull + ersteEins) / 2 - p0.i) < weich,
    'der Uebergang liegt nicht an der Polygonkante');
});

test('Ebene 10 — die Maske ist deterministisch und monoton in der Weichheit', () => {
  const a = K.silhouetteMaske(SIL_POLY, RAHMEN, K_VW, K_MAP, { weich: 16 });
  const b = K.silhouetteMaske(SIL_POLY, RAHMEN, K_VW, K_MAP, { weich: 16 });
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) assert.fail('Index ' + i);
  // Ein weicherer Rand hat mehr Zwischenwerte, aber denselben Kern.
  const c = K.silhouetteMaske(SIL_POLY, RAHMEN, K_VW, K_MAP, { weich: 40 });
  const zwischenA = a.reduce((n, v) => n + (v > 0 && v < 1 ? 1 : 0), 0);
  const zwischenC = c.reduce((n, v) => n + (v > 0 && v < 1 ? 1 : 0), 0);
  assert.ok(zwischenC > zwischenA * 1.5, zwischenA + ' vs ' + zwischenC);
  // Alle Werte liegen in [0,1] — eine Maske ausserhalb davon zerstoerte jede
  // Ueberblendung, die sie spaeter benutzt.
  for (let i = 0; i < c.length; i++) {
    if (!(c[i] >= 0 && c[i] <= 1)) assert.fail('Maskenwert ' + c[i] + ' an Index ' + i);
  }
});

/* ==========================================================================
   10 — Elternelemente als Vorlage
   ========================================================================== */

test('Ebene 10 — Elternelemente erscheinen als Vorlage in Kindkoordinaten', () => {
  const wurzel = karte('k0', null, 250, { kartenGroesse: 256, elemente: [
    // Liegt mitten im Ausschnitt (RAHMEN -32..0 / -16..16).
    { id: 1, kind: 'flaeche', variant: 'wald', points: [{ x: -24, z: -8 }, { x: -12, z: -8 }, { x: -12, z: 4 }] },
    // Liegt weit ausserhalb.
    { id: 2, kind: 'flaeche', variant: 'wald', points: [{ x: 90, z: 90 }, { x: 100, z: 90 }, { x: 100, z: 100 }] },
    // Streift den Ausschnitt nur — ein Punkt drin, einer weit draussen.
    { id: 3, kind: 'pfad', variant: 'weg', points: [{ x: -10, z: 0 }, { x: 40, z: 0 }] }
  ] });
  const kind = karte('k1', 'k0', 250 / 8, {
    rahmen: { x0: -32, z0: -16, seite: 32 },
    ausschnitt: [{ x: -30, z: -14 }, { x: -4, z: -14 }, { x: -4, z: 12 }, { x: -30, z: 12 }]
  });
  const b = K.baueKartenbaum([wurzel, kind]);
  const v = K.elternVorlage(b, 'k1');
  assert.equal(v.length, 2, 'das weit entfernte Element gehoert nicht dazu');
  assert.equal(v[0].quellElementId, 1);
  assert.equal(v[0].quelleId, 'k0');
  assert.equal(v[0].anteil, 1);
  // Elternpunkt -24/-8 ⇒ Kindkoordinate (-24 + 32) * 8 - 128 = -64.
  assert.equal(v[0].points[0].x, -64);
  assert.equal(v[0].points[0].z, 64 - 128);
  // Der streifende Weg wird geliefert, aber als teilweise draussen gemeldet.
  const weg = v.find(e => e.quellElementId === 3);
  assert.ok(weg.anteil > 0 && weg.anteil < 1, 'anteil = ' + weg.anteil);
  // Die Vorlage ist eine Kopie der PUNKTE — die Elternkarte darf sie nicht spueren.
  v[0].points[0].x = 999;
  assert.equal(wurzel.elemente[0].points[0].x, -24);
  // Und sie steht NICHT in der Elementliste des Kindes.
  assert.deepEqual(kind.elemente, []);
});

/* ==========================================================================
   11 — Format v5
   ========================================================================== */

const V4 = () => JSON.parse(readFileSync(path.join(TEST, 'fixtures', 'v4-kartengroesse.json'), 'utf8'));

test('Ebene 10 — eine v4-Datei laedt als einzelne Wurzelkarte ohne Kinder', () => {
  const d = V4();
  const { version, baum } = K.leseBaumDatei(d);
  assert.equal(version, 4);
  assert.equal(baum.ordnung.length, 1);
  const w = K.karteVon(baum, baum.wurzelId);
  assert.equal(w.elternId, null);
  assert.equal(w.hoehenQuelle, 'eigen');
  assert.equal(w.einheitMeter, K.EINHEIT_STANDARD);
  assert.equal(K.massstabName(w.einheitMeter), 'ort');
  // Der KARTENINHALT geht unveraendert durch — dieses Modul prueft ihn nicht,
  // das tut validiereKarte in editor/io.js.
  assert.equal(w.seed, d.seed);
  assert.equal(w.kartenGroesse, 512);
  assert.deepEqual(w.hoehenDelta, d.hoehenDelta);
  assert.equal(w.elemente.length, d.elemente.length);
  // Die Einstellungen der Datei GEHOEREN der Wurzelkarte und werden vererbbar.
  assert.equal(K.loeseFeld(baum, w.id, 'biom').wert, 'schnee');
  assert.equal(K.loeseFeld(baum, w.id, 'biom').geerbt, false);
  assert.equal(K.loeseFeld(baum, w.id, 'tageszeit').wert, 'nacht');
});

test('Ebene 10 — v1..v3 laden ebenfalls, und Muell wird abgelehnt', () => {
  for (const f of ['v1-einzeldatei.json', 'v2-hoehen-vollarray.json', 'v3-hoehendelta.json']) {
    const d = JSON.parse(readFileSync(path.join(TEST, 'fixtures', f), 'utf8'));
    const { baum } = K.leseBaumDatei(d);
    assert.equal(baum.ordnung.length, 1, f);
  }
  assert.throws(() => K.leseBaumDatei(null), /kein Objekt/);
  assert.throws(() => K.leseBaumDatei([]), /kein Objekt/);
  assert.throws(() => K.leseBaumDatei({ version: 4 }), /Unbekanntes Format/);
  assert.throws(() => K.leseBaumDatei({ version: 5, karten: [] }), /leere Liste/);
});

/** Baut einen kleinen, vollstaendigen v5-Baum. */
function baumV5() {
  const wurzel = karte('k0', null, 250, {
    kartenGroesse: 512, seed: 90210, hoehenDelta: [0, 20.5],
    elemente: [{ id: 1, kind: 'flaeche', variant: 'wald', points: [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 0, z: 4 }], params: {}, seed: 3 }],
    eigen: { biom: 'schnee', tageszeit: 'nacht' }
  });
  const kind = karte('k1', 'k0', 250 / 8, {
    kartenGroesse: 256, seed: 4242, hoehenDelta: [7, -3],
    rahmen: { x0: -32, z0: -16, seite: 32 },
    ausschnitt: [{ x: -30, z: -14 }, { x: -6, z: -14 }, { x: -6, z: 10 }],
    hoehenQuelle: 'abgeleitet',
    eigen: { wetter: 'sturm' }
  });
  return K.baueKartenbaum([wurzel, kind]);
}

test('Ebene 10 — eine v5-Datei uebersteht Schreiben und Lesen unveraendert', () => {
  const datei = K.schreibeBaumDatei(baumV5());
  assert.equal(datei.version, 5);
  assert.equal(datei.wurzel, 'k0');
  assert.equal(datei.karten.length, 2);
  // Der Fixpunkt: was einmal geschrieben und wieder gelesen wurde, schreibt
  // sich identisch zurueck. Das ist die belastbare Form der Zusage — sie
  // schliesst Reparaturen, Anhebungen und Vorgaben ausdruecklich mit ein.
  const wieder = K.schreibeBaumDatei(K.leseBaumDatei(datei).baum);
  assert.deepEqual(wieder, datei);
  // Und die Inhalte sind wirklich noch da.
  const gelesen = K.leseBaumDatei(datei).baum;
  assert.equal(K.karteVon(gelesen, 'k1').seed, 4242);
  assert.deepEqual(K.karteVon(gelesen, 'k1').hoehenDelta, [7, -3]);
  assert.deepEqual(K.karteVon(gelesen, 'k1').rahmen, { x0: -32, z0: -16, seite: 32 });
  assert.equal(K.karteVon(gelesen, 'k1').ausschnitt.length, 3);
  assert.equal(K.loeseFeld(gelesen, 'k1', 'biom').wert, 'schnee');
  assert.equal(K.loeseFeld(gelesen, 'k1', 'wetter').wert, 'sturm');
  assert.equal(K.loeseFeld(gelesen, 'k1', 'tageszeit').quelleId, 'k0');
});

test('Ebene 10 — der HEUTIGE Leser oeffnet eine v5-Datei als Wurzelkarte', async () => {
  /* Die Zusage "eine v5-Datei stuerzt einen aelteren Leser nicht ab" wird hier
     gegen den echten aelteren Leser geprueft und nicht gegen eine Nachbildung:
     `validiereKarte` aus editor/io.js kennt den Kartenbaum nicht, ueberliest
     `karten` als unbekanntes Feld und verzweigt `version` nirgends. Das ist der
     einzige Test dieser Ebene, der die Weltmaschine braucht — die Aussage
     haengt an genau dem Code, den es zu schuetzen gilt. */
  const { testWelt } = await import('./hilfen/karte.mjs');
  await testWelt({ seed: 1337, biom: 'wiese', groesse: 256 });
  const io = await ladeTerra('editor/io.js');
  const datei = K.schreibeBaumDatei(baumV5());
  const karte = io.validiereKarte(JSON.stringify(datei));
  assert.equal(karte.seed, 90210);
  assert.equal(karte.kartenGroesse, 512);
  assert.equal(karte.biom, 'schnee');
  assert.equal(karte.tageszeit, 'nacht');
  assert.equal(karte.elemente.length, 1);
  assert.deepEqual(karte.hoehenDelta, [0, 20.5]);
  // Ohne Spiegel wuerde er zu Recht scheitern — der Spiegel ist also nicht
  // Zierde, sondern genau die Bruecke.
  assert.throws(() => io.validiereKarte(JSON.stringify(K.schreibeBaumDatei(baumV5(), { spiegel: false }))),
    /Unbekanntes Format/);
});

test('Ebene 10 — der v4-Spiegel traegt den Mindestbestand', () => {
  const datei = K.schreibeBaumDatei(baumV5());
  assert.ok(Array.isArray(datei.elemente) && datei.elemente.length === 1);
  assert.deepEqual(datei.hoehenDelta, [0, 20.5]);
  assert.equal(datei.seed, 90210);
  assert.equal(datei.kartenGroesse, 512);
  assert.equal(datei.biom, 'schnee', 'auch die Erbfelder der Wurzel muessen flach stehen');
  // Ohne Spiegel bleibt die Datei klein und traegt nur den Baum.
  const ohne = K.schreibeBaumDatei(baumV5(), { spiegel: false });
  assert.equal(ohne.elemente, undefined);
  assert.equal(ohne.hoehenDelta, undefined);
  assert.deepEqual(ohne.karten, datei.karten);
});

test('Ebene 10 — ein geerbtes Feld wird flach NICHT mitgeschrieben', () => {
  /* Sonst schriebe der naechste Speichervorgang den geerbten Wert fest, das
     Anheben beim Lesen machte ihn zu einem eigenen, und „wieder erben" haette
     nach dem Neuladen keine Wirkung mehr. */
  const datei = K.schreibeBaumDatei(baumV5());
  const k1 = datei.karten.find(k => k.id === 'k1');
  assert.equal(k1.wetter, 'sturm', 'das eigene Feld steht flach da');
  assert.equal(k1.biom, undefined, 'das geerbte Feld darf nicht flach dastehen');
  assert.deepEqual(k1.eigen, { wetter: 'sturm' });
});

test('Ebene 10 — kaputte Baeume scheitern ATOMAR', () => {
  const kaputt = [
    [{ karten: [{ elternId: null }] }, /id fehlt/],
    [{ karten: [{ id: 'a' }, { id: 'a' }] }, /doppelt/],
    [{ karten: [{ id: 'a', elternId: null }, { id: 'b', elternId: 'c' }, { id: 'c', elternId: 'b' }] }, /Zyklus/],
    [{ karten: [{ id: 'a', elternId: null, einheitMeter: 1 }, { id: 'b', elternId: 'a', einheitMeter: 9 }] }, /groeber/],
    [{ karten: [{ id: 'a', elternId: null, einheitMeter: 0 }] }, /einheitMeter/],
    [{ karten: [{ id: 'a', elternId: null, einheitMeter: 'viel' }] }, /einheitMeter/],
    [{ karten: [{ id: 'a', elternId: null, hoehenQuelle: 'geraten' }] }, /hoehenQuelle/],
    [{ karten: [{ id: 'a', elternId: null }, { id: 'b', elternId: 'a', ausschnitt: [{ x: 0, z: 0 }] }] }, /drei Punkte/],
    [{ karten: [{ id: 'a', elternId: null }, { id: 'b', elternId: 'a', ausschnitt: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: NaN }] }] }, /Punkt 2/],
    [{ karten: [{ id: 'a', elternId: null }, { id: 'b', elternId: 'a', rahmen: { x0: 0, z0: 0, seite: 0 } }] }, /seite/],
    [{ karten: [{ id: 'a', elternId: null, eigen: [] }] }, /eigen/],
    [{ karten: [{ id: 'a', elternId: 5 }] }, /elternId/]
  ];
  for (const [d, muster] of kaputt) {
    const vorher = JSON.stringify(d);
    assert.throws(() => K.leseBaumDatei(d), muster, JSON.stringify(d));
    assert.equal(JSON.stringify(d), vorher, 'die Eingabe wurde beim Scheitern veraendert');
  }
});

test('Ebene 10 — ein unbekanntes Erbfeld wird uebergangen, nicht abgelehnt', () => {
  /* Es stammt aus einer NEUEREN Fassung. Es fallen zu lassen kostet diese eine
     Einstellung; die Datei abzulehnen kostet die ganze Karte. Dieselbe
     Abwaegung wie bei `biom` und `wetter` in editor/io.js. */
  const { baum, warnungen } = K.leseBaumDatei({
    version: 6, wurzel: 'a',
    karten: [{ id: 'a', elternId: null, eigen: { biom: 'moor', klangfarbe: 'dunkel' } }]
  });
  assert.equal(warnungen.length, 1);
  assert.equal(warnungen[0].art, 'unbekanntes-erbfeld');
  assert.equal(K.loeseFeld(baum, 'a', 'biom').wert, 'moor');
});

/* ==========================================================================
   12 — Leistung

   Kein Zeitlimit als Zusage (die Zahl haengt an der Maschine), aber ein
   Deckel, der ein VERSEHEN faengt: eine Ableitung auf 1024^2 darf spuerbar
   dauern, nicht haengen. Gemessen auf dem Entwicklungsrechner: ~100 ms.
   ========================================================================== */

test('Ebene 10 — eine Ableitung auf 1024^2 bleibt weit unter einer Sekunde', () => {
  const gross = gelaende(4711, 1024);
  const t0 = performance.now();
  const r = K.leiteHoehenAb(gross, {
    elternVW: 1025, elternMAP: 1024, rahmen: { x0: -128, z0: -128, seite: 128 },
    VW: 1025, MAP: 1024, seed: 7
  });
  const ms = performance.now() - t0;
  assert.equal(r.oktaven, 3);
  assert.ok(ms < 3000, 'die Ableitung brauchte ' + ms.toFixed(0) + ' ms');
  // Kein NaN — ein einziges wuerde ueber die Normalenrechnung die halbe Karte
  // schwarz faerben.
  for (let i = 0; i < r.hoehen.length; i++) {
    if (!Number.isFinite(r.hoehen[i])) assert.fail('NaN an Index ' + i);
  }
});
