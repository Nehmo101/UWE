/* ==========================================================================
   Ebene 17 — Das Kartenbild (Runde I6)

   Ab 600 m je Zelle — dort beginnt in MASSSTAB_LEITER die Stufe „kontinent" —
   hoert Terra auf, Gelaende zu zeigen, und faengt an, eine Karte zu zeigen.
   Drei Dinge machen das aus, und alle drei stehen hier auf dem Pruefstand:

   1  DAS BAND. Beruhigung und Schummerung teilen sich Schwelle und Rampe.
      Unterhalb der Schwelle sind beide exakt 0 — nicht „fast".
   2  DIE BERUHIGUNG. Sie ersetzt jeden Feinanteil durch seinen MITTELWERT.
      Gemessen wird deshalb beides: dass die Koernung verschwindet (der
      Kontrast zwischen Nachbarzellen faellt deutlich) und dass die Flaeche
      dabei ihre Helligkeit behaelt (der Mittelwert bleibt stehen). Eine
      Beruhigung, die nur abzieht, macht die Karte dunkel statt ruhig.
   3  DIE SCHUMMERUNG. Ihre Schattenseite ist gedeckelt. Gemessen wird das
      dort, wo es zaehlt: an einer Flanke, die so steil ist, dass der Deckel
      greifen MUSS.
   4  DIE BIOM-LUT. Eine Karte ohne Biomflaechen sieht aus wie immer
      (uBiomAn = 0, der Shaderzweig faellt weg); mit Flaeche stehen Index und
      Gewicht texelgenau in der Karte, und die LUT-Zeile traegt die Werte des
      Bioms.
   5  DIE FLAECHENZEICHEN. Ein Zeichen muss sich von der Flaeche abheben, auf
      der es liegt — sonst nuetzt die ruhigste Flaeche nichts.

   TESTISOLATION: jede Welt wird IM Test angelegt, nie beim Import. Ueber
   terra/test/index.mjs werden erst alle Dateien geladen und dann alle Tests
   ausgefuehrt; eine beim Import gebaute Welt zeigte laengst auf ein
   Hoehenfeld, das sechzehn andere Dateien ueberschrieben haben.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeTerra } from './hilfen/laden.mjs';
import { testWelt } from './hilfen/karte.mjs';
import { Hasher } from './hilfen/hash.mjs';

const SIG = await ladeTerra('render/signaturen.js');
const MAT = await ladeTerra('render/materials.js');
const BIO = await ladeTerra('world/biomfeld.js');
const STORE = await ladeTerra('core/store.js');


/* ==========================================================================
   1 — Das Band
   ========================================================================== */

test('I6 — die Beruhigung blendet ein, sie schaltet nicht', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const T = w.m.terrain;
  assert.equal(T.ruheFaktor(1), 0);
  assert.equal(T.ruheFaktor(60), 0, 'Auf Regionsmassstab ist noch nichts zu beruhigen');
  assert.equal(T.ruheFaktor(T.RUHE_AB), 0, 'Genau AUF der Schwelle noch 0');
  assert.equal(T.ruheFaktor(T.RUHE_AB - 1e-6), 0);
  assert.ok(T.ruheFaktor(700) > 0 && T.ruheFaktor(700) < 1, 'Rampe fehlt');
  assert.equal(T.ruheFaktor(T.RUHE_VOLL), 1);
  assert.equal(T.ruheFaktor(4000), 1);
  assert.equal(T.ruheFaktor(undefined), 0, 'Ohne Massstab keine Beruhigung');
  // Eine Geste, ein Band: sonst gaebe es einen Massstabsbereich, in dem die
  // Flaeche schon glatt, aber noch unschattiert ist.
  assert.equal(T.RUHE_AB, T.RELIEF_AB);
  assert.equal(T.RUHE_VOLL, T.RELIEF_VOLL);
  for (const m of [1, 60, 599, 600, 700, 900, 960, 2000, 4000]) {
    assert.equal(T.ruheFaktor(m), T.reliefFaktor(m), 'Baender laufen bei ' + m + ' auseinander');
  }
});

test('I6 — unterhalb der Schwelle ist die Farbe bitgleich, unabhaengig geprueft', async () => {
  /* 14-signaturen-generatoren haelt denselben Rechenweg gegen einen Hash aus
     der Zeit VOR dem Reliefzweig. Diese Pruefung hier braucht keine Zahl aus
     der Vergangenheit: sie vergleicht drei Massstaebe MITEINANDER. Faellt
     jemand kuenftig auf die Idee, die Beruhigung frueher beginnen zu lassen,
     schlaegt sie an, ohne dass ein Hash neu aufgenommen werden muesste. */
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const THREE = await import('three');
  const { S, VW, HALF } = w.m.store;
  const T = w.m.terrain;
  const hash = (m) => {
    S.einheitMeter = m;
    const c = new THREE.Color(), h = new Hasher();
    for (let j = 3; j < VW - 3; j += 7) {
      for (let i = 3; i < VW - 3; i += 7) {
        const id = j * VW + i;
        const nx = (T.hgt[id - 1] - T.hgt[id + 1]) * 0.5;
        const nz = (T.hgt[id - VW] - T.hgt[id + VW]) * 0.5;
        const ny = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
        T.terrainColor(T.hgt[id], ny, i - HALF, j - HALF, c, 0.93);
        h.zahl(c.r).zahl(c.g).zahl(c.b);
      }
    }
    return h.hex();
  };
  try {
    const a = hash(1);
    assert.equal(hash(4), a, 'Ortsmassstab');
    assert.equal(hash(60), a, 'Uebergabe an die Karte');
    assert.equal(hash(250), a, 'Regionsmassstab');
    assert.equal(hash(T.RUHE_AB), a, 'genau auf der Schwelle');
    assert.notEqual(hash(2000), a, 'Auf Kontinentmassstab MUSS sich etwas aendern');
  } finally { S.einheitMeter = 1; }
});


/* ==========================================================================
   2 — Die Beruhigung: glatter werden, ohne dunkler zu werden
   ========================================================================== */

/**
 * Helligkeit und Nachbarkontrast der Terrainfarbe ueber die ganze Karte.
 *
 * Gemessen wird auf einem EBENEN Hoehenfeld, und das ist der Kern dieser
 * Pruefung: auf der Ebene ist die Schummerung nachweislich wirkungslos
 * (Gefaelle 0 in beide Richtungen), der Unterschied zwischen den Massstaeben
 * ist also die Beruhigung und nur sie. Auf gewachsenem Gelaende mischte sich
 * die Schummerung darunter — sie bringt zwischen zwei Nachbarzellen eigenen
 * Kontrast ein, und der ist Struktur, kein Rauschen.
 */
async function flaechenmass(w, m) {
  const THREE = await import('three');
  const { S, VW, HALF } = w.m.store;
  const T = w.m.terrain;
  S.einheitMeter = m;
  const c = new THREE.Color(), d = new THREE.Color();
  const hell = (i, j, out) => {
    T.terrainColor(9, 0.995, i - HALF, j - HALF, out, 1);
    return (out.r + out.g + out.b) / 3;
  };
  let summe = 0, kontrast = 0, n = 0;
  for (let j = 4; j < VW - 5; j += 2) {
    for (let i = 4; i < VW - 5; i += 2) {
      const a = hell(i, j, c), b = hell(i + 1, j, d);
      summe += a; kontrast += Math.abs(a - b); n++;
    }
  }
  return { mittel: summe / n, kontrast: kontrast / n };
}

test('I6 — auf Kontinentmassstab faellt die Koernung, nicht die Helligkeit', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const { S, VW } = w.m.store;
  const hgt = w.m.terrain.hgt;
  const sicherung = hgt.slice();
  hgt.fill(9, 0, VW * VW);            // eben: die Schummerung ist damit stumm
  try {
    const ort = await flaechenmass(w, 1);
    const karte = await flaechenmass(w, 2000);
    /* Der Kontrast zwischen zwei benachbarten Gitterzellen IST das Flimmern:
       auf 2000 m je Zelle liegt zwischen ihnen ein Bildpunkt. Er muss
       deutlich fallen — nicht nur ein bisschen, sonst hat sich das ganze
       Unternehmen nicht gelohnt. */
    assert.ok(karte.kontrast < ort.kontrast * 0.30,
      'Die Flaeche ist nicht ruhiger geworden: ' + ort.kontrast.toFixed(5)
      + ' -> ' + karte.kontrast.toFixed(5));
    /* Und sie darf dabei nicht absacken. DAS ist der Unterschied zwischen
       „beruhigen" und „weglassen": jeder Feinanteil wird durch seinen
       Mittelwert ersetzt, nicht durch Null. Ohne diesen Ausgleich waere die
       Ebene hier 8,7 % dunkler — gemessen, bevor RUHE_M_* eingebaut war. */
    const faktor = karte.mittel / ort.mittel;
    assert.ok(Math.abs(faktor - 1) < 0.02,
      'Die ebene Flaeche aendert ihre Helligkeit um '
      + ((faktor - 1) * 100).toFixed(1) + ' %');
  } finally {
    hgt.set(sicherung);
    S.einheitMeter = 1;
  }
});

test('I6 — die grossen Zuege bleiben: Wasser, Hoehenzonen, Biomfarbe', async () => {
  /* Beruhigen heisst nicht einebnen. Drei Punkte mit deutlich verschiedener
     Hoehe muessen auch auf Kartenmassstab deutlich verschiedene Farben
     haben — sonst waere aus der Karte eine einfarbige Flaeche geworden. */
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const THREE = await import('three');
  const { S } = w.m.store;
  const T = w.m.terrain;
  const farbe = (h, m) => {
    S.einheitMeter = m;
    const c = new THREE.Color();
    T.terrainColor(h, 0.98, 12, -34, c, 1);
    return c;
  };
  const abstand = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
  try {
    const tief = farbe(-6, 2000), wiese = farbe(6, 2000), hoch = farbe(40, 2000);
    assert.ok(abstand(tief, wiese) > 0.15, 'Meeresgrund und Wiese sind nicht zu trennen');
    assert.ok(abstand(wiese, hoch) > 0.10, 'Wiese und Hochland sind nicht zu trennen');
    // Und der Unterschied darf nicht kleiner geworden sein als auf Ortsmassstab.
    const o = abstand(farbe(6, 1), farbe(40, 1));
    assert.ok(abstand(wiese, hoch) > o * 0.6,
      'Die Hoehenzonen sind auf der Karte schwaecher als im Gelaende');
  } finally { S.einheitMeter = 1; }
});


/* ==========================================================================
   3 — Die Schummerung
   ========================================================================== */

test('I6 — die Schattenseite ist gedeckelt, nicht bodenlos', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const THREE = await import('three');
  const { S, VW, HALF } = w.m.store;
  const T = w.m.terrain, hgt = T.hgt;
  const sicherung = hgt.slice();
  /* Eine Ebene, die nach Suedost abfaellt — also vom Licht weg. Ab einem
     Gefaelle von 0,35 zeigt die Flaeche ganz aus dem Licht heraus; jedes
     steilere Gefaelle darf sie NICHT weiter verdunkeln. Ohne Deckel wuerde
     der Faktor linear weiterlaufen und ein Gebirge schwarz. */
  const neige = (k) => {
    for (let j = 0; j < VW; j++) {
      for (let i = 0; i < VW; i++) hgt[j * VW + i] = 20 - ((i - HALF) + (j - HALF)) * k;
    }
  };
  const messe = () => {
    S.einheitMeter = 2000;
    const c = new THREE.Color();
    T.terrainColor(20, 0.95, 0, 0, c, 1);
    return c;
  };
  try {
    neige(0.5); const sanft = messe();
    neige(2.0); const steil = messe();
    neige(6.0); const sehrSteil = messe();
    assert.deepEqual([steil.r, steil.g, steil.b], [sanft.r, sanft.g, sanft.b],
      'Zwei verschieden steile Schattenflanken duerfen sich nicht unterscheiden — '
      + 'beide liegen jenseits des Deckels');
    assert.deepEqual([sehrSteil.r, sehrSteil.g, sehrSteil.b], [sanft.r, sanft.g, sanft.b]);
    // Und der Deckel sitzt an der versprochenen Stelle: die Flanke ist genau
    // RELIEF_TIEFE dunkler als dieselbe Stelle ohne Schummerung.
    neige(0);
    S.einheitMeter = 2000;
    const eben = new THREE.Color();
    T.terrainColor(20, 0.95, 0, 0, eben, 1);
    const q = (sanft.r + sanft.g + sanft.b) / (eben.r + eben.g + eben.b);
    assert.ok(Math.abs(q - (1 - T.RELIEF_TIEFE)) < 1e-6,
      'Die Schattenflanke liegt bei ' + q + ' statt bei ' + (1 - T.RELIEF_TIEFE));
  } finally {
    hgt.set(sicherung);
    S.einheitMeter = 1;
  }
});


/* ==========================================================================
   4 — Die Biom-LUT
   ========================================================================== */

test('I6 — die LUT hat das Format, das biomfeld.js beschreibt', () => {
  const F = BIO.biomLutFormat({ spalten: 8 });
  const t = MAT.holeBiomLut();
  assert.equal(t.image.width, F.breite);
  assert.equal(t.image.height, F.hoehe);
  assert.equal(t.image.height, BIO.BIOM_ANZAHL);
  assert.equal(MAT.terraUniforms.uBiomZeilen.value, BIO.BIOM_ANZAHL);
  // Jede Zeile traegt die Werte IHRES Bioms, in der Reihenfolge der Registry.
  /* Float32Array rundet: 0.2 liegt darin als 0.20000000298. Verglichen wird
     deshalb gegen Math.fround, nicht gegen die Registryzahl selbst — sonst
     prueft der Test die Fliesskommabreite statt der Zuordnung. */
  const daten = t.image.data;
  for (const name of ['wiese', 'schnee']) {
    const r = BIO.biomIndex(name);
    const sn = STORE.BIOME[name].schnee || null;
    assert.equal(daten[r * 8],
      Math.fround(sn && typeof sn.auflage === 'number' ? sn.auflage : 0),
      'Schneeauflage der Zeile ' + name);
    assert.equal(daten[r * 8 + 4], Math.fround(sn && sn.kante ? sn.kante[0] : 0.20));
  }
  // Nur EINE Textur, auch bei mehrfachem Abruf — sie haengt in den Uniforms.
  assert.equal(MAT.holeBiomLut(), t);
});

test('I6 — ohne Biomflaeche bleibt der Shaderzweig aus', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const { VW, MAP } = w.m.store;
  const n = VW * VW;
  const feld = new Uint8Array(n).fill(BIO.BIOM_KEINS);
  const gewicht = new Uint8Array(n);
  assert.equal(MAT.setzeBiomKarte(feld, gewicht, VW, MAP), 0);
  assert.equal(MAT.terraUniforms.uBiomAn.value, 0,
    'Eine Karte ohne Biomflaechen muss aussehen wie bisher');
  // Auch Unsinn darf nur abschalten, nicht werfen.
  assert.equal(MAT.setzeBiomKarte(null, null, VW, MAP), 0);
  assert.equal(MAT.setzeBiomKarte(feld, gewicht, 0, 0), 0);
  assert.equal(MAT.terraUniforms.uBiomAn.value, 0);
});

test('I6 — mit Biomflaeche stehen Index und Gewicht texelgenau in der Karte', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const { VW, MAP, HALF } = w.m.store;
  const n = VW * VW;
  const feld = new Uint8Array(n).fill(BIO.BIOM_KEINS);
  const gewicht = new Uint8Array(n);
  const wueste = BIO.biomIndex('wueste');
  const k = 40 * VW + 55;
  feld[k] = wueste; gewicht[k] = 200;
  assert.equal(MAT.setzeBiomKarte(feld, gewicht, VW, MAP), 1);
  assert.equal(MAT.terraUniforms.uBiomAn.value, 1);
  const bild = MAT.terraUniforms.uBiomKarte.value.image;
  assert.equal(bild.width, VW);
  assert.equal(bild.height, VW);
  assert.equal(bild.data[k * 2], wueste, 'Biomindex im Rotkanal');
  assert.equal(bild.data[k * 2 + 1], 200, 'Gewicht im Gruenkanal');
  /* Die Weltabbildung ist die der Bruchmaske: Texelmitte auf Gittervertex.
     Der Vertex (i,j) liegt bei (i-HALF, j-HALF), sein Texel bei
     ((i+0.5)/VW, (j+0.5)/VW) — die Probe rechnet genau das nach. */
  const abb = MAT.terraUniforms.uBiomAbb.value;
  const u = (55 - HALF) * abb.x + abb.y;
  assert.ok(Math.abs(u - (55 + 0.5) / VW) < 1e-9, 'Weltabbildung verschoben');
  // Zuruecksetzen, damit kein anderer Test eine Biomkarte erbt.
  MAT.setzeBiomKarte(new Uint8Array(n).fill(BIO.BIOM_KEINS), new Uint8Array(n), VW, MAP);
});

test('I6 — der Schneepatch schlaegt in der LUT nach, das Terrain nicht', () => {
  /* Der Terrain-Shader ist der einzige mit `ohneSchnee`: seine Biomfarben
     kommen aus terrainColor (mischPalette). Bekaeme er den Zweig zusaetzlich,
     laege die Schneeauflage der Flaeche ein zweites Mal darueber. Geprueft
     wird die BINDUNG, denn der Quelltext ist fuer alle Materialien derselbe —
     genau deshalb waechst die Zahl der Shaderprogramme nicht. */
  const anker = {
    vertexShader: 'void main() {\n#include <begin_vertex>\n#include <project_vertex>\n'
      + '#include <defaultnormal_vertex>\n#include <uv_vertex>\n#include <fog_vertex>\n}',
    fragmentShader: 'void main() {\n#include <color_fragment>\n#include <lights_fragment_end>\n'
      + '#include <fog_fragment>\n#include <opaque_fragment>\n#include <dithering_fragment>\n}'
  };
  const bau = (opts) => {
    const s = { uniforms: {}, vertexShader: anker.vertexShader, fragmentShader: anker.fragmentShader };
    const alt = console.warn;
    console.warn = () => {};                 // fehlende Chunks im Stub, nicht unsere Sache
    try { MAT.terraPatch(s, opts); } finally { console.warn = alt; }
    return s;
  };
  const welt = bau({ cloudShadow: false });
  assert.equal(welt.uniforms.uBiomAn, MAT.terraUniforms.uBiomAn,
    'Ein Weltmaterial muss an der gemeinsamen Bindung haengen');
  assert.ok(welt.fragmentShader.indexOf('uBiomLut') >= 0, 'Nachschlag fehlt im Shader');
  assert.ok(welt.fragmentShader.indexOf('terraSAufl') >= 0,
    'Die Schneemenge kommt nicht aus der oertlichen Kopie');
  const terrain = bau({ ohneSchnee: true });
  assert.notEqual(terrain.uniforms.uBiomAn, MAT.terraUniforms.uBiomAn);
  assert.equal(terrain.uniforms.uBiomAn.value, 0, 'Das Terrain darf nicht doppelt beschneit werden');
  /* Und der Quelltext ist bei beiden derselbe: `ohneSchnee` darf sich NUR in
     der Bindung unterscheiden, sonst waechst mit jeder Materialfamilie die
     Zahl der Shaderprogramme (customProgramCacheKey fuehrt das Flag bewusst
     nicht). Genau dieselbe Zusage gibt der Schneeblock seit H2a. */
  assert.equal(terrain.fragmentShader, welt.fragmentShader,
    'Der Quelltext muss identisch bleiben, sonst waechst die Programmzahl');
});


/* ==========================================================================
   5 — Die Flaechenzeichen
   ========================================================================== */

test('I6 — Burg, Werft und Kloster bekommen ihren Grundriss', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const { S } = w.m.store;
  const anlagen = [
    ['burg', [{ x: 54, z: -76 }, { x: 84, z: -78 }, { x: 87, z: -50 }, { x: 57, z: -48 }]],
    ['werft', [{ x: 74, z: 0 }, { x: 104, z: 2 }, { x: 106, z: 30 }, { x: 76, z: 28 }]],
    ['kloster', [{ x: -86, z: 30 }, { x: -56, z: 28 }, { x: -53, z: 58 }, { x: -84, z: 60 }]]
  ];
  /** Meshes, die aus dem Grundriss-Atlasfeld gezeichnet werden. */
  const uv = SIG.atlasStreifenUV('sig_grundriss');
  const grundrisse = (el) => {
    let n = 0;
    for (const kind of (el.group ? el.group.children : [])) {
      const a = kind.geometry && kind.geometry.attributes && kind.geometry.attributes.uv;
      if (a && Math.abs(a.array[0] - uv[0]) < 1e-6) n++;
    }
    return n;
  };
  try {
    for (const [variant, punkte] of anlagen) {
      const el = w.element('flaeche', variant, punkte, null, 0x6100);
      S.einheitMeter = 1;
      w.erzeuge(el);
      assert.equal(grundrisse(el), 0, variant + ': auf Ortsmassstab steht der Bau selbst');
      S.einheitMeter = 250;
      w.erzeuge(el);
      assert.equal(grundrisse(el), 1, variant + ': auf Regionsmassstab fehlt der Grundriss');
      S.einheitMeter = 2000;
      w.erzeuge(el);
      assert.equal(grundrisse(el), 0,
        variant + ': auf Kontinentmassstab traegt das Punktzeichen die Anlage');
      w.m.store.dropElement(el);
    }
  } finally { S.einheitMeter = 1; }
});

test('I6 — der Grundriss ist geschlossen und folgt dem Polygon', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const ZEI = await ladeTerra('generators/zeichen.js');
  const { S } = w.m.store;
  const punkte = [{ x: 54, z: -76 }, { x: 84, z: -78 }, { x: 87, z: -50 }, { x: 57, z: -48 }];
  try {
    S.einheitMeter = 250;
    /* Der Bandbau bekommt die Linie, die umrissZeichen ihm baut. Geprueft
       wird die EIGENSCHAFT, auf die es ankommt: Anfang und Ende liegen
       aufeinander. Ein offener Zug hinterliesse an der Anfangsecke eine Fuge,
       und eine Burg mit einem Loch in der Mauer ist keine Burg. */
    const linie = punkte.concat([punkte[0]]);
    const b = ZEI.bandGeoZeichen('sig_grundriss', linie, {});
    assert.ok(b, 'kein Band gebaut');
    const p = b.geo.attributes.position.array;
    const n = p.length;
    /* Verglichen wird die MITTE des Bandes, nicht seine Ecken: an Anfang und
       Ende zeigt die Bandnormale in verschiedene Richtungen (die erste Kante
       laeuft anders als die letzte), die beiden Randvertices liegen also
       auseinander. Der Pfadpunkt dazwischen ist derselbe. */
    const mitte = (k) => [(p[k] + p[k + 3]) / 2, (p[k + 1] + p[k + 4]) / 2,
      (p[k + 2] + p[k + 5]) / 2];
    const a = mitte(0), e = mitte(n - 6);
    /* Nur x und z: die Hoehe der beiden Randvertices wird an ihrer eigenen
       Stelle aus dem Gelaende geholt, und die liegt am Anfang quer zur ersten
       Kante und am Ende quer zur letzten. Ihr Mittel unterscheidet sich
       deshalb um Zentimeter — im Grundriss liegen die Punkte exakt
       aufeinander, und darum geht es hier. */
    for (const k of [0, 2]) {
      assert.ok(Math.abs(a[k] - e[k]) < 1e-4,
        'Der Umriss schliesst sich nicht: ' + a.join('/') + ' gegen ' + e.join('/'));
    }
    // Und die Kacheln laufen wirklich am Polygon entlang, nicht quer darueber.
    assert.ok(b.kacheln >= 4, 'zu wenige Kacheln fuer vier Kanten: ' + b.kacheln);
  } finally { S.einheitMeter = 1; }
});

test('I6 — ein Flaechenzeichen hebt sich von seiner eigenen Flaeche ab', () => {
  /* Der Befund aus Runde I1 lautete „die Flaechenzeichen sind sehr blass".
     Messbar ist das: der Tint eines Zeichens gegen die Palettenfarbe, auf der
     es liegt. Unter einem Fuenftel Abstand verschwindet ein Zeichen im
     Untergrund, sobald die Mipstufe seine Striche wegmittelt. */
  const abstand = (t, c) => (Math.abs(t[0] - c.r) + Math.abs(t[1] - c.g) + Math.abs(t[2] - c.b)) / 3;
  const faelle = [
    ['sig_laubwald', 'wiese', 'grasKuehl'],
    ['sig_nadelwald', 'schnee', 'grasKuehl'],
    ['sig_acker', 'wiese', 'grasTrocken'],
    ['sig_wueste', 'wueste', 'sand'],
    ['sig_karst', 'karst', 'fels']
  ];
  for (const [zeichen, biom, feld] of faelle) {
    const t = SIG.signaturTint(zeichen, biom);
    const c = STORE.BIOME[biom].terrain[feld];
    // Absolut: was das Auge im Bild unterscheiden muss.
    assert.ok(abstand(t, c) > 0.09,
      zeichen + ' in ' + biom + ' liegt nur ' + abstand(t, c).toFixed(3)
      + ' von seinem Untergrund entfernt');
    // Relativ: das ist die Schranke, die TON_QUELLE festhaelt. Ein Ton, der
    // weniger als 40 % abdunkelt, ist auf seiner eigenen Flaeche kein Zeichen
    // mehr, sondern ein Hauch — und mipt sich vollends weg.
    const rel = 1 - (t[0] + t[1] + t[2]) / (c.r + c.g + c.b);
    assert.ok(rel > 0.40,
      zeichen + ' in ' + biom + ' dunkelt nur um ' + (rel * 100).toFixed(0) + ' % ab');
  }
});
