/* ==========================================================================
   Ebene 3 — Generator-Invarianten

   Der Platzierungsvertrag steht in generators/objects.js als vier Funktionen:

     tryPlace       Land: Hoehe >= WATER + 0.35, Hangneigung <= 40 Grad,
                    NICHT im Korridor (ausser mit opts.ignoreCorridor),
                    innerhalb der Karte, kein Ueberlapp im Belegungsraster.
     tryPlaceWasser Wasser: Hoehe < WATER - 0.3. Hang und Korridor bleiben
                    ausdruecklich ungeprueft.
     tryPlaceUfer   Uferband: |Hoehe - WATER| < 0.8.
     tryPlaceFrei   ohne jede Gelaendepruefung (Schwebendes).

   Der Vertrag gilt fuer die STREUENDEN Generatoren. Die dokumentierten
   Ausnahmen sind gewollt und werden hier NICHT als Verstoss gewertet:
     - pfad:*      Strasse, Mauer, Hecke, Fluss und Bruch folgen der
                   gezeichneten Linie und stempeln ihren Korridor selbst.
     - flaeche:viertel/burg/werft/kloster  bauen AUF ihre eigenen Korridore
                   (Gassen, Mauerring, Kaiflucht) und bis ans Wasser.
     - objekt:maritim / hafen  stehen im Wasser (eigener Vertrag, unten geprueft).
     - objekt:inseln, ranke:*  schweben (tryPlaceFrei bzw. eigene Rechnung).
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { testWelt, beispielKarte, BEISPIEL_SEED, BEISPIEL_POLY } from './hilfen/karte.mjs';

/* Elementarten, fuer die der Landvertrag AUSNAHMSLOS gilt. */
const LANDSTREUER = [
  ['flaeche', 'wald', BEISPIEL_POLY, null],
  ['flaeche', 'wiese', BEISPIEL_POLY, null],
  ['flaeche', 'feld', BEISPIEL_POLY, null],
  ['objekt', 'baeume', [{ x: -45, z: 40 }], { anzahl: 25, streuung: 30 }],
  ['objekt', 'haeuser', [{ x: 10, z: -10 }], { anzahl: 15, streuung: 30 }],
  ['objekt', 'felsen', [{ x: 40, z: 40 }], { anzahl: 20, streuung: 30 }],
  ['objekt', 'natur', [{ x: -20, z: -20 }], { anzahl: 25, streuung: 30 }],
  ['objekt', 'klassisch', [{ x: 30, z: 60 }], { anzahl: 12, streuung: 25 }],
  ['objekt', 'ruinen', [{ x: -60, z: -20 }], { anzahl: 12, streuung: 25 }]
];

/** Laeuft ueber alle Instanzen eines Elements: fn(pool, x, y, z, tint). */
function jedeInstanz(el, fn) {
  for (const pool of Object.keys(el.inst)) {
    const a = el.inst[pool];
    for (let i = 0; i < a.length; i += 12) {
      fn(pool, a[i], a[i + 1], a[i + 2], [a[i + 9], a[i + 10], a[i + 11]], i / 12);
    }
  }
}

test('Ebene 3 — streuende Generatoren halten den Landvertrag', async (t) => {
  const welt = await testWelt({ seed: BEISPIEL_SEED });
  const T = welt.m.terrain, { WATER, COS40 } = welt.m.store;
  for (const [kind, variant, punkte, extra] of LANDSTREUER) {
    await t.test(kind + ':' + variant, () => {
      const el = welt.element(kind, variant, punkte, extra, 0x1234);
      welt.erzeuge(el);
      const wasser = [], steil = [], korridor = [];
      jedeInstanz(el, (pool, x, y, z) => {
        if (T.heightAt(x, z) < WATER + 0.35) wasser.push(pool + '@' + x.toFixed(1) + '/' + z.toFixed(1));
        if (T.slopeAt(x, z) < COS40) steil.push(pool + '@' + x.toFixed(1) + '/' + z.toFixed(1));
        if (T.inCorridor(x, z)) korridor.push(pool + '@' + x.toFixed(1) + '/' + z.toFixed(1));
      });
      assert.deepEqual(wasser, [], 'Instanzen im Wasser');
      assert.deepEqual(steil, [], 'Instanzen steiler als 40 Grad');
      assert.deepEqual(korridor, [], 'Instanzen im Korridor');
      assert.ok(el.total > 0, 'nichts erzeugt — der Fall waere wertlos');
    });
  }
});

test('Ebene 3 — der Korridor wird wirklich gemieden (Gegenprobe)', async () => {
  /* Ohne Gegenprobe koennte der Vertrag auch dadurch „erfuellt" sein, dass
     gar kein Korridor existiert. Hier laeuft eine Strasse mitten durch die
     Waldflaeche; danach muss der Wald dort eine Schneise haben. */
  const welt = await testWelt({ seed: BEISPIEL_SEED });
  const T = welt.m.terrain;
  const wald = welt.element('flaeche', 'wald', BEISPIEL_POLY, null, 0x1234);
  welt.erzeuge(wald);
  const ohneStrasse = wald.total;

  welt.element('pfad', 'strasse',
    [{ x: -45, z: -20 }, { x: 0, z: 0 }, { x: 40, z: 10 }], { breite: 14 }, 0x4321);
  welt.alleNeu();
  welt.alleNeu();
  let imKorridor = 0;
  jedeInstanz(wald, (pool, x, y, z) => { if (T.inCorridor(x, z)) imKorridor++; });
  assert.equal(imKorridor, 0, 'Der Wald waechst in die Strasse hinein');
  assert.ok(wald.total < ohneStrasse,
    'Die Strasse hat keine einzige Baumstelle gekostet — dann sperrt der Korridor nicht');
});

test('Ebene 3 — maritime Objekte stehen im Wasser', async () => {
  const welt = await testWelt({ seed: BEISPIEL_SEED });
  const T = welt.m.terrain, { WATER } = welt.m.store;
  const el = welt.element('objekt', 'maritim', [{ x: 105, z: 15 }], { anzahl: 20, streuung: 25 }, 0x77);
  welt.erzeuge(el);
  assert.ok(el.total > 0, 'kein Schiff gesetzt — Fall waere wertlos');
  const anLand = [];
  jedeInstanz(el, (pool, x, y, z) => {
    if (T.heightAt(x, z) >= WATER - 0.3) anLand.push(pool);
  });
  assert.deepEqual(anLand, [], 'Maritime Objekte stehen an Land');
});

test('Ebene 3 — Instanzdeckel je Element wird eingehalten', async () => {
  const welt = await testWelt({ seed: BEISPIEL_SEED });
  const { MAX_INST_PER_EL } = welt.m.store;
  const el = welt.element('flaeche', 'wiese', [{ x: 0, z: 0 }], null, 1);
  // Direkt gegen den Vertrag von pools.emit fahren: mehr Aufrufe als der
  // Deckel erlaubt. Ueber einen Generator waere der Fall von Dichte und
  // Gelaende abhaengig und damit kein verlaesslicher Test.
  for (let i = 0; i < MAX_INST_PER_EL + 500; i++) {
    welt.m.pools.emit(el, 'gras', 0, 0, 0, 0, 1, 1, 1, null, 0, 0);
  }
  assert.equal(el.total, MAX_INST_PER_EL, 'emit hat den Deckel ueberlaufen lassen');
  let gezaehlt = 0;
  jedeInstanz(el, () => { gezaehlt++; });
  assert.equal(gezaehlt, MAX_INST_PER_EL, 'Es liegen mehr Instanzdaten vor als gezaehlt');
});

test('Ebene 3 — die Beispielkarte bleibt unter dem Deckel', async () => {
  const welt = await testWelt({ seed: BEISPIEL_SEED });
  const { MAX_INST_PER_EL, S } = welt.m.store;
  beispielKarte(welt);
  welt.alleNeu(); welt.alleNeu();
  for (const el of S.elements) {
    assert.ok(el.total <= MAX_INST_PER_EL,
      el.kind + ':' + el.variant + ' hat ' + el.total + ' Instanzen (Deckel ' + MAX_INST_PER_EL + ')');
  }
});

test('Ebene 3 — keine NaN in den Pool-Geometrien', async () => {
  const welt = await testWelt({ seed: BEISPIEL_SEED });
  const POOLS = welt.m.pools.POOLS;
  const fehlend = [], kaputt = [];
  for (const name of Object.keys(POOLS)) {
    const g = POOLS[name].geo, a = g.attributes;
    for (const attr of ['position', 'normal', 'color', 'uv']) {
      if (!a[attr]) { fehlend.push(name + '/' + attr); continue; }
      const arr = a[attr].array;
      for (let i = 0; i < arr.length; i++) {
        if (!Number.isFinite(arr[i])) { kaputt.push(name + '/' + attr + '[' + i + ']'); break; }
      }
    }
    if (!a.position || a.position.count === 0) fehlend.push(name + '/leer');
  }
  assert.deepEqual(fehlend, [], 'Pools ohne vollstaendige Attribute');
  assert.deepEqual(kaputt, [], 'Pools mit NaN oder Infinity');
  assert.ok(Object.keys(POOLS).length > 250, 'unerwartet wenige Pools: ' + Object.keys(POOLS).length);
});

test('Ebene 3 — jeder gezeichnete Vertex hat eine Normale', async () => {
  /* Eine Normale der Laenge 0 heisst: der Vertex bekommt kein Licht und wird
     schwarz. Beim ersten Lauf dieser Pruefung (Runde I5) trugen 17 Pools
     solche Normalen, angefuehrt von den Bruchkanten-Ruinen (ruinenturm 27 %,
     mauerruine 25 %, saeulenstumpf 22 %). Ursache war `bruchkante`: klappt sie
     zwei Ecken eines Dreiecks auf dieselbe Schnittebene, bleibt ein Dreieck
     ohne Flaeche uebrig, und computeVertexNormals addiert dafuer nur Nullen.

     Seit diese Dreiecke aussortiert werden (plus `normalenRetten` in mergeGeos
     als Netz) ist der Wert bei den GEZEICHNETEN Vertices ueberall 0.

     Zaehlen darf man nur, was der Index auch nennt: die Ruinen tragen weiter
     Vertices, an denen nach dem Schnitt kein Dreieck mehr haengt. Die kommen
     nie in den Rasterizer, ihre Normale ist gleichgueltig — es ist totes
     Gewicht im Puffer, kein Bildfehler. Der zweite Teil haelt fest, dass
     dieses Gewicht nicht weiter waechst. */
  const welt = await testWelt({ seed: BEISPIEL_SEED });
  const POOLS = welt.m.pools.POOLS;
  const schwarz = [], ballast = [];
  for (const name of Object.keys(POOLS)) {
    const g = POOLS[name].geo, arr = g.attributes.normal.array;
    const n = g.attributes.position.count;
    const benutzt = new Uint8Array(n);
    if (g.index) { for (const v of g.index.array) benutzt[v] = 1; } else benutzt.fill(1);
    let tot = 0, totGez = 0, gez = 0;
    for (let v = 0; v < n; v++) {
      const i = v * 3;
      const leer = Math.hypot(arr[i], arr[i + 1], arr[i + 2]) < 0.5;
      if (leer) tot++;
      if (benutzt[v]) { gez++; if (leer) totGez++; }
    }
    if (totGez) schwarz.push(name + ': ' + totGez + ' von ' + gez);
    if (n && tot / n > 0.35) ballast.push(name + ' ' + (100 * tot / n).toFixed(0) + '%');
  }
  assert.deepEqual(schwarz, [], 'Diese Pools zeichnen unbeleuchtete Vertices');
  assert.deepEqual(ballast, [], 'Pools mit ueber 35 % verwaisten Vertices im Puffer');
});

test('Ebene 3 — keine NaN in Instanzen, Schatten und Element-Meshes', async () => {
  const welt = await testWelt({ seed: BEISPIEL_SEED });
  const S = welt.m.store.S;
  beispielKarte(welt);
  welt.alleNeu(); welt.alleNeu();
  const kaputt = [];
  for (const el of S.elements) {
    const wo = el.kind + ':' + el.variant;
    for (const pool of Object.keys(el.inst)) {
      const a = el.inst[pool];
      for (let i = 0; i < a.length; i++) {
        if (!Number.isFinite(a[i])) { kaputt.push(wo + '/' + pool + '[' + i + ']'); break; }
      }
    }
    for (let i = 0; i < el.schatten.length; i++) {
      if (!Number.isFinite(el.schatten[i])) { kaputt.push(wo + '/schatten[' + i + ']'); break; }
    }
    for (let i = 0; i < el.rauch.length; i++) {
      if (!Number.isFinite(el.rauch[i])) { kaputt.push(wo + '/rauch[' + i + ']'); break; }
    }
    for (const kind of (el.group ? el.group.children : [])) {
      if (!kind.geometry) continue;
      for (const attr of Object.keys(kind.geometry.attributes)) {
        const arr = kind.geometry.attributes[attr].array;
        for (let i = 0; i < arr.length; i++) {
          if (!Number.isFinite(arr[i])) { kaputt.push(wo + '/mesh.' + attr); break; }
        }
      }
    }
  }
  assert.deepEqual(kaputt, []);
});

test('Ebene 3 — jeder in objects.js genannte Poolname existiert', async () => {
  const welt = await testWelt({ seed: BEISPIEL_SEED });
  const POOLS = welt.m.pools.POOLS, O = welt.m.objects;
  const fehlt = [];
  for (const gruppe of Object.keys(O.OBJGRUPPEN)) {
    for (const eintrag of O.OBJGRUPPEN[gruppe]) {
      if (!POOLS[eintrag[0]]) fehlt.push('OBJGRUPPEN.' + gruppe + ' -> ' + eintrag[0]);
    }
  }
  /* KULTUR ist verschachtelt (Stil -> Rolle -> wpick-Tabelle). Ein
     wpick-Eintrag ist [name, gewicht]; alles andere wird weiter durchlaufen. */
  const suche = (knoten, pfad) => {
    if (Array.isArray(knoten)) {
      if (typeof knoten[0] === 'string' && typeof knoten[1] === 'number') {
        if (!POOLS[knoten[0]]) fehlt.push(pfad + ' -> ' + knoten[0]);
        return;
      }
      knoten.forEach((k, i) => suche(k, pfad + '[' + i + ']'));
      return;
    }
    if (knoten && typeof knoten === 'object') {
      for (const k of Object.keys(knoten)) suche(knoten[k], pfad + '.' + k);
    }
  };
  suche(O.KULTUR, 'KULTUR');
  assert.deepEqual(fehlt, []);
});

test('Ebene 3 — InstancedMesh.count entspricht der Belegung', async () => {
  const welt = await testWelt({ seed: BEISPIEL_SEED });
  const { S } = welt.m.store, { POOLS, flushPack } = welt.m.pools;
  beispielKarte(welt);
  welt.alleNeu(); welt.alleNeu();
  flushPack();

  const soll = {};
  for (const el of S.elements) {
    for (const pool of Object.keys(el.inst)) {
      soll[pool] = (soll[pool] || 0) + el.inst[pool].length / 12;
    }
  }
  const abweichung = [];
  for (const name of Object.keys(POOLS)) {
    const pool = POOLS[name], erwartet = soll[name] || 0;
    if (pool.count !== erwartet) abweichung.push(name + ': count ' + pool.count + ' statt ' + erwartet);
    if (pool.mesh && pool.mesh.count !== erwartet) {
      abweichung.push(name + ': mesh.count ' + pool.mesh.count + ' statt ' + erwartet);
    }
    if (pool.mesh && pool.mesh.count > pool.mesh.maxCount) {
      abweichung.push(name + ': count ueber der Kapazitaet');
    }
  }
  assert.deepEqual(abweichung, []);
  assert.ok(Object.keys(soll).length > 20, 'zu wenige belegte Pools: ' + Object.keys(soll).length);
});

test('Ebene 3 — jede Instanz zeigt auf einen existierenden Pool', async () => {
  const welt = await testWelt({ seed: BEISPIEL_SEED });
  const { S } = welt.m.store, { POOLS } = welt.m.pools;
  beispielKarte(welt);
  welt.alleNeu(); welt.alleNeu();
  const unbekannt = new Set();
  for (const el of S.elements) {
    for (const pool of Object.keys(el.inst)) if (!POOLS[pool]) unbekannt.add(pool);
  }
  assert.deepEqual([...unbekannt], []);
});

test('Ebene 3 — Instanzen liegen innerhalb der Karte', async () => {
  const welt = await testWelt({ seed: BEISPIEL_SEED });
  const { S, KARTE } = welt.m.store;
  beispielKarte(welt);
  welt.alleNeu(); welt.alleNeu();
  const halb = KARTE.half;
  const draussen = [];
  for (const el of S.elements) {
    jedeInstanz(el, (pool, x, y, z) => {
      if (Math.abs(x) > halb + 2 || Math.abs(z) > halb + 2) {
        draussen.push(el.kind + ':' + el.variant + '/' + pool + '@' + x.toFixed(0) + '/' + z.toFixed(0));
      }
    });
  }
  assert.deepEqual(draussen, []);
});
