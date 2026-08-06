/* ==========================================================================
   I1 — Kartenzeichen der uebrigen Generatoren
        (paths.js, objects.js, strukturen.js, vines.js, zeichen.js
         und die Reliefschattierung in world/terrain.js)

   11-signaturen prueft das Zeichenmodul fuer sich: Atlas, Baender, Groessen,
   Zeichenwahl. Diese Datei prueft die andere Haelfte — ob die Generatoren
   das Modul auch benutzen, und zwar lueckenlos.

   Sechs Zusagen:

   1  KEINE LUECKE. Fuer jede Sache, die einer dieser Generatoren erzeugt,
      steht auf jedem Massstab der Leiter entweder ein Koerper oder ein
      Zeichen — und wo nichts steht, steht es SO IM KATALOG. Das ist die
      wichtigste Pruefung der Datei: eine Luecke heisst, dass bei diesem Zoom
      die Strasse verschwindet, und das sieht aus wie ein Fehler, weil es
      einer ist.
   2  DETERMINISMUS. Zweimal erzeugt, bitgleich — auf Kartenmassstab genauso
      wie auf Ortsmassstab, und ueber einen Massstabswechsel hinweg.
   3  ZUSAMMENZEICHNEN. Die Kennzahl entsteht auf ORTSMASSSTAB, wird mit dem
      Element gespeichert und auf Kartenmassstab nur gelesen. Die Schwellen
      sind an ihren Grenzfaellen eindeutig.
   4  LINIENSIGNATUREN. Reihenfolge, keine NaN — und an der Kachelgrenze
      keine Luecke, gemessen statt behauptet.
   5  RELIEFSCHATTIERUNG. Unterhalb der Schwelle BITGLEICH zum Bestand
      (gegen einen Hash, der vor dem Eingriff aufgenommen wurde), oberhalb
      messbar wirksam und in der richtigen Richtung.
   6  GRATE. Auf einem Gebirgsprofil finden sie den Kamm und nicht die
      Flanke. Gemessen wird der Abstand zur Kammlinie.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeTerra } from './hilfen/laden.mjs';
import { testWelt } from './hilfen/karte.mjs';
import { Hasher } from './hilfen/hash.mjs';

const SIG = await ladeTerra('render/signaturen.js');
const ZEI = await ladeTerra('generators/zeichen.js');

/* Eine Welt fuer die ganze Datei. Die Generatoren haengen an Modulzustand
   (Poolregistrierung, Hoehenfeld), zwei Welten nebeneinander gibt es nicht —
   Tests, die das Hoehenfeld veraendern, stellen es selbst wieder her.

   ACHTUNG, und das ist die Falle: dieser Aufruf laeuft beim IMPORT, nicht beim
   ersten Test. Ueber terra/test/index.mjs werden alle Dateien zuerst geladen
   und erst danach die Tests ausgefuehrt — bis dahin haben dreizehn andere
   Dateien dasselbe Hoehenfeld ueberschrieben, und diese Welt zeigt auf ein
   Gelaende, das es nicht mehr gibt. Im Alleinlauf faellt das nicht auf.

    stellt sie deshalb vor jedem Test wieder her. Es ist
   derselbe Aufruf, nur zur richtigen Zeit. */
const welt = await testWelt({ seed: 4711, biom: 'wiese' });

async function frischeWelt() {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  welt.m = w.m;
  return welt;
}
test.beforeEach(frischeWelt);
const { S, KARTE, WATER } = welt.m.store;
const { POOLS } = welt.m.pools;
const T = welt.m.terrain;
const OBJ = welt.m.objects;

/** Massstabsleiter der Pruefung: die vier Ankerpunkte, alle Uebergabepunkte
 *  und die Raender des Ueberblendbereichs. */
const LEITER = [1, 4, 25, 60, 96, 250, 600, 900, 1200, 1600, 2000, 2500, 4000];

/** Alles, was ein Element hervorgebracht hat — Instanzen UND eigene Meshes.
 *  Beides zaehlt: eine Liniensignatur ist ein Mesh, kein Pool. */
function ausbeute(el) {
  let instanzen = 0, koerper = 0, zeichen = 0;
  for (const k of Object.keys(el.inst)) {
    const n = el.inst[k].length / 12;
    instanzen += n;
    if (POOLS[k] && POOLS[k].karte) zeichen += n; else koerper += n;
  }
  const meshes = el.group ? el.group.children.length : 0;
  const kartenMeshes = el.group
    ? el.group.children.filter((c) => c.material === ZEI.kartenBandMat()).length : 0;
  return { instanzen, koerper, zeichen, meshes, kartenMeshes,
    etwas: instanzen + meshes > 0, zeichenhaft: zeichen + kartenMeshes > 0 };
}


/* ==========================================================================
   1 — Keine Luecke

   Die Faelle decken jeden Generator dieser Runde ab. `sache`/`art` sind das,
   was der Generator dem Katalog meldet; daraus wird die ERWARTUNG gerechnet,
   statt sie hinzuschreiben. Dadurch prueft der Test nicht „steht etwas da",
   sondern „steht genau das da, was der Katalog vorschreibt" — und ein
   Weglassen ist nur dann in Ordnung, wenn der Katalog es weglaesst.
   ========================================================================== */

const FAELLE = [
  { name: 'Handelsstrasse (Vorgabebreite 6)', kind: 'pfad', variant: 'strasse',
    punkte: [{ x: -70, z: -60 }, { x: -20, z: -30 }, { x: 30, z: -20 }],
    sache: 'strasse', art: 'sig_handelsstrasse' },
  { name: 'Saumpfad (Breite 2)', kind: 'pfad', variant: 'strasse',
    punkte: [{ x: -70, z: -70 }, { x: -20, z: -66 }],
    extra: { breite: 2 }, sache: 'strasse', art: 'sig_saumpfad' },
  { name: 'Mauer', kind: 'pfad', variant: 'mauer',
    punkte: [{ x: 10, z: 62 }, { x: 55, z: 66 }, { x: 84, z: 46 }],
    sache: 'grenze', art: 'sig_grenze' },
  { name: 'Fluss', kind: 'pfad', variant: 'fluss',
    punkte: [{ x: -85, z: 8 }, { x: -40, z: 24 }, { x: 8, z: 58 }],
    sache: 'gewaesser', art: 'sig_fluss' },
  { name: 'Hecke', kind: 'pfad', variant: 'hecke',
    punkte: [{ x: -75, z: -10 }, { x: -40, z: 0 }],
    sache: 'grenze', art: 'sig_grenze' },
  { name: 'Bruchkante', kind: 'pfad', variant: 'bruch',
    punkte: [{ x: 58, z: -82 }, { x: 84, z: -46 }],
    sache: 'bruch', art: 'sig_bruchkante' },
  { name: 'Burg', kind: 'flaeche', variant: 'burg',
    punkte: [{ x: 54, z: -76 }, { x: 84, z: -78 }, { x: 87, z: -50 }, { x: 57, z: -48 }],
    sache: 'wehrbau', art: 'sig_burg' },
  { name: 'Werft', kind: 'flaeche', variant: 'werft',
    punkte: [{ x: 74, z: 0 }, { x: 104, z: 2 }, { x: 106, z: 30 }, { x: 76, z: 28 }],
    sache: 'hafen', art: 'sig_hafen' },
  { name: 'Kloster', kind: 'flaeche', variant: 'kloster',
    punkte: [{ x: -86, z: 30 }, { x: -56, z: 28 }, { x: -53, z: 58 }, { x: -84, z: 60 }],
    sache: 'wehrbau', art: 'sig_kloster' },
  { name: 'Baumgruppe', kind: 'objekt', variant: 'baeume',
    punkte: [{ x: -45, z: 40 }], extra: { anzahl: 14, streuung: 12 }, sache: 'wald' },
  { name: 'Haeusergruppe', kind: 'objekt', variant: 'haeuser',
    punkte: [{ x: -45, z: 44 }], extra: { anzahl: 8, streuung: 12 }, sache: 'ort' },
  { name: 'Felsgruppe (Grat)', kind: 'objekt', variant: 'felsen',
    punkte: [{ x: 70, z: 78 }], extra: { anzahl: 9, streuung: 14 },
    sache: 'gebirge', art: 'sig_grat' },
  { name: 'Moor', kind: 'objekt', variant: 'moor',
    punkte: [{ x: -60, z: 40 }], extra: { anzahl: 6, streuung: 8 },
    sache: 'nass', art: 'sig_moor' },
  { name: 'Arborhain', kind: 'objekt', variant: 'arbor',
    punkte: [{ x: -50, z: 10 }], extra: { anzahl: 6, streuung: 8 },
    sache: 'arbor', art: 'sig_rankenfuss' },
  { name: 'Naturufer (Kueste)', kind: 'objekt', variant: 'ufer2',
    punkte: [{ x: 92, z: 0 }], extra: { anzahl: 6, streuung: 8 },
    sache: 'gewaesser', art: 'sig_kueste' },
  { name: 'Schwebeinseln', kind: 'objekt', variant: 'inseln',
    punkte: [{ x: 0, z: -62 }], sache: 'arbor', art: 'sig_lichtbruecke' },
  /* Die beiden bewusst weggelassenen: `sache: null` heisst „auf
     Kartenmassstab gibt es dazu nichts", und OBJEKT_ZEICHEN nennt den
     Grund. Der Test prueft weiter unten, dass der Grund auch dasteht. */
  { name: 'Requisiten (bewusst ohne Zeichen)', kind: 'objekt', variant: 'requisiten',
    punkte: [{ x: -45, z: 48 }], extra: { anzahl: 6, streuung: 8 }, sache: null },
  { name: 'Schwebendes (bewusst ohne Zeichen)', kind: 'objekt', variant: 'schwebend',
    punkte: [{ x: -20, z: 40 }], extra: { anzahl: 6, streuung: 8 }, sache: null },
  { name: 'Ranke', kind: 'ranke', variant: 'ranke',
    punkte: [{ x: -30, z: 20 }], sache: 'arbor', art: 'sig_ranke' }
];

/** Legt den Fall an und erzeugt ihn einmal auf Ortsmassstab — dort entsteht
 *  die Kennzahl, genau wie im Editor. */
function baueFall(f, seed) {
  const el = welt.element(f.kind, f.variant, f.punkte, f.extra || null, seed || 0x7100);
  S.einheitMeter = 1;
  welt.erzeuge(el);
  return el;
}

test('I1 — keine Luecke: auf jedem Massstab Koerper oder Zeichen', () => {
  const luecken = [], ueberzaehlig = [];
  for (let i = 0; i < FAELLE.length; i++) {
    const f = FAELLE[i];
    const el = baueFall(f, 0x7100 + i * 7);
    const start = ausbeute(el);
    assert.ok(start.etwas, f.name + ': erzeugt schon auf Ortsmassstab nichts — '
      + 'der Fall taugt nicht als Pruefung');
    for (const m of LEITER) {
      S.einheitMeter = m;
      welt.erzeuge(el);
      const a = ausbeute(el);
      // Bis zum oberen Rand des Ueberblendbereichs stehen die Koerper.
      // Darueber entscheidet allein der Katalog.
      const erwartet = m <= SIG.UEBERGABE.koerper * SIG.BLENDE ? true
        : (f.sache
          ? SIG.zeichenFuer(f.sache, el.kennzahl, m, { art: f.art }).length > 0
          : false);
      if (erwartet && !a.etwas) luecken.push(f.name + ' bei ' + m + ' m/Zelle');
      if (!erwartet && a.etwas) {
        ueberzaehlig.push(f.name + ' bei ' + m + ' m/Zelle: ' + JSON.stringify(a));
      }
    }
    welt.m.store.dropElement(el);
  }
  assert.deepEqual(luecken, [],
    'Bei diesem Zoom verschwindet die Sache ersatzlos — genau das ist die Luecke');
  assert.deepEqual(ueberzaehlig, [],
    'Hier steht etwas, das der Katalog auf diesem Massstab weglaesst');
});

test('I1 — ueber dem Band steht kein Koerper mehr, nur noch Karte', () => {
  const reste = [];
  for (let i = 0; i < FAELLE.length; i++) {
    const f = FAELLE[i];
    const el = baueFall(f, 0x7200 + i * 7);
    S.einheitMeter = 2000;
    welt.erzeuge(el);
    const a = ausbeute(el);
    if (a.koerper > 0) reste.push(f.name + ': ' + a.koerper + ' Koerperinstanzen');
    // Eigene Meshes duerfen oben nur noch KARTENbaender sein.
    if (a.meshes !== a.kartenMeshes) {
      reste.push(f.name + ': ' + (a.meshes - a.kartenMeshes) + ' Koerpermeshes');
    }
    welt.m.store.dropElement(el);
  }
  assert.deepEqual(reste, [],
    'Auf Kontinentmassstab bleibt Landschaft stehen, wo Karte sein sollte');
});

test('I1 — jede Objektvariante ist eingetragen, jedes Weglassen begruendet', () => {
  const fehlt = [], ohneGrund = [];
  const namen = Object.keys(OBJ.OBJGRUPPEN).concat(['inseln']);
  for (const v of namen) {
    const Z = OBJ.OBJEKT_ZEICHEN[v];
    if (!Z) { fehlt.push(v); continue; }
    if (Z.auf !== undefined && !(typeof Z.auf === 'string' && Z.auf.length > 8)) {
      ohneGrund.push(v);
    }
    if (Z.sache && !SIG.SACHEN[Z.sache]) fehlt.push(v + ' -> unbekannte Sache ' + Z.sache);
    if (Z.art && !SIG.ZEICHEN[Z.art]) fehlt.push(v + ' -> unbekanntes Zeichen ' + Z.art);
  }
  assert.deepEqual(fehlt, [],
    'Diese Objektgruppen verschwinden auf Kartenmassstab, ohne dass es jemand '
    + 'entschieden haette');
  assert.deepEqual(ohneGrund, [],
    'Ein Weglassen ohne Begruendung ist von einer Luecke nicht zu unterscheiden');
});

test('I1 — die Sachen der Pfade und Strukturen decken die Leiter lueckenlos', () => {
  /* Der Katalog verspricht fuer jede Sache eine Kette OHNE Loch (11-signaturen
     prueft das fuer alle). Hier wird nachgesehen, dass die Generatoren
     ausschliesslich solche Sachen benutzen — eine erfundene Sache waere
     stumm. */
  const benutzt = ['strasse', 'grenze', 'gewaesser', 'bruch', 'wehrbau', 'hafen',
    'ort', 'wald', 'gebirge', 'nass', 'arbor', 'acker', 'ruine', 'werk',
    'trocken', 'kalt'];
  const kaputt = [];
  for (const s of benutzt) {
    if (!SIG.SACHEN[s]) { kaputt.push(s + ': gibt es nicht'); continue; }
    let von = SIG.MASSSTAB_MIN;
    for (const st of SIG.SACHEN[s].kette) {
      if (Math.abs(st.von - von) > 1e-9) kaputt.push(s + ': Loch bei ' + von);
      von = st.bis;
    }
    if (von < SIG.MASSSTAB_MAX) kaputt.push(s + ': Kette endet bei ' + von);
  }
  assert.deepEqual(kaputt, []);
});


/* ==========================================================================
   2 — Determinismus
   ========================================================================== */

/** Vollstaendiger Ergebnishash eines Elements — Instanzen, Schatten, Rauch
 *  und alle eigenen Meshes samt Attributen. Wie hashElement in hilfen/karte,
 *  hier aber zusaetzlich mit den UV (die Liniensignatur steckt genau dort). */
function hashElement(el) {
  const h = new Hasher();
  h.text(el.kind).text(String(el.variant)).zahl(el.kennzahl === undefined ? -1 : el.kennzahl);
  for (const p of Object.keys(el.inst).sort()) h.text(p).folge(el.inst[p]);
  h.text('#schatten').folge(el.schatten);
  const kinder = el.group ? el.group.children : [];
  h.zahl(kinder.length);
  for (const k of kinder) {
    h.zahl(k.renderOrder);
    const g = k.geometry;
    if (!g) { h.text('#ohne'); continue; }
    for (const n of Object.keys(g.attributes).sort()) {
      h.text(n).zahl(g.attributes[n].itemSize).folge(g.attributes[n].array);
    }
    h.folge(g.index ? g.index.array : null);
  }
  return h.hex();
}

test('I1 — zweimal erzeugt ist bitgleich, auf jedem Massstab', () => {
  const abweichend = [];
  for (let i = 0; i < FAELLE.length; i++) {
    const f = FAELLE[i];
    const el = baueFall(f, 0x7300 + i * 7);
    for (const m of [1, 250, 2000]) {
      S.einheitMeter = m;
      welt.erzeuge(el);
      const a = hashElement(el);
      welt.erzeuge(el);
      const b = hashElement(el);
      if (a !== b) abweichend.push(f.name + ' bei ' + m);
    }
    welt.m.store.dropElement(el);
  }
  assert.deepEqual(abweichend, []);
});

test('I1 — ein Massstabswechsel hin und zurueck aendert nichts', () => {
  /* Der Fehler, den diese Pruefung sucht: ein Generator, der auf
     Kartenmassstab etwas am Element aendert (typisch: die Kennzahl neu
     schaetzt) und damit das Ortsbild beim naechsten Aufbau verschiebt. */
  const abweichend = [];
  for (let i = 0; i < FAELLE.length; i++) {
    const f = FAELLE[i];
    const el = baueFall(f, 0x7400 + i * 7);
    S.einheitMeter = 1;
    welt.erzeuge(el);
    const vorher = hashElement(el);
    for (const m of [250, 2000, 4000, 60]) { S.einheitMeter = m; welt.erzeuge(el); }
    S.einheitMeter = 1;
    welt.erzeuge(el);
    if (hashElement(el) !== vorher) abweichend.push(f.name);
    welt.m.store.dropElement(el);
  }
  assert.deepEqual(abweichend, []);
});


/* ==========================================================================
   3 — Zusammenzeichnen
   ========================================================================== */

test('I1 — die Kennzahl entsteht auf Ortsmassstab und wird oben nur gelesen', () => {
  const el = welt.element('objekt', 'haeuser', [{ x: -45, z: 44 }],
    { anzahl: 8, streuung: 12 }, 0x7501);
  S.einheitMeter = 1;
  welt.erzeuge(el);
  let gesetzt = 0;
  for (const k of Object.keys(el.inst)) if (!POOLS[k].karte) gesetzt += el.inst[k].length / 12;
  // fensterlicht und Rauchquellen sind keine Baukoerper; die Kennzahl zaehlt
  // Platzierungen, nicht Instanzen — sie darf also hoechstens so gross sein.
  assert.ok(el.kennzahl > 0 && el.kennzahl <= gesetzt,
    'Kennzahl ' + el.kennzahl + ' passt nicht zu ' + gesetzt + ' Instanzen');
  const ort = el.kennzahl;
  for (const m of [250, 900, 2000, 4000]) {
    S.einheitMeter = m;
    welt.erzeuge(el);
    assert.equal(el.kennzahl, ort,
      'Bei ' + m + ' m/Zelle wurde die Kennzahl neu geschaetzt — genau das darf nie '
      + 'passieren, sonst haengt die Signatur am zuletzt geoeffneten Massstab');
  }
  welt.m.store.dropElement(el);
});

test('I1 — die Ortsschwellen sind an ihren Grenzfaellen eindeutig', () => {
  const el = welt.element('objekt', 'haeuser', [{ x: -45, z: 44 }],
    { anzahl: 8, streuung: 12 }, 0x7502);
  S.einheitMeter = 250;
  const zeichenBei = (k) => {
    el.kennzahl = k;
    welt.erzeuge(el);
    return Object.keys(el.inst).filter((n) => POOLS[n].karte).sort();
  };
  assert.deepEqual(zeichenBei(8), ['sig_weiler'], '8 Baukoerper sind noch ein Weiler');
  assert.deepEqual(zeichenBei(9), ['sig_dorf'], '9 Baukoerper sind schon ein Dorf');
  assert.deepEqual(zeichenBei(40), ['sig_dorf'], '40 ist noch ein Dorf');
  assert.deepEqual(zeichenBei(41), ['sig_stadt'], '41 ist schon eine Stadt');
  assert.deepEqual(zeichenBei(150), ['sig_stadt'], '150 traegt noch keinen Mauerkranz');
  assert.deepEqual(zeichenBei(151), ['sig_stadt', 'sig_stadtmauer'],
    'ueber 150 kommt der Mauerkranz DAZU, er ersetzt nichts');
  // Ohne Kennzahl faellt die Wahl auf den Weiler — ein zu klein gezeichneter
  // Ort ist ein Fehler zweiter Ordnung, eine erfundene Stadt einer erster.
  el.kennzahl = undefined;
  welt.erzeuge(el);
  assert.deepEqual(Object.keys(el.inst).filter((n) => POOLS[n].karte), ['sig_weiler']);
  welt.m.store.dropElement(el);
});

test('I1 — eine Gruppe bekommt EIN Zeichen, nicht eines je Objekt', () => {
  const el = welt.element('objekt', 'felsen', [{ x: -45, z: 44 }],
    { anzahl: 12, streuung: 6 }, 0x7503);
  S.einheitMeter = 1;
  welt.erzeuge(el);
  const koerper = el.kennzahl;
  assert.ok(koerper > 3, 'Der Fall braucht mehrere Koerper, hat aber ' + koerper);
  S.einheitMeter = 2000;
  welt.erzeuge(el);
  let zeichen = 0;
  for (const k of Object.keys(el.inst)) if (POOLS[k].karte) zeichen += el.inst[k].length / 12;
  assert.ok(zeichen > 0 && zeichen < koerper,
    'Aus ' + koerper + ' Felsen wurden ' + zeichen + ' Zeichen — das ist keine '
    + 'Verdichtung');
  welt.m.store.dropElement(el);
});


/* ==========================================================================
   4 — Liniensignaturen
   ========================================================================== */

/** Das Kartenband eines Elements (oder null). */
function bandVon(el) {
  const kinder = el.group ? el.group.children : [];
  for (const k of kinder) if (k.material === ZEI.kartenBandMat()) return k;
  return null;
}

test('I1 — die Liniensignatur ist ein gekacheltes Band ohne NaN', () => {
  const el = welt.element('pfad', 'strasse',
    [{ x: -70, z: -60 }, { x: -20, z: -30 }, { x: 30, z: -20 }], null, 0x7601);
  S.einheitMeter = 250;
  welt.erzeuge(el);
  const mesh = bandVon(el);
  assert.ok(mesh, 'Auf Regionsmassstab hat die Strasse kein Band');
  const g = mesh.geometry;
  for (const n of ['position', 'color', 'uv']) {
    assert.ok(g.attributes[n], 'Dem Band fehlt das Attribut ' + n);
    const a = g.attributes[n].array;
    for (let i = 0; i < a.length; i++) {
      assert.ok(Number.isFinite(a[i]), n + '[' + i + '] ist ' + a[i]);
    }
  }
  assert.equal(g.attributes.color.itemSize, 4,
    'Die Verblassung steckt im Alphakanal — ohne vierte Komponente blendet das '
    + 'Band nicht ein, sondern springt');
  // Deckung: im Band, aber nicht null (sonst waere das Band unsichtbar).
  const alpha = g.attributes.color.array[3];
  assert.ok(alpha > 0 && alpha <= 1, 'Deckung ' + alpha);
  assert.ok(g.index && g.index.array.length % 6 === 0, 'Der Index ist kein Streifen');
  welt.m.store.dropElement(el);
});

test('I1 — an der Kachelgrenze klafft keine Luecke (gemessen)', () => {
  const el = welt.element('pfad', 'strasse',
    [{ x: -70, z: -60 }, { x: -20, z: -30 }, { x: 30, z: -20 }], null, 0x7602);
  S.einheitMeter = 250;
  welt.erzeuge(el);
  const g = bandVon(el).geometry;
  const P = ZEI.PUNKTE_JE_KACHEL;
  const proKachel = (P + 1) * 2;
  const anzahl = g.attributes.position.count;
  assert.equal(anzahl % proKachel, 0, 'Die Kacheln sind nicht gleich lang');
  const kacheln = anzahl / proKachel;
  assert.ok(kacheln > 3, 'Der Fall braucht mehrere Kacheln, hat aber ' + kacheln);

  const pos = g.attributes.position.array, uv = g.attributes.uv.array;
  const streifen = SIG.atlasStreifenUV('sig_handelsstrasse');
  let maxSprung = 0, maxUAbweichung = 0;
  for (let k = 0; k + 1 < kacheln; k++) {
    // letzte Station der Kachel k gegen erste Station der Kachel k+1
    const a = (k * proKachel + P * 2) * 3, b = ((k + 1) * proKachel) * 3;
    for (let seite = 0; seite < 2; seite++) {
      const dx = pos[a + seite * 3] - pos[b + seite * 3];
      const dy = pos[a + seite * 3 + 1] - pos[b + seite * 3 + 1];
      const dz = pos[a + seite * 3 + 2] - pos[b + seite * 3 + 2];
      maxSprung = Math.max(maxSprung, Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
    const uEnde = uv[(k * proKachel + P * 2) * 2];
    const uAnfang = uv[((k + 1) * proKachel) * 2];
    maxUAbweichung = Math.max(maxUAbweichung,
      Math.abs(uEnde - streifen[2]), Math.abs(uAnfang - streifen[0]));
  }
  /* Der gemessene Sprung MUSS exakt null sein: beide Stationen rechnen
     dieselbe Bogenlaenge (k+1)*kl aus demselben Ausdruck. Waere er es nicht,
     klaffte an jeder Naht ein Loch im Band. */
  assert.equal(maxSprung, 0,
    'An der Kachelgrenze liegen die Vertices ' + maxSprung + ' auseinander');
  /* Und das u springt exakt vom Ende des INHALTSKASTENS auf seinen Anfang —
     nicht auf den Feldrand. Genau dort setzen die Streifenmaler ihren
     Ueberstand an, deshalb trifft an der Naht Strichmitte auf Strichmitte. */
  assert.ok(maxUAbweichung < 1e-7,
    'Die Kachelung laeuft nicht auf dem Inhaltskasten (' + maxUAbweichung + ')');
  welt.m.store.dropElement(el);
});

test('I1 — das Band laeuft in Pfadrichtung, monoton und mittig', () => {
  const punkte = [{ x: -70, z: -60 }, { x: -20, z: -30 }, { x: 30, z: -20 }];
  const el = welt.element('pfad', 'strasse', punkte, null, 0x7603);
  S.einheitMeter = 250;
  welt.erzeuge(el);
  const g = bandVon(el).geometry;
  const pos = g.attributes.position.array;
  const n = g.attributes.position.count;
  // Mittellinie je Station: der Mittelwert beider Bandkanten.
  const mitte = [];
  for (let i = 0; i < n; i += 2) {
    mitte.push({ x: (pos[i * 3] + pos[(i + 1) * 3]) * 0.5,
      z: (pos[i * 3 + 2] + pos[(i + 1) * 3 + 2]) * 0.5 });
  }
  let rueckwaerts = 0, gesamt = 0, nahtstellen = 0;
  for (let i = 1; i < mitte.length; i++) {
    const dx = mitte[i].x - mitte[i - 1].x, dz = mitte[i].z - mitte[i - 1].z;
    const l = Math.sqrt(dx * dx + dz * dz);
    // Die Nahtstellen sind Doppelkanten: Schrittweite exakt null. Genau das
    // ist die Zusage aus der Pruefung darueber, hier also kein Rueckschritt.
    if (l === 0) { nahtstellen++; continue; }
    gesamt += l;
    // Fortschritt gegen die Gesamtrichtung des Pfades
    if (dx * (punkte[2].x - punkte[0].x) + dz * (punkte[2].z - punkte[0].z) <= 0) rueckwaerts++;
  }
  assert.ok(nahtstellen > 0, 'Das Band hat gar keine Kachelgrenzen');
  assert.equal(rueckwaerts, 0, 'Das Band laeuft an ' + rueckwaerts + ' Stellen zurueck');
  const luft = Math.abs(gesamt - welt.m.paths.pathSamples(punkte, 1.6).len);
  assert.ok(luft < gesamt * 0.02,
    'Das Band ist ' + gesamt + ' lang, der Pfad aber anders (' + luft + ')');
  welt.m.store.dropElement(el);
});

test('I1 — die Bandbreite ist die Signaturbreite, nicht die Wegbreite', () => {
  const el = welt.element('pfad', 'strasse',
    [{ x: -70, z: -60 }, { x: -20, z: -30 }], { breite: 6 }, 0x7604);
  S.einheitMeter = 250;
  welt.erzeuge(el);
  const g = bandVon(el).geometry;
  const pos = g.attributes.position.array;
  const dx = pos[0] - pos[3], dz = pos[2] - pos[5];
  const breite = Math.sqrt(dx * dx + dz * dz);
  const soll = SIG.ZEICHEN.sig_handelsstrasse.anteil * KARTE.map;
  assert.ok(Math.abs(breite - soll) < 1e-4,
    'Bandbreite ' + breite + ', Katalog verlangt ' + soll);
  assert.ok(breite < 6, 'Das Band ist so breit wie die Fahrbahn — dann ist es keine '
    + 'Signatur, sondern eine verkleinerte Strasse');
  welt.m.store.dropElement(el);
});

test('I1 — die Flussbreite folgt dem Parameter, nicht dem Zufall', () => {
  const schmal = welt.m.paths.flussBreite({ breite: 4 });
  const breit = welt.m.paths.flussBreite({ breite: 36 });
  assert.ok(schmal < 1 && breit > 1 && breit <= 2.4,
    'Der Breitenfaktor stuft nicht: ' + schmal + ' / ' + breit);
  assert.equal(welt.m.paths.flussBreite({ breite: 9 }), 1,
    'Die Vorgabebreite muss der Bezugspunkt sein');
  // Und er wirkt auch wirklich auf die Geometrie.
  const messe = (b) => {
    const el = welt.element('pfad', 'fluss',
      [{ x: -85, z: 8 }, { x: -40, z: 24 }], { breite: b }, 0x7605);
    S.einheitMeter = 250;
    welt.erzeuge(el);
    const pos = bandVon(el).geometry.attributes.position.array;
    const dx = pos[0] - pos[3], dz = pos[2] - pos[5];
    welt.m.store.dropElement(el);
    return Math.sqrt(dx * dx + dz * dz);
  };
  assert.ok(messe(36) > messe(4) * 1.5, 'Ein breiter Fluss zeichnet keine breitere Linie');
});

test('I1 — die Kettenzeichen der Bruchkante stehen auf Stoss und drehen mit', () => {
  // Bewusst drei Punkte: an einer Geraden traegt jedes Zeichen denselben
  // Gierwinkel, und dann pruefte der Test nichts.
  const el = welt.element('pfad', 'bruch',
    [{ x: 58, z: -82 }, { x: 76, z: -70 }, { x: 84, z: -46 }], null, 0x7606);
  S.einheitMeter = 2000;
  welt.erzeuge(el);
  const a = el.inst.sig_bruchkante;
  assert.ok(a && a.length >= 24, 'Die Bruchkante hat keine Zeichenkette');
  let letzterYaw = null, drehungen = 0;
  for (let i = 0; i < a.length; i += 12) {
    for (let k = 0; k < 12; k++) assert.ok(Number.isFinite(a[i + k]), 'NaN in der Kette');
    if (letzterYaw !== null && Math.abs(a[i + 4] - letzterYaw) > 1e-9) drehungen++;
    letzterYaw = a[i + 4];
  }
  assert.ok(drehungen > 0, 'Alle Zeichen tragen denselben Gierwinkel — sie folgen '
    + 'der Kante also nicht');
  // Sie leuchten: der Arbortint liegt ueber 1, sonst traegt er keinen Bluetesaum.
  assert.ok(a[9] > 1 && a[10] > 1 && a[11] > 1,
    'Die Bruchkante leuchtet nicht (' + a.slice(9, 12).join(', ') + ')');
  welt.m.store.dropElement(el);
});

test('I1 — die vier Arborzeichen der Ranke haengen an Elementdaten', () => {
  const einFuss = welt.element('ranke', 'ranke', [{ x: -30, z: 20 }], null, 0x7701);
  const dreiFuss = welt.element('ranke', 'ranke',
    [{ x: -30, z: 20 }, { x: -22, z: 26 }, { x: -34, z: 30 }],
    { bruecken: true }, 0x7702);
  S.einheitMeter = 2000;
  welt.erzeuge(einFuss);
  welt.erzeuge(dreiFuss);
  const namen = (el) => Object.keys(el.inst).filter((n) => POOLS[n].karte).sort();
  assert.deepEqual(namen(einFuss), ['sig_ranke', 'sig_rankenfuss'],
    'Eine einzelne Ranke bekommt Lichtsaeule und Fuss');
  assert.deepEqual(namen(dreiFuss),
    ['sig_arborknoten', 'sig_lichtbruecke', 'sig_ranke', 'sig_rankenfuss'],
    'Wo sich Aeste vereinigen, gehoert der Knoten hin — und Bruecken eine Lichtbruecke');
  assert.equal(einFuss.inst.sig_ranke.length / 12, 1);
  assert.equal(dreiFuss.inst.sig_ranke.length / 12, 3, 'je Fuss eine Lichtsaeule');
  // Arbor ist das einzige, was auf der Karte leuchtet.
  const tint = dreiFuss.inst.sig_ranke.slice(9, 12);
  assert.ok(tint.every((c) => c > 1), 'Die Ranke leuchtet nicht: ' + tint.join(', '));
  welt.m.store.dropElement(einFuss);
  welt.m.store.dropElement(dreiFuss);
});

test('I1 — eine Wasserquerung bekommt Bruecke oder Furt, je nach Tiefe', () => {
  /* Der Weg laeuft vom Ostufer ins Meer und wieder heraus; bandGeoAusLinie
     baut dort auf Ortsmassstab eine Bruecke, auf Kartenmassstab muss dort
     ein Uebergangszeichen stehen. */
  const el = welt.element('pfad', 'strasse',
    [{ x: 70, z: -30 }, { x: 100, z: -10 }, { x: 70, z: 20 }], null, 0x7901);
  S.einheitMeter = 250;
  welt.erzeuge(el);
  const namen = Object.keys(el.inst).filter((n) => POOLS[n].karte);
  assert.ok(namen.includes('sig_bruecke') || namen.includes('sig_furt'),
    'Der Weg quert Wasser, traegt aber kein Uebergangszeichen: ' + namen.join(', '));
  // Und auf Regionsmassstab ist Schluss damit — der Katalog: „eine Bruecke
  // gehoert auf keine Regionskarte".
  S.einheitMeter = 2000;
  welt.erzeuge(el);
  const oben = Object.keys(el.inst).filter((n) => POOLS[n].karte);
  assert.ok(!oben.includes('sig_bruecke') && !oben.includes('sig_furt'),
    'Auf Kontinentmassstab steht noch ein Uebergangszeichen: ' + oben.join(', '));
  welt.m.store.dropElement(el);
});

test('I1 — nurTyp entscheidet ueber das Zeichen, nicht die Gruppe', () => {
  const el = welt.element('objekt', 'baeume', [{ x: -45, z: 44 }],
    { anzahl: 4, streuung: 8, nurTyp: 'turm' }, 0x7902);
  S.einheitMeter = 1;
  welt.erzeuge(el);
  S.einheitMeter = 250;
  welt.erzeuge(el);
  assert.deepEqual(Object.keys(el.inst).filter((n) => POOLS[n].karte), ['sig_turm'],
    'Vier Tuerme sind kein Hain');
  welt.m.store.dropElement(el);
});

test('I1 — jeder Eintrag in POOL_ZEICHEN nennt echte Pools und echte Zeichen', () => {
  const kaputt = [];
  for (const k of Object.keys(OBJ.POOL_ZEICHEN)) {
    if (!POOLS[k]) kaputt.push(k + ': kein Pool');
    const Z = OBJ.POOL_ZEICHEN[k];
    if (!SIG.SACHEN[Z.sache]) kaputt.push(k + ': Sache ' + Z.sache);
    if (!SIG.ZEICHEN[Z.art]) kaputt.push(k + ': Zeichen ' + Z.art);
  }
  assert.deepEqual(kaputt, []);
});

test('I1 — das Kuestenband liegt auf der Wasserlinie', () => {
  const el = welt.element('objekt', 'ufer2', [{ x: 92, z: 0 }],
    { anzahl: 6, streuung: 8 }, 0x7801);
  S.einheitMeter = 250;
  welt.erzeuge(el);
  const mesh = bandVon(el);
  assert.ok(mesh, 'Das Naturufer hat kein Kuestenband');
  const pos = mesh.geometry.attributes.position.array;
  let daneben = 0, n = 0;
  for (let i = 0; i < pos.length; i += 3) {
    n++;
    // Die Wasserlinie ist die Hoehe WATER; das Band schwebt darueber.
    if (Math.abs(T.heightAt(pos[i], pos[i + 2]) - WATER) > 1.2) daneben++;
  }
  assert.ok(daneben / n < 0.25,
    daneben + ' von ' + n + ' Bandpunkten liegen nicht am Wasser');
  welt.m.store.dropElement(el);
});


/* ==========================================================================
   5 — Reliefschattierung
   ========================================================================== */

/* Der BESTAND der Farbrechnung — aufgenommen als Kennzahlen statt als Hash.

   Urspruenglich stand hier ein Hash, aufgenommen am 27.07.2026 BEVOR der
   Reliefzweig in terrainColor eingebaut wurde. Er lief ueber die volle
   64-Bit-Mantisse und war damit plattformabhaengig: gemessen am 29.07.2026
   zwischen Windows und dem Linux-CI-Runner weichen einzelne Farbwerte um
   genau 1 ULP ab — 1.11e-16 relativ, das sind 2.8e-14 einer 8-Bit-Farbstufe.
   Das Hoehenfeld ist auf beiden Plattformen bitgleich und die three-Fassung
   dieselbe; es ist reines Rundungsrauschen der letzten Stelle. Der Hash machte
   daraus einen dauerhaft roten Test, obwohl sich an der Rechnung nichts
   geaendert hatte. Vor dem Hashen zu kuerzen hilft nicht — das verschiebt die
   Rundungsgrenze nur, und bei 7803 Werten liegt einer nah genug daran, um
   trotzdem zu kippen.

   Die Zusage ist deshalb zweigeteilt. Dass sich unterhalb der Schwelle nichts
   aendert, wird als Selbstvergleich geprueft — Hash gegen Hash im selben Lauf,
   dort gilt bitgleich woertlich und auf jeder Plattform. Dass die Rechnung
   dieselbe geblieben ist wie damals, wird an diesen Kennzahlen gemessen, mit
   1e-12 relativer Toleranz.

   NEU GEEICHT am 28.07.2026 (Runde J): die Beruhigung beginnt seither bei
   RUHE_AB = 60 (UEBERGABE.koerper, die Uebergabe Koerper -> Karte) statt bei
   600. Die Pruefpunkte sind deshalb von 600/599.999 auf 60/59.999 gewandert.
   Kennzahlen aufgenommen am 29.07.2026, Seed 4711 / wiese, unveraenderte
   Messpunkte. */
/* NEU AUFGENOMMEN am 06.08.2026 (Runde Gelaendeoberflaeche), Seed 4711 /
   wiese, unveraenderte Messpunkte. Alt: summe 1922.9031718169108,
   quadrate 731.81426713438873 — relative Verschiebung 2.70e-3 bzw. 3.53e-3.

   Die Verschiebung ist GEWOLLT und betrifft ausschliesslich den
   Ortsmassstab. Vier Zusaetze in terrainColor bewegen sie, alle mit
   demselben Ziel: der Nahbereich trug bis hierher die geringste
   Detaildichte des ganzen Bildes.

     * die GRASNARBE (zwei Oktaven bei 0.115 und 0.245, also 8,7 und 4,1
       Welteinheiten) samt der gleichlaufenden Helligkeitswelle. Zwischen
       der bisher feinsten Farboktave (0.055 = 18 Einheiten) und dem
       Texturkorn klaffte eine ganze Groessenordnung; genau in ihr liegt
       alles, was eine Wiese als Wiese lesbar macht.
     * die SANDZEICHNUNG: die Sandzone war ein einziger Farbwert ueber
       Dutzende Einheiten, weil die Narbe vor ihrem lerp steht und
       ueberschrieben wurde.
     * eine dritte STOEROKTAVE (0.30) an den Zonengrenzen — sie verzahnt die
       Grenze, statt sie nur zu wellen.
     * die SCHNEEVERTEILUNG nach Neigung und Kruemmung: statt einer
       geschlossenen Decke oberhalb der Schneegrenze eine ungleiche Auflage.
       Nachgemessen liegt die Umschlagstelle jetzt zwischen 25 und 35 Grad
       Hangneigung (vorher brach der Fels erst ab 50 Grad durch).

   Dass die Quadratsumme staerker steigt (+0,35 %) als die Summe (+0,27 %),
   ist die Signatur eines Detailzuwachses: mehr Streuung bei fast gleicher
   Lage. Die Messpunkte liegen alle fuenf Zellen, tasten die feinste neue
   Oktave (4,1 Einheiten) also unter ihrer Wellenlaenge ab — der wahre
   Zuwachs im Bild ist groesser als diese Kennzahl zeigt.

   Die zweite Kennzahl darunter (Kartenmassstab) ist dabei BITGLEICH
   geblieben — nachgemessen, relative Abweichung exakt 0. Das ist der
   Beleg, dass alle vier Zusaetze sauber an dKorn haengen und die Zusage
   „auf Kartenmassstab aendert sich nichts" nicht nur behauptet ist. */
/* ZWEITE NEUAUFNAHME am 06.08.2026, derselbe Tag, spaeterer Stand derselben
   Runde. Alt: summe 1928.0975293504148, quadrate 734.3970044113106.
   Neu: -0,996 % auf der Summe, -2,47 % auf den Quadraten.

   Die Quadratsumme FAELLT diesmal, und zwar staerker als die Summe — nach der
   Lesart des Absatzes darueber also weniger Streuung, weniger Detail. Genau
   das ist gewollt, und der Grund ist ein Ortswechsel, nicht ein Verlust:

     Der Wegrand hat den Vertexschritt VERLASSEN. Bis eben stand in
     terrainColor eine schmale Schwelle (sstep(0.24, 0.44)) auf einem mit zwei
     Oktaven verrauschten Trittwert. Sie hat die Streuung dieser Kennzahl
     getragen — und im Bild eine Zickzacklinie erzeugt, weil ihre feinste
     Oktave (2,9 Welteinheiten) auf einem Gitter mit einem Vertex je Einheit
     zwischen zwei Stuetzstellen nur eine GERADE ergeben kann. Das ist der
     zweitschwerste Befund der letzten Abnahme. An ihrer Stelle steht jetzt ein
     weiches Band ueber die Wegbreite; die Kante faellt im Nahfeld-Block des
     Shaders (world/terrain.js), gebrochen an den Hoehenkanaelen der beiden
     Bodentexturen mit 197 Texeln je Welteinheit.

     Diese Kennzahl kann davon NICHTS sehen: sie misst terrainColor, also die
     Vertexfarbe, und der ganze Zuwachs liegt eine Ebene tiefer. Der Rueckgang
     ist deshalb kein Detailverlust, sondern die Messgroesse einer
     Verlagerung — die Vertexfarbe traegt heute bewusst WENIGER Kontrast,
     damit das Gitter keine Kanten mehr zeichnet, die ihm zu grob sind.

   Der Rest der Verschiebung verteilt sich auf zwei kleinere Zusaetze, beide
   ebenfalls im Nahbereich und beide an dKorn:
     * die MULDEN — eine Oktave bei 0.085 (rund 12 Welteinheiten), die der
       leeren Flaeche fern jedes Weges Struktur gibt (Befund "Die grosse leere
       Flaeche im Vordergrund braucht Struktur").
     * das STRANDBAND — Feuchtzone unter, Grobkorn ueber der Sandzone, gegen
       dieselbe Stoergroesse verschoben wie die Sand- und Felsgrenze.

   Die Kartenmassstab-Kennzahl darunter ist erneut BITGLEICH geblieben,
   nachgemessen mit relativer Abweichung exakt 0.000e+0 auf BEIDEN Summen. */
const BESTAND_VOR_RELIEF = {
  summe: 1908.9018222153802, quadrate: 716.2766723035288, n: 7803,
};
/* Der zweite Teil der Neueichung: bei genau 600 war die Farbe frueher an den
   Bestand genagelt; dieselbe Stelle ist jetzt voll beruhigt. Von 96
   (RUHE_VOLL) bis 600 (RELIEF_AB) ist die Rechnung konstant — die Beruhigung
   ist ausgereizt, die Schummerung hat noch nicht begonnen. */
const BESTAND_KARTE_RUHIG = {
  summe: 1899.8192212031693, quadrate: 703.84743277677853, n: 7803,
};

/* Zwei Kennzahlen ueber dieselben Farbwerte: Summe und Summe der Quadrate.
   Sie dienen dem Vergleich mit dem BESTAND — dafuer taugt ein Hash nicht mehr,
   siehe BESTAND_VOR_RELIEF. Eine Aenderung der Farbrechnung verschiebt beide
   Summen weit ausserhalb der Toleranz; eine Verschiebung der letzten Bitstelle
   nicht. */
async function farbSummen(m) {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const THREE = await import('three');
  const { VW, HALF } = w.m.store;
  S.einheitMeter = m;
  const c = new THREE.Color();
  let summe = 0, quadrate = 0, n = 0;
  for (let j = 2; j < VW - 2; j += 5) {
    for (let i = 2; i < VW - 2; i += 5) {
      const id = j * VW + i;
      const hh = w.m.terrain.hgt[id];
      const nx = (w.m.terrain.hgt[id - 1] - w.m.terrain.hgt[id + 1]) * 0.5;
      const nz = (w.m.terrain.hgt[id - VW] - w.m.terrain.hgt[id + VW]) * 0.5;
      const ny = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
      w.m.terrain.terrainColor(hh, ny, i - HALF, j - HALF, c, 1);
      for (const v of [c.r, c.g, c.b]) { summe += v; quadrate += v * v; n++; }
    }
  }
  return { summe, quadrate, n };
}

/* Relativer Vergleich mit Toleranz. 1e-12 liegt vier Groessenordnungen ueber
   dem Plattformrauschen (~1e-16 relativ) und weit unter jeder Aenderung, die
   eine echte Anpassung der Farbrechnung ausloesen wuerde. */
function gleichAuf12(ist, soll, was) {
  const abw = Math.abs(ist - soll) / Math.abs(soll);
  assert.ok(abw < 1e-12, was + ': ' + ist + ' weicht um ' + abw.toExponential(2) + ' ab');
}

async function farbHash(m) {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const THREE = await import('three');
  const { VW, HALF } = w.m.store;
  S.einheitMeter = m;
  const c = new THREE.Color(), h = new Hasher();
  for (let j = 2; j < VW - 2; j += 5) {
    for (let i = 2; i < VW - 2; i += 5) {
      const id = j * VW + i;
      const hh = w.m.terrain.hgt[id];
      const nx = (w.m.terrain.hgt[id - 1] - w.m.terrain.hgt[id + 1]) * 0.5;
      const nz = (w.m.terrain.hgt[id - VW] - w.m.terrain.hgt[id + VW]) * 0.5;
      const ny = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
      w.m.terrain.terrainColor(hh, ny, i - HALF, j - HALF, c, 1);
      h.zahl(c.r).zahl(c.g).zahl(c.b);
    }
  }
  return h.hex();
}

test('I1 — unterhalb der Schwelle ist die Terrainfarbe unveraendert', async () => {
  /* Teil 1 — KONSTANZ unterhalb der Schwelle. Das ist ein Vergleich der
     Werte gegeneinander, innerhalb desselben Laufs: hier gilt bitgleich
     woertlich, auf jeder Plattform. */
  const basis = await farbHash(1);
  // J: die Pruefpunkte lagen bei 600/599.999, solange dort die Beruhigung
  // begann. Seit RUHE_AB = UEBERGABE.koerper liegen sie bei 60/59.999.
  assert.equal(await farbHash(60), basis,
    'Genau AUF der Schwelle darf noch nichts passieren');
  assert.equal(await farbHash(59.999), basis,
    'Knapp unter der Schwelle ebenso wenig');

  /* Teil 2 — WIRKSAMKEIT oberhalb, ebenfalls als Selbstvergleich: der voll
     beruhigte Zustand ist von RUHE_VOLL bis zum Beginn der Schummerung
     konstant, und er unterscheidet sich vom Zustand darunter. */
  const ruhig = await farbHash(96);
  assert.notEqual(ruhig, basis, 'Bei RUHE_VOLL muss die Beruhigung wirken');
  assert.equal(await farbHash(600), ruhig,
    'Zwischen 96 und 600 darf sich nichts mehr aendern (Schummerung erst ab 600)');

  /* Teil 3 — BESTAND. Gegen die aufgenommenen Kennzahlen, mit Toleranz statt
     Hash: siehe BESTAND_VOR_RELIEF. */
  const v = await farbSummen(1);
  assert.equal(v.n, BESTAND_VOR_RELIEF.n, 'Andere Anzahl Messpunkte');
  gleichAuf12(v.summe, BESTAND_VOR_RELIEF.summe, 'Farbsumme auf Ortsmassstab');
  gleichAuf12(v.quadrate, BESTAND_VOR_RELIEF.quadrate, 'Quadratsumme auf Ortsmassstab');

  const r = await farbSummen(96);
  gleichAuf12(r.summe, BESTAND_KARTE_RUHIG.summe, 'Farbsumme im ruhigen Zustand');
  gleichAuf12(r.quadrate, BESTAND_KARTE_RUHIG.quadrate, 'Quadratsumme im ruhigen Zustand');
});

test('I1 — der Reliefzweig blendet ein statt zu schalten', () => {
  assert.equal(T.reliefFaktor(1), 0);
  assert.equal(T.reliefFaktor(T.RELIEF_AB), 0, 'Auf der Schwelle noch 0');
  assert.ok(T.reliefFaktor(700) > 0 && T.reliefFaktor(700) < 1, 'Rampe fehlt');
  assert.equal(T.reliefFaktor(T.RELIEF_VOLL), 1);
  assert.equal(T.reliefFaktor(4000), 1);
  assert.equal(T.reliefFaktor(undefined), 0, 'Ohne Massstab keine Schummerung');
});

test('I1 — oberhalb der Schwelle schummert sie messbar und aus Nordwest', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const THREE = await import('three');
  const { VW, HALF } = w.m.store;
  const hgt = w.m.terrain.hgt;
  const sicherung = hgt.slice();
  // Ein sauberer Kegel in der Kartenmitte: seine Nordwestflanke muss heller,
  // seine Suedostflanke dunkler werden. Auf gewachsenem Gelaende waere das
  // Ergebnis von der Rauschlage abhaengig und damit kein Mass.
  for (let j = 0; j < VW; j++) {
    for (let i = 0; i < VW; i++) {
      const dx = i - HALF, dz = j - HALF;
      const r = Math.sqrt(dx * dx + dz * dz);
      hgt[j * VW + i] = Math.max(3, 40 - r * 0.5);
    }
  }
  const farbe = (x, z, m) => {
    S.einheitMeter = m;
    const c = new THREE.Color();
    w.m.terrain.terrainColor(20, 0.9, x, z, c, 1);
    return c;
  };
  /* Gleiche Stelle, nur anderer Massstab: der Unterschied ist die
     Schummerung — und seit I6 zusaetzlich die Beruhigung (RUHE_AB in
     world/terrain.js). Seit Runde J laufen die Baender getrennt (Beruhigung
     ab 60, Schummerung ab 600); bei den Messpunkten 1 und 2000 sind beide
     unterhalb bzw. oberhalb, die Messung traegt also unveraendert. */
  const messe = (x, z) => {
    const unten = farbe(x, z, 1), oben = farbe(x, z, 2000);
    return (oben.r + oben.g + oben.b) / (unten.r + unten.g + unten.b);
  };
  const nw = messe(-30, -30), so = messe(30, 30), eben = messe(0, 0);
  try {
    assert.ok(nw > 1.02, 'Die Nordwestflanke wird nicht heller (' + nw + ')');
    assert.ok(so < 0.98, 'Die Suedostflanke wird nicht dunkler (' + so + ')');
    /* I6 — die Schranke war 0.02 und ist 0.08, weil hier seit der Beruhigung
       zwei Dinge zugleich gemessen werden. Die Beruhigung ersetzt jeden
       Feinanteil durch seinen MITTELWERT; ueber die Karte gemittelt bleibt
       die Helligkeit damit erhalten (1,2 % Abweichung, gemessen in
       17-kartenbild.test.mjs), an einem EINZELNEN Punkt weicht sie um so
       viel ab, wie dessen Korn vom Mittel entfernt liegt. (0,0) ist dafuer
       der unguenstigste Punkt der ganzen Karte: dort faellt jedes Rauschgitter
       auf seinen Ursprung, und die beiden Wertoktaven stehen bei 0,73 und
       0,87 statt bei 0,5 — die Kuppe wird dadurch um 5,6 % dunkler.
       Die AUSSAGE der Pruefung bleibt dieselbe und wird durch die zweite
       Zeile sogar schaerfer: auf ebener Flaeche schummert es nicht, der Wert
       liegt zwischen den beiden Flanken und weit von beiden entfernt. */
    assert.ok(Math.abs(eben - 1) < 0.08,
      'Die Kuppe schummert, statt eben zu bleiben (' + eben + ')');
    assert.ok(eben < nw - 0.05 && eben > so + 0.05,
      'Die Kuppe muss deutlich zwischen ihren beiden Flanken liegen ('
      + so + ' < ' + eben + ' < ' + nw + ')');
    assert.ok(nw - so > 0.1,
      'Der Reliefkontrast ist zu schwach, um eine Karte lesbar zu machen');
  } finally {
    hgt.set(sicherung);
    S.einheitMeter = 1;
  }
});


/* ==========================================================================
   6 — Grate
   ========================================================================== */

test('I1 — auf einem Dachprofil finden die Grate den Kamm, nicht die Flanke', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const { VW, HALF } = w.m.store;
  const hgt = w.m.terrain.hgt;
  const sicherung = hgt.slice();
  /* Ein Dach mit First bei x = 11 (bewusst NICHT auf einer Rasterstelle der
     Suche) und 1,2 Einheiten Gefaelle je Einheit. Die Kammlinie laeuft
     entlang z; alles, was gefunden wird, muss also nahe x = 11 liegen und
     seine Richtung muss (0, ±1) sein. */
  const FIRST = 11, NEIGUNG = 1.2;
  for (let j = 0; j < VW; j++) {
    for (let i = 0; i < VW; i++) {
      hgt[j * VW + i] = Math.max(3, 40 - Math.abs((i - HALF) - FIRST) * NEIGUNG);
    }
  }
  const sp = 4;
  try {
    const punkte = ZEI.gratPunkte({ x0: -30, z0: -30, x1: 50, z1: 30, sp: sp, d: sp });
    assert.ok(punkte.length > 5, 'Auf einem Dach wird kein Kamm gefunden (' + punkte.length + ')');
    let maxAbstand = 0, summe = 0, schief = 0, gipfel = 0;
    for (const p of punkte) {
      const ab = Math.abs(p.x - FIRST);
      maxAbstand = Math.max(maxAbstand, ab);
      summe += ab;
      // Kammrichtung muss entlang z laufen
      if (Math.abs(p.dx) > 1e-9 || Math.abs(Math.abs(p.dz) - 1) > 1e-9) schief++;
      if (p.gipfel) gipfel++;
    }
    const mittel = summe / punkte.length;
    assert.ok(maxAbstand <= sp,
      'Ein Kammpunkt liegt ' + maxAbstand + ' neben dem First — mehr als die '
      + 'Stuetzweite ' + sp + ', also auf der Flanke');
    assert.ok(mittel <= sp * 0.5,
      'Der mittlere Abstand zum First ist ' + mittel + ' (Stuetzweite ' + sp + ')');
    assert.equal(schief, 0, schief + ' Kammpunkte zeigen quer zum Kamm');
    assert.equal(gipfel, 0, 'Ein Dach hat keinen Gipfel, gefunden wurden ' + gipfel);

    // Gegenprobe: auf der Flanke selbst darf gar nichts gefunden werden.
    const flanke = ZEI.gratPunkte({ x0: 24, z0: -30, x1: 48, z1: 30, sp: sp, d: sp });
    assert.equal(flanke.length, 0,
      'Auf der glatten Flanke wurden ' + flanke.length + ' Kammpunkte gefunden');
  } finally {
    hgt.set(sicherung);
  }
});

test('I1 — ein Kegel liefert einen Gipfel, kein Feld aus Bergchen', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const { VW, HALF } = w.m.store;
  const hgt = w.m.terrain.hgt;
  const sicherung = hgt.slice();
  for (let j = 0; j < VW; j++) {
    for (let i = 0; i < VW; i++) {
      // Spitze bewusst NICHT auf einer Rasterstelle der Suche (die liegt bei
      // Vielfachen von 4 ab -40) — ein Kegel, dessen Spitze zufaellig
      // getroffen wird, prueft die Gipfelregel nicht.
      const dx = (i - HALF) - 5, dz = (j - HALF) + 3;
      hgt[j * VW + i] = Math.max(3, 50 - Math.sqrt(dx * dx + dz * dz) * 1.1);
    }
  }
  try {
    const punkte = ZEI.gratPunkte({ x0: -40, z0: -40, x1: 40, z1: 40, sp: 4, d: 4 });
    const gipfel = punkte.filter((p) => p.gipfel);
    assert.ok(gipfel.length >= 1, 'Der Kegel hat keinen Gipfel');
    assert.ok(punkte.length <= 4,
      'Ein Kegel ergibt ' + punkte.length + ' Reliefzeichen — das ist ein Feld aus '
      + 'Bergchen und genau das, was der Katalog verbietet');
    for (const g of gipfel) {
      assert.ok(Math.abs(g.x - 5) <= 4 && Math.abs(g.z + 3) <= 4,
        'Der Gipfel liegt bei ' + g.x + '/' + g.z + ' statt bei 5/-3');
    }
  } finally {
    hgt.set(sicherung);
  }
});

test('I1 — die Gratsuche ist eine reine Funktion des Hoehenfelds', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const kasten = { x0: 40, z0: 50, x1: 100, z1: 110, sp: 3, d: 3 };
  const a = ZEI.gratPunkte(kasten), b = ZEI.gratPunkte(kasten);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.ok(w.m.terrain.hgt.length > 0);
});
