/* ==========================================================================
   Ebene 20 — Das Kartenbild wird voll (Runde J)

   Drei Dinge dieser Runde stehen hier auf dem Pruefstand:

   1  DIE FORMERKENNUNG. Klippe, Schlucht, Pass und Krater aus denselben
      vier Profilachsen wie die Gratsuche — gemessen an synthetischen
      Profilen, bei denen die richtige Antwort BEKANNT ist (Bodenstufe,
      V-Schlucht, Sattel, Ringwall), nicht an gewachsenem Gelaende, wo jede
      Behauptung eine Vermutung waere. Dazu die Negativproben: ein Dach ist
      keine Klippe, ein Kegel kein Krater, und zweimal gerechnet ist
      bitgleich.
   2  DIE NEUEN QUELLEN. Biomflaechen tragen ihr Flaechenzeichen in der
      Palette IHRES Bioms (sig_karst, sig_tundra, sig_salzpfanne, dazu der
      Vulkan als Punktzeichen), und ein Feld mit frucht "wein" traegt den
      Weinberg — samt Rueckfall auf den Acker, wenn das Band endet.
   3  DAS NASSE UFER. Das `ufer`-Feld faerbt das Gras am Seeufer nass-dunkel,
      es entsteht ausschliesslich auf dem Commit-Weg (rebuildCorridors) und
      verschwindet mit dem See. Ohne Stempel ist die Terrainfarbe bitgleich
      zum Bestand — dieselbe Zusage wie bei Biomflaechen und Beruhigung.

   TESTISOLATION wie in Ebene 17: jede Welt entsteht IM Test, nie beim
   Import. Diese Datei steht BEWUSST NICHT in index.mjs (Anweisung der
   Runde); sie laeuft ueber das Glob oder direkt:
       node --test terra/test/20-kartenbild-voll.test.mjs
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeTerra } from './hilfen/laden.mjs';
import { testWelt } from './hilfen/karte.mjs';

const SIG = await ladeTerra('render/signaturen.js');
const ZEI = await ladeTerra('generators/zeichen.js');
const ARE = await ladeTerra('generators/areas.js');


/* ==========================================================================
   1 — Formerkennung: Klippe
   ========================================================================== */

/** Schreibt ein Profil h(x, z) in das ganze Hoehenfeld und liefert die
 *  Sicherung zum Wiederherstellen. */
function profil(w, f) {
  const { VW, HALF } = w.m.store;
  const hgt = w.m.terrain.hgt;
  const sicherung = hgt.slice();
  for (let j = 0; j < VW; j++) {
    for (let i = 0; i < VW; i++) hgt[j * VW + i] = f(i - HALF, j - HALF);
  }
  return sicherung;
}

const KASTEN = { x0: -32, z0: -32, x1: 32, z1: 32, sp: 4, d: 4 };

test('J — eine Bodenstufe liefert Klippen entlang der Kante, sonst nichts', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  // Plateau auf 30, ab x = 0 Sturz mit Gefaelle 2,5 auf den Boden bei 6.
  const sicherung = profil(w, (x) => x < 0 ? 30 : Math.max(30 - x * 2.5, 6));
  try {
    const f = ZEI.reliefFormen(KASTEN);
    const klippen = f.punkte.filter((p) => p.typ === 'klippe');
    assert.ok(klippen.length >= 5, 'nur ' + klippen.length + ' Klippenpunkte an einer 64er-Kante');
    for (const p of klippen) {
      // Die Kante liegt bei x = 0; ein Punkt weiter als die Stuetzweite
      // daneben saesse auf Plateau oder Flanke.
      assert.ok(Math.abs(p.x) <= KASTEN.sp, 'Klippenpunkt bei x=' + p.x + ' statt an der Kante');
      // Zahnlinie LAENGS der Kante, also entlang z.
      assert.ok(Math.abs(p.dx) < 1e-9 && Math.abs(Math.abs(p.dz) - 1) < 1e-9,
        'Klippenrichtung ' + p.dx + '/' + p.dz + ' laeuft nicht laengs der Kante');
    }
    assert.equal(f.punkte.filter((p) => p.typ === 'schlucht').length, 0,
      'Eine Stufe ist keine Schlucht');
    assert.equal(f.punkte.filter((p) => p.typ === 'pass').length, 0);
    assert.equal(f.krater.length, 0);
  } finally { w.m.terrain.hgt.set(sicherung); }
});

test('J — ein Dachprofil ist ein Grat und KEINE Klippe', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  // Exakt das Profil aus Ebene 14: beidseitiger Fall = Kamm. Die Klippe
  // verlangt eine EBENE Seite — auf dem Dach darf sie nicht feuern, sonst
  // stuenden Zahnlinie und Kammschraffur uebereinander.
  const sicherung = profil(w, (x) => Math.max(3, 40 - Math.abs(x - 11) * 1.2));
  try {
    const f = ZEI.reliefFormen({ x0: -30, z0: -30, x1: 50, z1: 30, sp: 4, d: 4 });
    assert.equal(f.punkte.filter((p) => p.typ === 'klippe').length, 0,
      'Auf dem Dach wurden Klippen gefunden');
    assert.equal(f.punkte.filter((p) => p.typ === 'pass').length, 0);
    assert.equal(f.krater.length, 0);
  } finally { w.m.terrain.hgt.set(sicherung); }
});


/* ==========================================================================
   2 — Formerkennung: Schlucht
   ========================================================================== */

test('J — eine V-Schlucht wird am Grund gefunden und laeuft laengs', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  // Grund bei x = 0 auf Hoehe 6, Waende steigen mit 2,0 auf 30.
  const sicherung = profil(w, (x) => Math.min(30, 6 + Math.abs(x) * 2.0));
  try {
    const f = ZEI.reliefFormen(KASTEN);
    const schluchten = f.punkte.filter((p) => p.typ === 'schlucht');
    assert.ok(schluchten.length >= 5, 'nur ' + schluchten.length + ' Schluchtpunkte');
    for (const p of schluchten) {
      assert.ok(Math.abs(p.x) <= KASTEN.sp, 'Schluchtpunkt bei x=' + p.x + ' statt am Grund');
      assert.ok(Math.abs(p.dx) < 1e-9 && Math.abs(Math.abs(p.dz) - 1) < 1e-9,
        'Schluchtrichtung laeuft nicht laengs der Schlucht');
    }
    // Die Oberkanten der Waende DUERFEN als Klippen lesen (eine breite
    // Schlucht wird auf Karten mit zwei Kantenlinien gestochen) — aber nie
    // am Grund.
    for (const p of f.punkte.filter((q) => q.typ === 'klippe')) {
      assert.ok(Math.abs(p.x) > KASTEN.sp, 'Klippe am Schluchtgrund (x=' + p.x + ')');
    }
    assert.equal(f.punkte.filter((p) => p.typ === 'pass').length, 0);
  } finally { w.m.terrain.hgt.set(sicherung); }
});


/* ==========================================================================
   3 — Formerkennung: Pass
   ========================================================================== */

test('J — ein Sattel liefert genau EINEN Pass, auf dem Sattelpunkt', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  // Kamm laeuft entlang z (faellt nach beiden x... nein: steigt entlang x),
  // praezise: entlang x steigt es vom Sattel weg (der Kamm), entlang z
  // faellt es in beide Taeler. Sattelpunkt exakt bei (0,0) — und (0,0) ist
  // ein Rasterpunkt des Suchkastens, damit die Pruefung die ERKENNUNG misst
  // und nicht das Rasterglueck.
  const sicherung = profil(w, (x, z) => 20 + Math.abs(x) * 1.2 - Math.abs(z) * 1.2);
  try {
    const f = ZEI.reliefFormen(KASTEN);
    const paesse = f.punkte.filter((p) => p.typ === 'pass');
    assert.equal(paesse.length, 1,
      paesse.length + ' Paesse auf einem Profil mit genau einem Sattel');
    assert.ok(Math.abs(paesse[0].x) <= KASTEN.sp && Math.abs(paesse[0].z) <= KASTEN.sp,
      'Der Pass liegt bei ' + paesse[0].x + '/' + paesse[0].z + ' statt am Sattel');
    // Der Weg ueber den Pass laeuft entlang der FALLachse (durch die Taeler).
    assert.ok(Math.abs(paesse[0].dx) < 1e-9 && Math.abs(Math.abs(paesse[0].dz) - 1) < 1e-9,
      'Passrichtung zeigt nicht durch die Taeler');
  } finally { w.m.terrain.hgt.set(sicherung); }
});

test('J — auf einem Kegel gibt es keinen Pass und keinen Krater', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const sicherung = profil(w, (x, z) =>
    Math.max(3, 50 - Math.sqrt((x - 5) * (x - 5) + (z + 3) * (z + 3)) * 1.1));
  try {
    const f = ZEI.reliefFormen({ x0: -40, z0: -40, x1: 40, z1: 40, sp: 4, d: 4 });
    assert.equal(f.punkte.filter((p) => p.typ === 'pass').length, 0,
      'Ein Kegel hat keinen Sattel');
    assert.equal(f.krater.length, 0, 'Ein Kegel ist kein Krater');
  } finally { w.m.terrain.hgt.set(sicherung); }
});


/* ==========================================================================
   4 — Formerkennung: Krater
   ========================================================================== */

test('J — ein Ringwall um eine Senke ist ein Krater, mit Zentrum in der Senke', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  // Ringwall bei r = 14 auf Hoehe 30, Senke bei 7.6, aussen faellt es auf 14
  // zurueck und bleibt dort — genau das unterscheidet den Krater von einer
  // Mulde, deren Umgebung hinter dem Rand WEITER steigt.
  const sicherung = profil(w, (x, z) => {
    const r = Math.sqrt(x * x + z * z);
    return r <= 24 ? 30 - Math.abs(r - 14) * 1.6 : 14;
  });
  try {
    const f = ZEI.reliefFormen(KASTEN);
    assert.ok(f.krater.length >= 1, 'Der Ringwall wurde nicht als Krater erkannt');
    const k = f.krater[0];
    assert.ok(Math.abs(k.x) <= KASTEN.sp && Math.abs(k.z) <= KASTEN.sp,
      'Kraterzentrum bei ' + k.x + '/' + k.z + ' statt in der Senke');
    assert.ok(k.r >= 8 && k.r <= 20, 'Ringradius ' + k.r + ' passt nicht zum Wall bei 14');
  } finally { w.m.terrain.hgt.set(sicherung); }
});

test('J — die Formerkennung ist eine reine Funktion des Hoehenfelds', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const kasten = { x0: 30, z0: 40, x1: 100, z1: 110, sp: 3, d: 3 };
  const a = ZEI.reliefFormen(kasten), b = ZEI.reliefFormen(kasten);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.ok(w.m.terrain.hgt.length > 0);
});


/* ==========================================================================
   5 — Die Formzeichen laufen ueber die Elementkette (core/dirty.js)
   ========================================================================== */

test('J — eine Fels-Streuung an der Kante traegt auf Kartenmassstab sig_klippe', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const { S } = w.m.store;
  const sicherung = profil(w, (x) => x < 0 ? 30 : Math.max(30 - x * 2.5, 6));
  try {
    const el = w.element('objekt', 'felsen', [{ x: 0, z: 0 }],
      { anzahl: 9, streuung: 14 }, 0x2001);
    S.einheitMeter = 250;
    w.erzeuge(el);
    const kl = el.inst.sig_klippe;
    assert.ok(kl && kl.length >= 12,
      'keine Klippenzeichen an der Kante (' + (kl ? kl.length / 12 : 0) + ')');
    // Zweimal erzeugt ist bitgleich — der Weg ueber genElement eingeschlossen.
    const kopie = kl.slice();
    w.erzeuge(el);
    assert.deepEqual(Array.from(el.inst.sig_klippe), Array.from(kopie));
    // Auf Ortsmassstab gibt es keine Kartenzeichen.
    S.einheitMeter = 1;
    w.erzeuge(el);
    assert.ok(!el.inst.sig_klippe || el.inst.sig_klippe.length === 0,
      'Klippenzeichen auf Ortsmassstab');
    w.m.store.dropElement(el);
  } finally {
    w.m.terrain.hgt.set(sicherung);
    S.einheitMeter = 1;
  }
});


/* ==========================================================================
   6 — Biomflaechen tragen ihr Flaechenzeichen
   ========================================================================== */

const BIOM_POLY = [{ x: -60, z: -60 }, { x: 40, z: -65 }, { x: 50, z: 30 },
  { x: -50, z: 40 }];

test('J — jede Zuordnung der Biomtabelle zeigt auf eine echte Sache und ihr Zeichen', () => {
  const kaputt = [];
  for (const biom of Object.keys(ARE.BIOM_FLAECHENZEICHEN)) {
    const Z = ARE.BIOM_FLAECHENZEICHEN[biom];
    if (!SIG.SACHEN[Z.sache]) { kaputt.push(biom + ': Sache ' + Z.sache); continue; }
    if (!SIG.ZEICHEN[Z.art]) kaputt.push(biom + ': Zeichen ' + Z.art);
    // `art` muss im Waehler der Sache erlaubt sein, sonst faellt nachArt
    // still auf die Vorgabe zurueck und die Zuordnung ist eine Attrappe.
    if (SIG.SACHEN[Z.sache].zeichen.indexOf(Z.art) < 0) {
      kaputt.push(biom + ': ' + Z.art + ' gehoert nicht zur Sache ' + Z.sache);
    }
  }
  assert.deepEqual(kaputt, []);
});

test('J — Karst, Tundra und Salzpfanne erscheinen in der Palette ihres Bioms', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const { S } = w.m.store;
  const faelle = [['karst', 'sig_karst'], ['tundra', 'sig_tundra'],
    ['salzwueste', 'sig_salzpfanne']];
  try {
    for (const [biom, zeichen] of faelle) {
      const el = w.element('flaeche', 'biom', BIOM_POLY, { biom, weich: 6 }, 0x6001);
      S.einheitMeter = 2000;
      w.erzeuge(el);
      const a = el.inst[zeichen];
      assert.ok(a && a.length >= 12, biom + ': kein ' + zeichen + ' gestreut');
      // Der Tint kommt aus der Palette der FLAECHE, nicht der Karte.
      const soll = SIG.signaturTint(zeichen, biom);
      const kartenTint = SIG.signaturTint(zeichen, 'wiese');
      assert.notDeepEqual(soll, kartenTint,
        'Vorbedingung: die Paletten muessen sich unterscheiden, sonst misst der Test nichts');
      for (let k = 0; k < 3; k++) {
        assert.ok(Math.abs(a[9 + k] - soll[k]) < 1e-9,
          biom + ': Tintkanal ' + k + ' ist ' + a[9 + k] + ' statt ' + soll[k]);
      }
      // Auf Ortsmassstab bleibt die Biomflaeche unsichtbar wie bisher.
      S.einheitMeter = 1;
      w.erzeuge(el);
      assert.equal(Object.keys(el.inst).length, 0, biom + ': Instanzen auf Ortsmassstab');
      w.m.store.dropElement(el);
    }
  } finally { S.einheitMeter = 1; }
});

test('J — der Vulkan ist EIN Punktzeichen, Biome ohne Eintrag bleiben Flaechenton', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const { S } = w.m.store;
  try {
    const vk = w.element('flaeche', 'biom', BIOM_POLY, { biom: 'vulkan', weich: 6 }, 0x6002);
    S.einheitMeter = 2000;
    w.erzeuge(vk);
    assert.ok(vk.inst.sig_vulkan, 'kein Vulkanzeichen');
    assert.equal(vk.inst.sig_vulkan.length, 12,
      'Ein Vulkan ist ein Berg, kein Muster — genau EIN Zeichen');
    w.m.store.dropElement(vk);
    // Hochland hat bewusst keinen Eintrag: sein Flaechenton traegt es.
    const hl = w.element('flaeche', 'biom', BIOM_POLY, { biom: 'hochland', weich: 6 }, 0x6003);
    w.erzeuge(hl);
    assert.equal(Object.keys(hl.inst).length, 0,
      'Ein Biom ohne Zuordnung darf kein Zeichen erfinden');
    w.m.store.dropElement(hl);
  } finally { S.einheitMeter = 1; }
});


/* ==========================================================================
   7 — Der Weinberg
   ========================================================================== */

test('J — frucht "wein" traegt den Weinberg und faellt oberhalb auf den Acker zurueck', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const { S } = w.m.store;
  const POLY = [{ x: 20, z: 18 }, { x: 64, z: 14 }, { x: 68, z: 48 }, { x: 24, z: 54 }];
  try {
    const el = w.element('flaeche', 'feld', POLY, { frucht: 'wein' }, 0x7001);
    S.einheitMeter = 250;
    w.erzeuge(el);
    assert.ok(el.inst.sig_weinberg && el.inst.sig_weinberg.length >= 12,
      'kein Weinbergzeichen auf Regionsmassstab');
    // Ueber dem Band des Weinbergs (detail = 900, Ausblendrampe bis 1440)
    // uebernimmt der Acker — die kartografische Generalisierung, nicht das
    // Verschwinden. Gemessen bei 1500: dort ist der Weinberg sicher aus dem
    // Band und die Acker-Sache noch in ihrer Zeichenstufe (bis 1600); auf
    // 2000 traegt laut Katalog der FLAECHENTON den Acker, dort waere ein
    // fehlendes Zeichen keine Aussage ueber den Rueckfall.
    S.einheitMeter = 1500;
    w.erzeuge(el);
    assert.ok(!el.inst.sig_weinberg || el.inst.sig_weinberg.length === 0,
      'Weinberg ausserhalb seines Bandes');
    assert.ok(el.inst.sig_acker && el.inst.sig_acker.length >= 12,
      'Der Rueckfall auf den Acker fehlt');
    // Und auf Kontinentmassstab bleibt es beim Flaechenton — kein Zeichen.
    S.einheitMeter = 2000;
    w.erzeuge(el);
    assert.ok(!el.inst.sig_acker || el.inst.sig_acker.length === 0,
      'Auf Kontinentmassstab traegt der Flaechenton den Acker');
    w.m.store.dropElement(el);
    // Und Weizen bleibt, was er war: Acker.
    const wz = w.element('flaeche', 'feld', POLY, { frucht: 'weizen' }, 0x7002);
    S.einheitMeter = 250;
    w.erzeuge(wz);
    assert.ok(wz.inst.sig_acker && wz.inst.sig_acker.length >= 12);
    assert.ok(!wz.inst.sig_weinberg, 'Weizen ist kein Weinberg');
    w.m.store.dropElement(wz);
  } finally { S.einheitMeter = 1; }
});


/* ==========================================================================
   8 — Das nasse Ufer
   ========================================================================== */

test('J — ohne Stempel ist die Terrainfarbe bitgleich, mit Stempel nass', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const THREE = await import('three');
  const { S } = w.m.store;
  const T = w.m.terrain;
  const farbe = (m) => {
    S.einheitMeter = m;
    const c = new THREE.Color();
    T.terrainColor(6, 0.98, 10, 10, c, 1);
    return [c.r, c.g, c.b];
  };
  try {
    assert.equal(T.uferAt(10, 10), 0, 'frisches Feld muss leer sein');
    const trocken1 = farbe(1);
    const trocken2000 = farbe(2000);
    T.stampUfer(10, 10, 3);
    assert.ok(T.uferAt(10, 10) > 0.9, 'Stempelzentrum muss voll tragen');
    const nass1 = farbe(1);
    assert.notDeepEqual(nass1, trocken1, 'Der Uferstreifen faerbt nicht');
    // Nass heisst DUNKLER — sonst waere es der erdige Tritt, nicht das Wasser
    // im Boden.
    assert.ok(nass1[0] + nass1[1] + nass1[2] < trocken1[0] + trocken1[1] + trocken1[2],
      'Nasses Ufer muss dunkler sein als trockenes Gras');
    // Auf Kartenmassstab ist der Saum Korn und faellt mit der Beruhigung weg —
    // dort zeichnet sig_kueste die Uferlinie. Bitgleich, nicht nur aehnlich.
    assert.deepEqual(farbe(2000), trocken2000,
      'Auf Kontinentmassstab darf der Saum nicht durchschlagen');
    // clearWear raeumt beide Laufzeitmasken — danach wieder der Bestand.
    T.clearWear();
    assert.deepEqual(farbe(1), trocken1, 'clearWear muss auch das Ufer leeren');
  } finally { S.einheitMeter = 1; }
});

test('J — das Ufer entsteht auf dem Commit-Weg und geht mit dem See', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const D = w.m.dirty;
  const T = w.m.terrain;
  const SEE = await ladeTerra('generators/see.js');
  const punkte = [{ x: -40, z: -30 }, { x: 20, z: -40 }, { x: 45, z: 10 },
    { x: 0, z: 45 }, { x: -45, z: 15 }];
  const el = w.element('flaeche', 'see', punkte, { ufer: false, saum: 0 }, 0x8001);
  // Der See ist seit Runde J ein SCHWERES Element: seine Korridorstempel und
  // sein Uferstreifen entstehen nur in der schweren Kette. Vorher wurden
  // beide erst beim naechsten fremden schweren Commit gestempelt.
  assert.equal(D.isHeavy(el), true, 'flaeche:see muss ein schweres Element sein');
  D.rebuildCorridors();
  const uz = SEE.seeUmriss(el);
  assert.ok(uz.length >= 3);
  let getroffen = 0;
  for (const q of uz) if (T.uferAt(q.x, q.z) > 0.5) getroffen++;
  assert.ok(getroffen / uz.length > 0.9,
    'nur ' + getroffen + ' von ' + uz.length + ' Uferpunkten sind gestempelt');
  assert.equal(T.uferAt(90, 90), 0, 'weit vom See darf nichts nass sein');
  assert.equal(T.uferAt(0, 0), 0, 'die Seemitte ist Wasser, kein Uferstreifen');
  // Loeschen: der naechste Neuaufbau der Masken nimmt das Ufer mit.
  w.m.store.dropElement(el);
  D.rebuildCorridors();
  let rest = 0;
  for (const q of uz) if (T.uferAt(q.x, q.z) > 0) rest++;
  assert.equal(rest, 0, rest + ' Uferpunkte bleiben nach dem Loeschen stehen');
});
