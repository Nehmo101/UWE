/* ==========================================================================
   Ebene 6 — Binnenseen (Runde H)

   Geprueft wird die Kette, die aus einer geschlossenen Wanne eine sichtbare
   Wasserflaeche macht:

     world/erosion.js      senkenFuellen — die Differenz `gefuellt - hoehe`
     generators/see.js     seenAusFuellung (Ableitung) und genSee (Bild)
     generators/welt.js    erzeugeSeen — aus Polygonen werden Elemente,
                           und die Fluesse enden daran

   Dazu der zweite Teil derselben Runde: die Flussbreite haengt jetzt an einer
   GESPEICHERTEN Abflusskennzahl (`params.einzug`) statt am Regler — und
   ausdruecklich NICHT am Laufzeitfeld `abfluss`.

   ---------------------------------------------------------------------------
   ZWEI EIGENHEITEN DES AUFBAUS, damit niemand daran vorbeiliest:

   1. Jede Welt wird IM TEST angelegt, nie beim Import der Datei. `testWelt`
      liefert seit Kurzem eine wirklich frische Welt (Biommaske, Tritt,
      Korridor, Flussstempel, Massstab); ein Modulzustand, der beim Import
      entsteht, umgeht genau diese Frische und macht aus einem gruenen
      Alleinlauf einen roten Gesamtlauf.

   2. `genSee` wird hier DIREKT gerufen und nicht ueber core/dirty.js. Das ist
      Absicht und eine bekannte Luecke: die Verteilung in
      generators/areas.js (`genFlaeche`) gehoert zu den Dateien, die diese
      Runde nicht anfassen durfte. Die eine noetige Zeile steht im Bericht;
      solange sie fehlt, ist der Aufruf hier der einzige Weg zum Generator.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { testWelt, hashElement } from './hilfen/karte.mjs';
import { ladeTerra, ladeGeneratoren } from './hilfen/laden.mjs';
// erosion.js haengt ausschliesslich an core/rng.js und darf deshalb statisch
// importiert werden (13-fluesse macht es genauso).
import { senkenFuellen, breiteAusFlaeche } from '../src/world/erosion.js';

/* see.js und biomfeld.js ziehen `three` und muessen deshalb ueber den
   Loader-Haken laufen — ein statischer Import waere vor dessen Registrierung
   aufgeloest. Geladen wird nur der MODULGRAPH, keine Welt: die entsteht in
   jedem Test einzeln (siehe Kopf). Die Reihenfolge ist die aus main.js,
   deshalb zuerst ladeGeneratoren. */
await ladeGeneratoren();
const { seenAusFuellung } = await ladeTerra('generators/see.js');
const { selbstSchnitt } = await ladeTerra('world/biomfeld.js');

/* --------------------------------------------------------------------------
   Benannte Zahlen — alle gemessen, keine geraten.
   -------------------------------------------------------------------------- */

/* Wie weit der ENDPUNKT eines Flusses hoechstens in die gezeichnete
   Wasserflaeche hineinragen darf. Gemessen ueber 2 Kartengroessen x 5 Seeds x
   2 Biome (20 Karten, 168 Flusselemente): der tiefste Endpunkt lag 1.76
   Welteinheiten innerhalb des Ufers, also unter einer halben Rasterzelle des
   Analyserasters. 2.5 ist der Deckel mit Luft.

   Der Wert ist die eigentliche Zusage dieser Runde an die Fluesse: sie enden
   AM See, nicht darin und nicht davor. */
const ENDE_IM_SEE = 2.5;

/* Und die haertere Haelfte: KEIN Zwischenpunkt darf im See liegen — ein
   Flussband, das ueber eine Wasserflaeche laeuft, ist ein Bildfehler. Gemessen
   auf denselben 20 Karten: 0.00. */
const DURCH_DEN_SEE = 0.01;

/* Kartengroessen und Seeds, auf denen die Weltpruefungen laufen. 512 ist
   dabei kein Luxus: auf 256 hat eine Karte ein bis drei Seen, auf 512 sechs —
   erst dort haben die Aussagen ueber Fluesse und Seen genug Faelle. */
const WELTEN = [
  { groesse: 256, seed: 4711, biom: 'wiese' },
  { groesse: 256, seed: 1337, biom: 'hochland' },
  { groesse: 512, seed: 4711, biom: 'wiese' },
  { groesse: 512, seed: 2024, biom: 'hochland' }
];

/* --------------------------------------------------------------------------
   Aufbau
   -------------------------------------------------------------------------- */

/** Betriebsbereite Welt inklusive nachgezogener Hoehenfelder. Dieselbe
 *  Nachbesserung wie in 13-fluesse: `testWelt` setzt die Kartengroesse, zieht
 *  die Hoehenfelder aber nicht nach — auf 512 stuenden sonst NaN im Feld. */
async function welt(opt) {
  const o = Object.assign({ seed: 4711, biom: 'wiese', groesse: 256 }, opt || null);
  const w = await testWelt(o);
  const { terrain, store } = w.m;
  terrain.terrainGeometrienNeu();
  terrain.genBase(o.seed);
  const vw = store.KARTE.vw;
  terrain.recomputeHeights(0, vw - 1, 0, vw - 1);
  terrain.computeAO(0, vw - 1, 0, vw - 1);
  w.welt = await ladeTerra('generators/welt.js');
  w.see = await ladeTerra('generators/see.js');
  return w;
}

/** Punkt im Polygon (Strahlverfahren) — eigene Fassung, damit die Pruefung
 *  nicht dieselbe Funktion benutzt wie der Code, den sie prueft. */
function inPoly(pts, x, z) {
  let drin = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) drin = !drin;
  }
  return drin;
}

/** Abstand eines Punktes zum Polygonrand (ohne Vorzeichen). */
function randAbstand(pts, x, z) {
  let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)) : 0;
    const px = a.x + dx * t - x, pz = a.z + dz * t - z;
    const d = Math.hypot(px, pz);
    if (d < best) best = d;
  }
  return best;
}

/** Doppelte Polygonflaeche mit Vorzeichen. */
function flaeche2(pts) {
  let s = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    s += pts[j].x * pts[i].z - pts[i].x * pts[j].z;
  }
  return s;
}

/* --------------------------------------------------------------------------
   Ein kuenstliches Becken.

   Eine Hochebene auf 10 mit einer Mulde in der Mitte. Das Profil ist bewusst
   FLACHRANDIG (dritte Potenz): dadurch liegt die 0.6er Tiefenlinie
   (Kernschwelle) bei Radius 6.4 und die Wasserlinie bei 9.6 — die beiden
   Konturen sind weit genug auseinander, dass die Pruefung unten wirklich
   unterscheidet, an welcher von beiden das Ufer gezogen wurde. Bei einer
   parabelfoermigen Wanne laegen sie einen halben Zellabstand auseinander und
   die Pruefung waere ein Placebo.
   -------------------------------------------------------------------------- */
const NX = 64, MITTE = 31.5, BECKEN_R = 12, BECKEN_TIEFE = 6;
/* Radien, an denen die beiden Tiefenlinien liegen: 6*(1-r/12)³ = 0.6 bzw. 0.05. */
const R_KERN = BECKEN_R * (1 - Math.cbrt(0.6 / BECKEN_TIEFE));      // ~6.4
const R_WASSER = BECKEN_R * (1 - Math.cbrt(0.05 / BECKEN_TIEFE));   // ~9.6

function beckenFeld(mitTuempel) {
  const h = new Float32Array(NX * NX);
  for (let j = 0; j < NX; j++) {
    for (let i = 0; i < NX; i++) {
      let v = 10;
      const r = Math.hypot(i - MITTE, j - MITTE);
      if (r < BECKEN_R) {
        const t = 1 - r / BECKEN_R;
        v = 10 - BECKEN_TIEFE * t * t * t;
      }
      // Ein winziger Tuempel weit aussen: tief genug, aber viel zu klein.
      if (mitTuempel && Math.abs(i - 8) <= 1 && Math.abs(j - 8) <= 1) v = 7;
      h[j * NX + i] = v;
    }
  }
  return h;
}

/** Ableitung auf dem kuenstlichen Becken (raster 1, half = MITTE). */
function beckenSeen(mitTuempel, opt) {
  const h = beckenFeld(mitTuempel);
  const g = senkenFuellen(h, NX, NX);
  return seenAusFuellung(h, g, NX,
    Object.assign({ raster: 1, half: MITTE, minZellen: 20 }, opt || null));
}


/* ==========================================================================
   1 — Die Ableitung: aus der Fuellung wird ein Polygon
   ========================================================================== */

test('Ebene 6 — eine geschlossene Wanne wird zu genau einem See', () => {
  const erg = beckenSeen(false);
  assert.equal(erg.seen.length, 1, 'genau ein See erwartet');
  const s = erg.seen[0];
  assert.ok(s.points.length >= 3, 'Polygon hat zu wenige Punkte');
  assert.ok(s.points.length <= 20, 'Polygon hat ' + s.points.length + ' Griffe');
  assert.equal(selbstSchnitt(s.points), false, 'Polygon schneidet sich selbst');
  // Spiegel = Ueberlaufhoehe der Wanne (die Hochebene), Tiefe = Beckentiefe.
  assert.ok(s.spiegel >= 10 && s.spiegel < 10.2, 'Spiegel ' + s.spiegel);
  /* Nicht exakt BECKEN_TIEFE: die Beckenmitte liegt bei 31.5 und damit
     ZWISCHEN vier Zellen. Die tiefste Rasterzelle sitzt 0.71 Einheiten daneben,
     und bei einem so flachen Profil sind das schon 5.0 statt 6.0 — die Tiefe
     ist eine Zellauskunft, keine analytische. */
  assert.ok(s.tiefe > BECKEN_TIEFE * 0.8 && s.tiefe <= BECKEN_TIEFE + 0.2,
    'Tiefe ' + s.tiefe);
});

test('Ebene 6 — das Ufer liegt auf der WASSERLINIE, nicht auf der Kerntiefe', () => {
  /* Der Kern der Sache. Waere die Kontur an der Kernschwelle (0.6 Einheiten
     Wassertiefe) verfolgt worden, laege sie bei Radius 6.4 — die
     Wasserflaeche endete dann drei Einheiten vor ihrem eigenen Ufer und
     liesse einen Ring nassen Beckens frei. Verfolgt wird sie deshalb an der
     Saumschwelle, und dort liegt sie bei 9.6. */
  const s = beckenSeen(false).seen[0];
  let min = Infinity, max = 0;
  for (const p of s.points) {
    const r = Math.hypot(p.x, p.z);
    if (r < min) min = r;
    if (r > max) max = r;
  }
  assert.ok(min > (R_KERN + R_WASSER) * 0.5,
    'Ufer liegt bei Radius ' + min.toFixed(2) + ', erwartet nahe ' + R_WASSER.toFixed(2));
  assert.ok(max < BECKEN_R + 1.5, 'Ufer laeuft ueber den Beckenrand hinaus: ' + max.toFixed(2));
});

test('Ebene 6 — die Maske reicht weiter als der Kern und traegt den ganzen See', () => {
  const h = beckenFeld(false);
  const g = senkenFuellen(h, NX, NX);
  const erg = seenAusFuellung(h, g, NX, { raster: 1, half: MITTE, minZellen: 20 });
  let kern = 0, saum = 0, fehlt = 0;
  for (let id = 0; id < NX * NX; id++) {
    const t = g[id] - h[id];
    if (t > 0.6) { kern++; if (!erg.maske[id]) fehlt++; }
    else if (t > 0.05 && erg.maske[id]) saum++;
  }
  assert.equal(fehlt, 0, 'Kernzellen fehlen in der Maske');
  assert.ok(kern > 0 && saum > 0,
    'die Maske muss ueber den Kern hinausreichen (Kern ' + kern + ', Saum ' + saum + ')');
});

test('Ebene 6 — eine Mulde unter der Mindestflaeche ist kein See', () => {
  const erg = beckenSeen(true);
  assert.equal(erg.seen.length, 1, 'der 3x3-Tuempel darf kein See werden');
});

test('Ebene 6 — die Ableitung ist eine reine Funktion ihrer Eingaben', () => {
  const a = beckenSeen(false), b = beckenSeen(false);
  assert.equal(JSON.stringify(a.seen), JSON.stringify(b.seen));
  assert.deepEqual(Array.from(a.maske), Array.from(b.maske));
});

test('Ebene 6 — ohne Wanne gibt es keinen See und keine Maske', () => {
  const h = new Float32Array(NX * NX).fill(10);
  const g = senkenFuellen(h, NX, NX);
  const erg = seenAusFuellung(h, g, NX, { raster: 1, half: MITTE });
  assert.equal(erg.seen.length, 0);
  assert.equal(erg.maske.indexOf(1), -1);
});


/* ==========================================================================
   2 — Das Bild: genSee
   ========================================================================== */

/** Legt einen See auf eine echte Testwelt und erzeugt ihn. */
async function seeElement(w, punkte, extra) {
  const el = w.element('flaeche', 'see', punkte,
    Object.assign({ stau: 0, saum: 4, ufer: true, dichte: 1 }, extra || null));
  w.see.genSee(el);
  return el;
}

/** Die Polygone der erzeugten Welt. */
function seenIn(liste) { return liste.filter((e) => e.variant === 'see'); }

test('Ebene 6 — die Wasserflaeche ist flach, liegt auf dem Spiegel und deckt das Becken', async () => {
  const w = await welt({ groesse: 256, seed: 4711, biom: 'wiese' });
  const liste = w.welt.erzeugeWelt(4711, { abfluss: null, namen: false });
  const seen = seenIn(liste);
  assert.ok(seen.length >= 1, 'die Karte 256/4711 muss einen See haben');
  const el = await seeElement(w, seen[0].points, seen[0].params);
  const y = w.see.seeSpiegel(el);

  const netze = el.group.children.filter((c) => c.geometry
    && c.geometry.attributes && c.geometry.attributes.position);
  assert.ok(netze.length >= 2, 'erwartet Wasserflaeche UND Saumband, gefunden ' + netze.length);

  for (const m of netze) {
    const p = m.geometry.attributes.position.array;
    for (let i = 1; i < p.length; i += 3) {
      assert.ok(Math.abs(p[i] - y) < 1e-3,
        'Stuetzpunkt liegt nicht auf dem Spiegel: ' + p[i] + ' statt ' + y);
    }
  }

  // Der Spiegel muss ueber dem Beckenboden liegen, sonst waere der See leer.
  let mx = 0, mz = 0;
  for (const q of el.points) { mx += q.x; mz += q.z; }
  mx /= el.points.length; mz /= el.points.length;
  assert.ok(w.m.terrain.heightAt(mx, mz) < y - 0.2,
    'in der Mitte des Sees steht kein Wasser');
});

test('Ebene 6 — der Ohrenschnitt deckt das Polygon genau, nicht mehr und nicht weniger', async () => {
  const w = await welt({ groesse: 256, seed: 4711, biom: 'wiese' });
  /* Ein bewusst KONKAVES Polygon (L-Form): ein Faecher vom Schwerpunkt aus
     wuerde hier ueber Land laufen, der Ohrenschnitt darf es nicht. Gemessen
     wird ueber die Flaeche — sie ist die einzige Groesse, die beide Fehler
     (Loch und Ueberstand) gleichzeitig faengt. */
  const punkte = [
    { x: -30, z: -30 }, { x: 10, z: -30 }, { x: 10, z: 0 },
    { x: 30, z: 0 }, { x: 30, z: 30 }, { x: -30, z: 30 }
  ];
  const el = await seeElement(w, punkte, { ufer: false, saum: 0 });
  const netz = el.group.children.find((c) => c.geometry && c.geometry.index);
  assert.ok(netz, 'keine Wasserflaeche erzeugt');
  const pos = netz.geometry.attributes.position.array;
  const idx = netz.geometry.index.array;
  let summe = 0;
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k] * 3, b = idx[k + 1] * 3, c = idx[k + 2] * 3;
    summe += Math.abs((pos[b] - pos[a]) * (pos[c + 2] - pos[a + 2])
      - (pos[c] - pos[a]) * (pos[b + 2] - pos[a + 2])) * 0.5;
  }
  /* Gemessen wird gegen den GEZEICHNETEN Uferzug, nicht gegen die Griffe: die
     Griffe sind die Vorlage, gezeichnet wird die Catmull-Rom-Kurve durch sie
     (siehe seeUmriss). Ein Vergleich gegen das Griffpolygon wuerde die
     Glaettung als Fehler melden. */
  const soll = Math.abs(flaeche2(w.see.seeUmriss(el))) * 0.5;
  assert.ok(Math.abs(summe - soll) / soll < 1e-4,
    'Dreiecksflaeche ' + summe.toFixed(1) + ' gegen Uferflaeche ' + soll.toFixed(1));
});

test('Ebene 6 — das Saumband liegt INNEN, am Ufer entlang', async () => {
  const w = await welt({ groesse: 256, seed: 4711, biom: 'wiese' });
  const punkte = [{ x: -40, z: -30 }, { x: 20, z: -40 }, { x: 45, z: 10 },
    { x: 0, z: 45 }, { x: -45, z: 15 }];
  const saum = 5;
  const el = await seeElement(w, punkte, { ufer: false, saum: saum });
  // Das Saumband ist das ZWEITE Mesh (die Wasserflaeche wird zuerst gehaengt).
  const band = el.group.children[1];
  assert.ok(band, 'kein Saumband erzeugt');
  const ufer = w.see.seeUmriss(el);
  const p = band.geometry.attributes.position.array;
  let aussen = 0;
  for (let i = 0; i < p.length; i += 3) {
    if (!inPoly(ufer, p[i], p[i + 2]) && randAbstand(ufer, p[i], p[i + 2]) > 0.05) aussen++;
  }
  assert.equal(aussen, 0, aussen + ' Saumpunkte liegen ausserhalb des Sees');
  // Und es reicht auch wirklich hinein — sonst waere es ein Strich.
  let tiefste = 0;
  for (let i = 0; i < p.length; i += 3) {
    if (inPoly(ufer, p[i], p[i + 2])) {
      tiefste = Math.max(tiefste, randAbstand(ufer, p[i], p[i + 2]));
    }
  }
  assert.ok(tiefste > saum * 0.3, 'Saumband reicht nur ' + tiefste.toFixed(2) + ' hinein');
});

test('Ebene 6 — der Uferbewuchs steht am Ufer und nur ueber dem Spiegel', async () => {
  const w = await welt({ groesse: 256, seed: 4711, biom: 'wiese' });
  const liste = w.welt.erzeugeWelt(4711, { abfluss: null, namen: false });
  const s = seenIn(liste)[0];
  const el = await seeElement(w, s.points, Object.assign({}, s.params, { dichte: 3 }));
  const y = w.see.seeSpiegel(el);
  let n = 0, danebenLiegend = 0;
  for (const pool of Object.keys(el.inst)) {
    const a = el.inst[pool];
    for (let i = 0; i < a.length; i += 12) {
      n++;
      // Alles muss innerhalb einer Saumbreite um die Uferlinie stehen.
      if (randAbstand(el.points, a[i], a[i + 2]) > 9) danebenLiegend++;
      // Und nichts darf unter dem Spiegel versinken.
      assert.ok(a[i + 1] > y - 1.2, 'Uferstueck ' + pool + ' liegt unter dem Spiegel');
    }
  }
  assert.ok(n > 0, 'kein Uferbewuchs erzeugt');
  assert.equal(danebenLiegend, 0, danebenLiegend + ' Uferstuecke stehen weit vom Ufer weg');
});

test('Ebene 6 — die Korridorstempel decken den See und nur ihn', async () => {
  const w = await welt({ groesse: 256, seed: 4711, biom: 'wiese' });
  const punkte = [{ x: -40, z: -30 }, { x: 20, z: -40 }, { x: 45, z: 10 },
    { x: 0, z: 45 }, { x: -45, z: 15 }];
  const el = await seeElement(w, punkte, { ufer: false, saum: 0 });
  const st = w.see.seeKorridore(el);
  const ufer = w.see.seeUmriss(el);
  assert.ok(st.length > 20, 'nur ' + st.length + ' Stempel');
  for (const s of st) {
    assert.ok(inPoly(ufer, s.x, s.z), 'Stempel ausserhalb des Sees');
    assert.ok(s.r > 0);
  }
  /* Lueckenlos: die halbe Rasterdiagonale muss unter dem Radius liegen. Sonst
     bliebe zwischen vier Stempeln ein Loch, in dem ein Baum stuende. */
  let dmin = Infinity;
  for (const a of st) {
    for (const b of st) {
      if (a === b) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < dmin) dmin = d;
    }
  }
  assert.ok(dmin * Math.SQRT1_2 <= st[0].r + 1e-9,
    'Rasterweite ' + dmin + ' gegen Radius ' + st[0].r);
});

test('Ebene 6 — genSee ist deterministisch und wiederholbar', async () => {
  const w = await welt({ groesse: 256, seed: 4711, biom: 'wiese' });
  const liste = w.welt.erzeugeWelt(4711, { abfluss: null, namen: false });
  const s = seenIn(liste)[0];
  const el = await seeElement(w, s.points, s.params);
  const a = hashElement(el);
  w.m.store.clearElement(el);
  w.see.genSee(el);
  assert.equal(hashElement(el), a);
});

test('Ebene 6 — der Spiegel wird am Ufer abgelesen, `stau` verschiebt ihn', async () => {
  const w = await welt({ groesse: 256, seed: 4711, biom: 'wiese' });
  const liste = w.welt.erzeugeWelt(4711, { abfluss: null, namen: false });
  const s = seenIn(liste)[0];
  const el = await seeElement(w, s.points, s.params);
  const y0 = w.see.seeSpiegel(el);
  el.params.stau = 3;
  assert.ok(Math.abs(w.see.seeSpiegel(el) - (y0 + 3)) < 1e-6, 'stau wirkt nicht');
  el.params.stau = 0;

  /* Verschieben: der See nimmt seine Hoehe NICHT mit, er fuellt die neue
     Stelle. Genau das ist der Grund, warum der Spiegel nicht gespeichert
     wird — eine gespeicherte Absoluthoehe waere nach dem ersten Verschieben
     eine falsche. */
  const versetzt = el.points.map((q) => ({ x: q.x + 60, z: q.z + 60 }));
  const el2 = await seeElement(w, versetzt, s.params);
  const y1 = w.see.seeSpiegel(el2);
  assert.ok(Number.isFinite(y1));
  assert.ok(y1 >= w.m.store.WATER, 'Spiegel unter dem Meeresspiegel');
});


/* ==========================================================================
   3 — Fluss und See: wo einer endet und der andere anfaengt
   ========================================================================== */

test('Ebene 6 — Fluesse enden AM See, laufen nicht darueber hinweg', async () => {
  let tiefsteMuendung = 0, tiefsterDurchlauf = 0, geprueft = 0;
  for (const o of WELTEN) {
    const w = await welt(o);
    const liste = w.welt.erzeugeWelt(o.seed, { abfluss: null, namen: false });
    const seen = seenIn(liste);
    if (!seen.length) continue;
    for (const f of liste.filter((e) => e.variant === 'fluss')) {
      geprueft++;
      for (let k = 0; k < f.points.length; k++) {
        const p = f.points[k];
        for (const s of seen) {
          if (!inPoly(s.points, p.x, p.z)) continue;
          const d = randAbstand(s.points, p.x, p.z);
          if (k === f.points.length - 1) tiefsteMuendung = Math.max(tiefsteMuendung, d);
          else tiefsterDurchlauf = Math.max(tiefsterDurchlauf, d);
        }
      }
    }
  }
  assert.ok(geprueft > 20, 'zu wenige Fluesse geprueft: ' + geprueft);
  assert.ok(tiefsteMuendung <= ENDE_IM_SEE,
    'ein Fluss ragt ' + tiefsteMuendung.toFixed(2) + ' Einheiten in den See');
  assert.ok(tiefsterDurchlauf <= DURCH_DEN_SEE,
    'ein Flussband laeuft ' + tiefsterDurchlauf.toFixed(2) + ' Einheiten ueber einen See');
});

test('Ebene 6 — jeder erzeugte See ist ein brauchbares Element', async () => {
  let gesamt = 0;
  for (const o of WELTEN) {
    const w = await welt(o);
    const liste = w.welt.erzeugeWelt(o.seed, { abfluss: null, namen: false });
    assert.equal(liste.bericht.seen, seenIn(liste).length, 'Bericht zaehlt falsch');
    for (const s of seenIn(liste)) {
      gesamt++;
      assert.ok(s.points.length >= 3 && s.points.length <= 24,
        'See mit ' + s.points.length + ' Griffen');
      assert.equal(selbstSchnitt(s.points), false, 'See-Polygon schneidet sich selbst');
      assert.ok(Math.abs(flaeche2(s.points)) * 0.5 > 40, 'See ist zu klein zum Anfassen');
      assert.ok(Number.isFinite(s.params.saum) && s.params.saum > 0);
      assert.equal(s.params.stau, 0);
      for (const q of s.points) {
        assert.ok(Number.isFinite(q.x) && Number.isFinite(q.z));
        assert.ok(Math.abs(q.x) <= w.m.store.KARTE.half + 4);
        assert.ok(Math.abs(q.z) <= w.m.store.KARTE.half + 4);
      }
    }
  }
  assert.ok(gesamt >= 8, 'nur ' + gesamt + ' Seen auf vier Karten');
});

test('Ebene 6 — dieselbe Welt liefert dieselben Seen', async () => {
  const w = await welt({ groesse: 256, seed: 1337, biom: 'hochland' });
  const a = seenIn(w.welt.erzeugeWelt(1337, { abfluss: null, namen: false }));
  const b = seenIn(w.welt.erzeugeWelt(1337, { abfluss: null, namen: false }));
  assert.equal(JSON.stringify(a.map((e) => [e.points, e.params, e.seed])),
    JSON.stringify(b.map((e) => [e.points, e.params, e.seed])));
});


/* ==========================================================================
   4 — Flussbreite aus dem gespeicherten Abfluss
   ========================================================================== */

test('Ebene 6 — die hydraulische Kurve ist monoton und gedeckelt', () => {
  assert.ok(breiteAusFlaeche(0) >= 3);
  assert.ok(breiteAusFlaeche(1e9) <= 26);
  let vor = 0;
  for (const a of [256, 1728, 19200, 96000, 480000]) {
    const b = breiteAusFlaeche(a);
    assert.ok(b >= vor, 'nicht monoton bei ' + a);
    vor = b;
  }
  // Die Eichpunkte aus dem Kommentar in world/erosion.js.
  assert.ok(Math.abs(breiteAusFlaeche(19200) - 10.7) < 0.3);
  assert.ok(Math.abs(breiteAusFlaeche(96000) - 20.2) < 0.5);
});

test('Ebene 6 — ohne `einzug` bleibt die Strichstaerke exakt die alte', async () => {
  const w = await welt({ groesse: 256, seed: 4711, biom: 'wiese' });
  const { flussBreite } = w.m.paths;
  // Die frueher gueltige Formel, ausgeschrieben: sqrt(breite/9).
  for (const b of [2, 4, 6, 9, 12, 16]) {
    assert.equal(flussBreite({ breite: b }), Math.min(2.4, Math.max(0.55, Math.sqrt(b / 9))));
  }
  assert.equal(flussBreite({ breite: 9, einzug: 0 }), 1);
  assert.equal(flussBreite({ breite: 9, einzug: null }), 1);
  assert.equal(flussBreite({}), 1);
});

test('Ebene 6 — mit `einzug` folgt die Strichstaerke dem Abfluss, nicht dem Regler', async () => {
  const w = await welt({ groesse: 256, seed: 4711, biom: 'wiese' });
  const { flussBreite } = w.m.paths;
  const schmal = flussBreite({ breite: 9, einzug: 400 });
  const breit = flussBreite({ breite: 9, einzug: 200000 });
  assert.ok(breit > schmal * 1.4, 'der Abfluss wirkt kaum: ' + schmal + ' -> ' + breit);
  // Der Regler ist dabei wirkungslos — genau das ist die Aussage.
  assert.equal(flussBreite({ breite: 3, einzug: 19200 }),
    flussBreite({ breite: 16, einzug: 19200 }));
});

test('Ebene 6 — der Weltgenerator speichert den Einzug, und er ueberlebt die Datei', async () => {
  const w = await welt({ groesse: 512, seed: 4711, biom: 'wiese' });
  const { flussBreite } = w.m.paths;
  const liste = w.welt.erzeugeWelt(4711, { abfluss: null, namen: false });
  const fl = liste.filter((e) => e.variant === 'fluss');
  assert.ok(fl.length >= 4, 'zu wenige Fluesse');
  for (const f of fl) {
    assert.ok(Number.isFinite(f.params.einzug) && f.params.einzug > 0,
      'Flusselement ohne einzug');
    assert.equal(f.params.einzug, Math.round(f.params.einzug), 'einzug ist nicht ganzzahlig');
  }
  /* Speicher-Lade-Zyklus: params wandern als Ganzes durch serializeElements
     und hydrate. Waere die Kennzahl ein Laufzeitwert, waere sie danach weg —
     und genau das ist der Fehler, den diese Runde vermeiden sollte. */
  const vorher = fl.map((f) => flussBreite(f.params));
  w.m.store.hydrate(liste);
  const roh = JSON.parse(JSON.stringify(w.m.store.serializeElements()));
  w.m.store.hydrate(roh);
  const nachher = w.m.store.S.elements
    .filter((e) => e.variant === 'fluss').map((e) => flussBreite(e.params));
  assert.deepEqual(nachher, vorher);
  w.leeren();
});

test('Ebene 6 — das Laufzeitfeld `abfluss` beeinflusst die Strichstaerke nicht', async () => {
  const w = await welt({ groesse: 256, seed: 4711, biom: 'wiese' });
  const { flussBreite } = w.m.paths;
  const vw = w.m.store.KARTE.vw;
  const liste = w.welt.erzeugeWelt(4711, { abfluss: null, namen: false });
  const fl = liste.filter((e) => e.variant === 'fluss');
  const vorher = fl.map((f) => flussBreite(f.params));
  /* Ein Erosionslauf fuellt `abfluss` mit ganz anderen Zahlen. Die
     Strichstaerken duerfen sich davon nicht bewegen — und ebenso wenig
     davon, dass das Feld danach wieder geleert wird (das tut jedes Laden). */
  const AB = new Float32Array(vw * vw).fill(500);
  w.m.terrain.abfluss.set(AB.subarray(0, Math.min(AB.length, w.m.terrain.abfluss.length)));
  assert.deepEqual(fl.map((f) => flussBreite(f.params)), vorher);
  w.m.terrain.terrainGeometrienNeu();
  assert.deepEqual(fl.map((f) => flussBreite(f.params)), vorher);
});
