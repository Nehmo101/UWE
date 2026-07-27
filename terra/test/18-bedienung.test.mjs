/* ==========================================================================
   Ebene 18 — Bedienung: Biompinsel, gebogene Beschriftung, Historie je Karte

   Die drei Dinge dieser Runde haben eines gemeinsam: sie leben in Modulen,
   die `node --test` nur zur Haelfte sieht. `editor/tools.js`, `editor/
   selection.js`, `editor/history.js` und `ui/panels.js` sind hier durch
   Ersatzmodule getauscht (siehe hilfen/haken.mjs) — was dort gebaut wird,
   prueft der Browsertest (test/browser/runde-h-bedienung.mjs).

   Geprueft wird hier genau das, was OHNE Bild pruefbar ist, und zwar dort, wo
   es wirklich entschieden wird:

     1  Der Biompinsel als Quelle der Biommaske (core/dirty.js). Reine
        Geometrie: Tupfermitten, Kreispolygone, Reihenfolge, Deckel.
     2  Derselbe Pinsel im echten Aufbau — ein Strich auf einer Testwelt, und
        das abgeleitete Biomfeld traegt danach sein Biom (core/dirty.js ->
        world/terrain.js -> world/biomfeld.js, der ganze Weg).
     3  `anPfadPruefen` — die Erlaubnisliste fuer die Verknuepfung einer
        Beschriftung (ui/beschriftung.js), und ihr Einbau in den Ladeweg
        (editor/io.js, pruefeElemente).
     4  Die gebogene Beschriftung: `kurvenBeschriftung` liefert eine Kette in
        Bildkoordinaten, ihre Weltmitte liegt am Pfad, und sie sagt „nein",
        wo der Pfad den Text nicht traegt.
     5  Die Schicht baut fuer eine Quelle MIT Pfad ein flach liegendes Quad
        und faellt ohne tauglichen Pfad auf das Sprite zurueck.

   TESTISOLATION: die Welt wird IM Test angelegt, nie beim Import. Ueber den
   Sammeleinstieg laufen alle Importe vor allen Tests — eine beim Import
   gebaute Welt zeigte dann auf ein laengst ueberschriebenes Hoehenfeld.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeTerra } from './hilfen/laden.mjs';
import { testWelt } from './hilfen/karte.mjs';

const B = await ladeTerra('ui/beschriftung.js');


/* ==========================================================================
   1 — Der Biompinsel als Flaechenquelle (core/dirty.js)
   ========================================================================== */

test('Ebene 18/1 — der Pinselstrich wird zu Kreisflaechen in Zeichenreihenfolge', async () => {
  const welt = await testWelt({ seed: 4711, groesse: 256 });
  const { S } = welt.m.store;
  const D = welt.m.dirty;

  // Eine gezeichnete Biomflaeche und danach ein Strich: beide sind Quellen,
  // und ihre Reihenfolge ist bedeutungstragend (spaeter gewinnt im Kern).
  const flaeche = welt.element('flaeche', 'biom',
    [{ x: -40, z: -40 }, { x: 0, z: -40 }, { x: 0, z: 0 }, { x: -40, z: 0 }],
    { biom: 'wueste', weich: 6 });
  const strich = welt.element('pfad', 'biompinsel',
    [{ x: 20, z: 0 }, { x: 60, z: 0 }], { biom: 'moor', radius: 10, weich: 8 });

  const quellen = D.biomQuellen();
  assert.ok(quellen.length >= 2, 'Flaeche und mindestens ein Tupfer');
  assert.equal(quellen[0], flaeche, 'die Flaeche steht an ihrer Stelle der Liste');

  // Jeder Tupfer ist ein geschlossenes Kreispolygon mit dem Biom des Strichs.
  const tupfer = quellen.slice(1);
  for (const t of tupfer) {
    assert.equal(t.params.biom, 'moor');
    assert.equal(t.params.weich, 8);
    assert.ok(t.points.length >= 8, 'ein Kreis braucht genug Ecken');
    // Alle Ecken haben denselben Abstand zur Mitte — es ist wirklich ein Kreis.
    const mx = t.points.reduce((s, p) => s + p.x, 0) / t.points.length;
    const mz = t.points.reduce((s, p) => s + p.z, 0) / t.points.length;
    for (const p of t.points) {
      assert.ok(Math.abs(Math.hypot(p.x - mx, p.z - mz) - 10) < 0.6,
        'Ecke liegt auf dem Radius');
    }
  }

  // Die Tupfer decken den Strich ab: erster und letzter liegen an den Enden.
  const mitten = D.pinselTupfer(strich, 10);
  assert.ok(Math.hypot(mitten[0].x - 20, mitten[0].z - 0) < 2.5, 'beginnt am Anfang');
  const letzt = mitten[mitten.length - 1];
  assert.ok(Math.hypot(letzt.x - 60, letzt.z - 0) < 2.5, 'endet am Ende');
  // ... und luecklos: der Abstand bleibt unter dem Radius, sonst reisst die
  // Kette in einzelne Kreise auseinander.
  for (let i = 1; i < mitten.length; i++) {
    const d = Math.hypot(mitten[i].x - mitten[i - 1].x, mitten[i].z - mitten[i - 1].z);
    assert.ok(d <= 10, 'Tupferabstand ' + d.toFixed(2) + ' <= Radius');
  }

  // Ein Element ohne Pinsel- und ohne Biomcharakter ist keine Quelle.
  welt.element('pfad', 'strasse', [{ x: -80, z: 40 }, { x: 80, z: 40 }]);
  assert.equal(D.biomQuellen().length, quellen.length, 'die Strasse faerbt nichts');
  welt.leeren();
  assert.equal(S.elements.length, 0);
});

test('Ebene 18/1b — ein sehr langer Strich bleibt bezahlbar (Tupferdeckel)', async () => {
  const welt = await testWelt({ seed: 4711, groesse: 1024 });
  const D = welt.m.dirty;
  // Ein Zickzack quer ueber die ganze Karte, mehrfach hin und her.
  const punkte = [];
  for (let i = 0; i <= 40; i++) punkte.push({ x: -500 + i * 25, z: (i % 2 ? 400 : -400) });
  const strich = welt.element('pfad', 'biompinsel', punkte,
    { biom: 'moor', radius: 4, weich: 4 });
  const mitten = D.pinselTupfer(strich, 4);
  assert.ok(mitten.length <= 321, 'Deckel greift: ' + mitten.length + ' Tupfer');
  assert.ok(mitten.length > 100, 'aber der Strich wird auch nicht auf drei Punkte gekuerzt');
  welt.leeren();
});


/* ==========================================================================
   2 — Derselbe Pinsel im echten Aufbau

   Der ganze Weg: Element -> biomQuellen -> rebuildBiomFeld (world/terrain.js)
   -> biomFeldBauen (world/biomfeld.js). Was hier stimmt, stimmt auch im
   Editor — es ist derselbe Aufruf, den `commit` macht.
   ========================================================================== */

test('Ebene 18/2 — ein Pinselstrich faerbt das Biomfeld, und nur dort', async () => {
  const welt = await testWelt({ seed: 4711, groesse: 256 });
  const T = welt.m.terrain;
  const BF = await ladeTerra('world/biomfeld.js');
  const { KARTE } = welt.m.store;

  const leerVorher = BF.biomIndexAn(T.biomFeld, KARTE.vw, KARTE.map, 30, 0);
  assert.equal(leerVorher, BF.BIOM_KEINS, 'die frische Welt hat keine Biomflaechen');

  welt.element('pfad', 'biompinsel',
    [{ x: 0, z: 0 }, { x: 50, z: 0 }], { biom: 'moor', radius: 12, weich: 6 });
  welt.alleNeu();

  const moor = BF.biomIndex('moor');
  assert.equal(BF.biomIndexAn(T.biomFeld, KARTE.vw, KARTE.map, 25, 0), moor,
    'mitten auf dem Strich liegt das Biom');
  assert.equal(BF.biomGewichtAn(T.biomGewicht, KARTE.vw, KARTE.map, 25, 0), 255,
    'und zwar mit voller Deckung');
  assert.equal(BF.biomIndexAn(T.biomFeld, KARTE.vw, KARTE.map, 25, 90), BF.BIOM_KEINS,
    'weit daneben bleibt das Feld leer');
  // Quer zum Strich: bei Radius 12 liegt +-11 noch drin, +-30 sicher draussen.
  assert.equal(BF.biomIndexAn(T.biomFeld, KARTE.vw, KARTE.map, 25, 6), moor);
  assert.equal(BF.biomIndexAn(T.biomFeld, KARTE.vw, KARTE.map, 25, 30), BF.BIOM_KEINS);

  // Zweimal aufbauen ergibt dasselbe Feld — der Pinsel wuerfelt nicht.
  const kopie = T.biomFeld.slice(0, KARTE.vw * KARTE.vw);
  welt.alleNeu();
  assert.deepEqual(T.biomFeld.slice(0, KARTE.vw * KARTE.vw), kopie,
    'der Strich ist deterministisch');

  // Und er ist ein Element: geloescht, verschwindet die Faerbung wieder.
  welt.leeren();
  welt.alleNeu();
  assert.equal(BF.biomIndexAn(T.biomFeld, KARTE.vw, KARTE.map, 25, 0), BF.BIOM_KEINS,
    'geloescht ist geloescht');
});

test('Ebene 18/2b — der Pinsel loest denselben schweren Commit aus wie die Flaeche', async () => {
  const welt = await testWelt({ seed: 4711, groesse: 256 });
  const D = welt.m.dirty;
  const strich = welt.element('pfad', 'biompinsel', [{ x: 0, z: 0 }, { x: 20, z: 0 }],
    { biom: 'moor', radius: 8, weich: 4 });
  assert.equal(D.isHeavy(strich), true,
    'er faerbt das Terrain — ohne schweren Commit bliebe das Bild stehen');
  // Er erzeugt dabei kein einziges Bauteil: seine Wirkung ist die Maske.
  D.genElement(strich);
  assert.equal(Object.keys(strich.inst).length, 0);
  assert.equal(strich.total, 0);
  welt.leeren();
});


/* ==========================================================================
   3 — anPfadPruefen: die Zahl aus der fremden Datei
   ========================================================================== */

test('Ebene 18/3 — anPfadPruefen laesst nur ganze, positive Kennungen durch', () => {
  // Kein Verweis — drei Schreibweisen desselben Nichts.
  for (const leer of [undefined, null, 0]) {
    const r = B.anPfadPruefen(leer);
    assert.equal(r.ok, true);
    assert.equal(r.wert, 0);
  }
  // Gueltig.
  assert.deepEqual(B.anPfadPruefen(1), { ok: true, wert: 1 });
  assert.deepEqual(B.anPfadPruefen(2147483647), { ok: true, wert: 2147483647 });

  // Alles andere fliegt raus. Die Liste ist die Sammlung dessen, was in einer
  // fremden JSON-Datei wirklich stehen kann.
  const boese = ['7', '7; DROP', true, false, {}, [], [7], NaN, Infinity, -Infinity,
    1.5, -1, 2147483648, 1e30, () => 7];
  for (const v of boese) {
    const r = B.anPfadPruefen(v);
    assert.equal(r.ok, false, 'durchgelassen: ' + String(v));
    assert.ok(r.grund && r.grund.length > 0, 'jede Ablehnung nennt ihren Grund');
  }
});

test('Ebene 18/3b — der Ladeweg prueft anPfad und normalisiert es', async () => {
  const io = await ladeTerra('editor/io.js');

  const gut = io.pruefeElemente([{
    kind: 'marker', variant: 'beschriftung', points: [{ x: 0, z: 0 }],
    params: { text: 'Silberfluss', anPfad: 12 }
  }], 'Element');
  assert.equal(gut[0].params.anPfad, 12);

  // 0 bleibt 0 (kein Verweis), und die Pruefung schreibt den Wert zurueck.
  const leer = io.pruefeElemente([{
    kind: 'marker', variant: 'beschriftung', points: [{ x: 0, z: 0 }],
    params: { text: 'Ost', anPfad: null }
  }], 'Element');
  assert.equal(leer[0].params.anPfad, 0);

  // Kaputt heisst: die Datei wird gar nicht erst uebernommen (atomar, wie
  // bei `ziel` und den Zugpunkten).
  for (const v of ['12', 1.5, -3, {}]) {
    assert.throws(() => io.pruefeElemente([{
      kind: 'marker', variant: 'beschriftung', points: [{ x: 0, z: 0 }],
      params: { text: 'Ost', anPfad: v }
    }], 'Element'), /anPfad/, 'durchgelassen: ' + String(v));
  }

  // Ein Verweis ins Leere ist KEIN Verstoss — er ist der Normalfall nach
  // einem Loeschen und wird zur Laufzeit aufgeloest.
  const verwaist = io.pruefeElemente([{
    kind: 'marker', variant: 'beschriftung', points: [{ x: 0, z: 0 }],
    params: { text: 'Ost', anPfad: 999999 }
  }], 'Element');
  assert.equal(verwaist[0].params.anPfad, 999999);
});


/* ==========================================================================
   4 — Die gebogene Beschriftung: Rechnung ohne Bild
   ========================================================================== */

/** Ein flacher Bogen in Weltkoordinaten, Laenge ~`laenge`. */
function bogen(laenge, hoehe) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    pts.push({ x: -laenge / 2 + t * laenge, z: Math.sin(t * Math.PI) * hoehe });
  }
  return pts;
}

test('Ebene 18/4 — kurvenBeschriftung setzt jede Glyphe auf den Pfad', () => {
  const r = B.kurvenBeschriftung('Silberfluss', 'gewaesser',
    { groesse: 1, pfad: bogen(60, 6), lage: 0.5 });
  assert.equal(r.tauglich, true, r.grund);
  assert.equal(r.glyphen.length, 'Silberfluss'.length);

  // Alle Glyphen liegen IM Bild (das ist der Sinn der Huellbox-Rechnung).
  for (const g of r.glyphen) {
    assert.ok(Number.isFinite(g.x) && Number.isFinite(g.y), 'keine NaN');
    assert.ok(g.x >= 0 && g.x <= r.breite, 'x im Bild: ' + g.x);
    assert.ok(g.y >= 0 && g.y <= r.hoehe, 'y im Bild: ' + g.y);
    assert.ok(Math.abs(g.winkel) <= Math.PI / 2 + 1e-9, 'kein Kopfstand');
  }
  // Von links nach rechts, in Textreihenfolge.
  for (let i = 1; i < r.glyphen.length; i++) {
    assert.ok(r.glyphen[i].x > r.glyphen[i - 1].x, 'Glyphen laufen vorwaerts');
  }
  // Das Bild bleibt eine brauchbare Textur.
  assert.ok(r.breite > 0 && r.breite <= B.KURVE_MAX_PX);
  assert.ok(r.hoehe > 0 && r.hoehe <= B.KURVE_MAX_PX);

  // Die Weltmitte liegt im Bereich des Pfades — nicht im Nirgendwo.
  assert.ok(Math.abs(r.mitte.x) < 40, 'Mitte liegt am Pfad: x=' + r.mitte.x);
  assert.ok(r.mitte.z > -20 && r.mitte.z < 20, 'Mitte liegt am Pfad: z=' + r.mitte.z);

  // Deterministisch: zweimal gerechnet, Zeichen fuer Zeichen gleich.
  const r2 = B.kurvenBeschriftung('Silberfluss', 'gewaesser',
    { groesse: 1, pfad: bogen(60, 6), lage: 0.5 });
  assert.deepEqual(r2.glyphen, r.glyphen);
});

test('Ebene 18/4b — `lage` schiebt die Zeile den Pfad entlang', () => {
  const p = bogen(160, 2);
  const vorn = B.kurvenBeschriftung('Ost', 'gewaesser', { groesse: 1, pfad: p, lage: 0 });
  const hinten = B.kurvenBeschriftung('Ost', 'gewaesser', { groesse: 1, pfad: p, lage: 1 });
  assert.equal(vorn.tauglich, true);
  assert.equal(hinten.tauglich, true);
  assert.ok(hinten.mitte.x > vorn.mitte.x + 50,
    'die Zeile wandert wirklich (von ' + vorn.mitte.x.toFixed(1) + ' nach '
      + hinten.mitte.x.toFixed(1) + ')');
});

test('Ebene 18/4c — untauglich ist eine Antwort, kein Absturz', () => {
  // Zu kurz: der Text passt nicht auf den Pfad.
  const kurz = B.kurvenBeschriftung('Ein sehr langer Gewaessername', 'gewaesser',
    { groesse: 1, pfad: [{ x: 0, z: 0 }, { x: 4, z: 0 }] });
  assert.equal(kurz.tauglich, false);
  assert.match(kurz.grund, /zu kurz/);

  // Zu enge Biegung: ein Kringel von zwei Einheiten Radius.
  const kringel = [];
  for (let i = 0; i <= 24; i++) {
    const a = i / 24 * Math.PI * 1.9;
    kringel.push({ x: Math.cos(a) * 2, z: Math.sin(a) * 2 });
  }
  const eng = B.kurvenBeschriftung('Silberfluss', 'gewaesser', { groesse: 1, pfad: kringel });
  assert.equal(eng.tauglich, false);
  assert.ok(eng.grund.length > 0);

  // Kein Pfad, ein Punkt, Unsinn: alles derselbe ruhige Ausgang.
  for (const p of [undefined, null, [], [{ x: 0, z: 0 }], 'nein', [{ x: NaN, z: 0 }]]) {
    const r = B.kurvenBeschriftung('Ost', 'gewaesser', { groesse: 1, pfad: p });
    assert.equal(r.tauglich, false, 'Pfad ' + JSON.stringify(p));
  }
  // Ohne Text ebenso.
  assert.equal(B.kurvenBeschriftung('', 'gewaesser', { pfad: bogen(60, 4) }).tauglich, false);
});


/* ==========================================================================
   5 — Die Schicht: Quad statt Sprite, und der Rueckfall
   ========================================================================== */

function protokollKontext() {
  const log = [];
  const ctx = {
    log,
    save: () => log.push('save'),
    restore: () => log.push('restore'),
    translate: (x, y) => log.push('translate ' + x.toFixed(3) + ' ' + y.toFixed(3)),
    rotate: (w) => log.push('rotate ' + w.toFixed(5)),
    clearRect: (...a) => log.push('clearRect ' + a.join(',')),
    beginPath: () => log.push('beginPath'),
    arc: () => log.push('arc'),
    fill: () => log.push('fill'),
    strokeText: (t) => log.push('strokeText ' + t),
    fillText: (t) => log.push('fillText ' + t),
    measureText: () => ({ width: 0 })
  };
  for (const f of ['font', 'fillStyle', 'strokeStyle', 'lineWidth', 'lineJoin',
    'lineCap', 'miterLimit', 'textAlign', 'textBaseline']) {
    let wert;
    Object.defineProperty(ctx, f, { get: () => wert, set: (v) => { wert = v; } });
  }
  return ctx;
}
function fakeCanvas() {
  const ctx = protokollKontext();
  return { width: 0, height: 0, getContext: () => ctx };
}

/** Weltpfad als Quellenfeld, wie editor/selection.js ihn liefert. */
function pfadQuelle(extra) {
  return Object.assign({
    id: 1, text: 'Silberfluss', klasse: 'gewaesser', groesse: 1,
    x: 0, y: 3, z: 0, pfad: bogen(60, 6), pfadStempel: 'p7:1', lage: 0.5
  }, extra || null);
}

test('Ebene 18/5 — eine Quelle mit tauglichem Pfad wird ein liegendes Quad', () => {
  const schicht = B.neueSchicht({ canvasFabrik: fakeCanvas });
  assert.equal(schicht.abgleichen([pfadQuelle()]), 1);
  const obj = schicht.gruppe.children[0];
  assert.equal(obj.type, 'Mesh', 'kein Sprite — eine Kurve liegt in der Karte');
  assert.ok(Math.abs(obj.rotation.x + Math.PI / 2) < 1e-9, 'flach auf die Karte gedreht');
  assert.ok(obj.scale.x > 0 && obj.scale.y > 0);
  assert.equal(obj.userData.beschriftung.id, 1);

  // Zweiter Abgleich mit gleichem Inhalt baut nichts neu.
  const vorher = schicht.gruppe.children[0];
  schicht.abgleichen([pfadQuelle()]);
  assert.equal(schicht.gruppe.children[0], vorher, 'unveraendert = keine neue Textur');

  // Bewegt sich der Pfad, aendert sich der Stempel und die Textur wird neu.
  schicht.abgleichen([pfadQuelle({ pfadStempel: 'p7:2' })]);
  assert.notEqual(schicht.gruppe.children[0], vorher, 'verschobener Pfad -> neues Bild');
  schicht.entsorgen();
});

test('Ebene 18/5b — ohne tauglichen Pfad bleibt es beim Sprite', () => {
  const schicht = B.neueSchicht({ canvasFabrik: fakeCanvas });
  // Gar kein Pfad (Verweis ins Leere: selection.js haengt dann nichts an).
  schicht.abgleichen([pfadQuelle({ pfad: undefined, pfadStempel: undefined })]);
  assert.equal(schicht.gruppe.children[0].type, 'Sprite');
  schicht.entsorgen();

  // Pfad da, traegt den Text aber nicht: derselbe Rueckfall, kein Loch.
  const schicht2 = B.neueSchicht({ canvasFabrik: fakeCanvas });
  schicht2.abgleichen([pfadQuelle({ pfad: [{ x: 0, z: 0 }, { x: 3, z: 0 }] })]);
  assert.equal(schicht2.gruppe.children[0].type, 'Sprite',
    'ein Pfad, der den Text nicht traegt, wird gerade gesetzt');
  assert.equal(schicht2.anzahl, 1, 'und zwar genau einmal');
  schicht2.entsorgen();
});

test('Ebene 18/5c — das Quad steht an der Kurve, nicht am Ankerpunkt', () => {
  const schicht = B.neueSchicht({ canvasFabrik: fakeCanvas });
  // Anker weit weg: die Lage bestimmt der Pfad, nicht der Punkt.
  schicht.abgleichen([pfadQuelle({ x: 900, z: -900 })]);
  const obj = schicht.gruppe.children[0];
  assert.ok(Math.abs(obj.position.x) < 60, 'x an der Kurve: ' + obj.position.x);
  assert.ok(Math.abs(obj.position.z) < 60, 'z an der Kurve: ' + obj.position.z);
  assert.equal(obj.position.y, 3, 'die Hoehe kommt weiter aus der Quelle');
  schicht.entsorgen();
});
