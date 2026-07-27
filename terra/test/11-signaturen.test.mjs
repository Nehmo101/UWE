/* ==========================================================================
   I1 — Signaturen (render/signaturen.js)

   Acht Zusagen, die das Modul schriftlich gibt:

   1  Der Atlas ist vollstaendig und ueberschneidungsfrei. Ein Zeichen ohne
      Feld ist ein unsichtbarer Pool, zwei Zeichen auf einem Feld sind ein
      falsches Bild — beides faellt sonst erst in der Sichtpruefung auf.
   2  Alles ist deterministisch. Der Atlas wird beim Start gezeichnet; zweimal
      gestartet muss dasselbe Blatt herauskommen, sonst wandert die ganze
      Karte.
   3  Die Baender sind lueckenlos. Eine Luecke heisst: bei diesem Zoom
      verschwindet der Wald. Das ist die Pruefung, die den meisten Aerger
      verhindert.
   4  Der Ausblendfaktor blendet ueber, statt zu schalten — und an der Grenze
      zweier Stufen summieren sich beide zu genau 1. Kein Loch, kein doppelt
      deckendes Bild.
   5  Die Groesse haengt am BILD, nicht an der Welt. Eine Ortssignatur ist auf
      einer 2-km- und auf einer 2000-km-Karte gleich gross.
   6  Die Zeichenwahl ist an den Schwellen eindeutig, und ein Element ohne
      Kennzahl faellt sinnvoll zurueck.
   7  Die Streuung ist ortsstabil: eine verschobene Flaeche nimmt ihre Marken
      mit, statt neu zu wuerfeln.
   8  Es gibt keine toten Zeichen. Genau diese Pruefung hat in Runde I5 einen
      seit Monaten toten Pool gefunden.

   Das Modul braucht weder Browser noch echtes Canvas: die rechnenden Teile
   sind DOM-frei, der Zeichenweg nimmt den Kontext als Parameter. Hier steht
   dafuer ein mitschreibender Ersatz (protokollKontext), der jeden Aufruf UND
   jede Eigenschaftszuweisung in eine Liste legt.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeTerra } from './hilfen/laden.mjs';

const SIG = await ladeTerra('render/signaturen.js');
const STORE = await ladeTerra('core/store.js');

/** Feine Leiter ueber den ganzen Massstabsbereich, geometrisch gestuft —
 *  linear gestuft laege die Haelfte der Punkte auf Kontinentmassstab. */
const LEITER = (() => {
  const p = [];
  const a = Math.log(SIG.MASSSTAB_MIN), b = Math.log(SIG.MASSSTAB_MAX);
  for (let i = 0; i <= 240; i++) p.push(Math.exp(a + (b - a) * i / 240));
  // dazu die Ankerpunkte der Leiter und alle Uebergabepunkte exakt
  for (const L of SIG.MASSSTABSLEITER) { p.push(L.von); p.push(L.bis); }
  for (const k of Object.keys(SIG.UEBERGABE)) p.push(SIG.UEBERGABE[k]);
  return p.filter(m => m >= SIG.MASSSTAB_MIN && m <= SIG.MASSSTAB_MAX)
    .sort((x, y) => x - y);
})();

function fmt(v) {
  if (typeof v !== 'number') return String(v);
  return Number.isFinite(v) ? v.toFixed(6) : 'NICHT-ENDLICH(' + v + ')';
}

/**
 * Mitschreibender 2D-Kontext. Protokolliert Methodenaufrufe MIT Argumenten
 * und Eigenschaftszuweisungen (strokeStyle, lineWidth, …) — beides bestimmt
 * das Bild, beides muss deterministisch sein.
 */
function protokollKontext() {
  const log = [];
  const ziel = { log };
  const methoden = ['save', 'restore', 'translate', 'scale', 'rotate',
    'beginPath', 'moveTo', 'lineTo', 'arc', 'closePath', 'fill', 'stroke',
    'fillRect', 'clearRect'];
  for (const m of methoden) {
    ziel[m] = (...a) => { log.push(m + '(' + a.map(fmt).join(',') + ')'); };
  }
  return new Proxy(ziel, {
    set(t, p, v) { log.push(String(p) + '=' + String(v)); t[p] = v; return true; }
  });
}


/* ==========================================================================
   1 — Der Atlas ist vollstaendig
   ========================================================================== */

test('jedes Zeichen des Katalogs hat ein Atlasfeld und einen Maler', () => {
  assert.ok(SIG.ZEICHEN_NAMEN.length >= 45,
    'der Katalog nennt 49 Zeichen, gefunden: ' + SIG.ZEICHEN_NAMEN.length);
  for (const name of SIG.ZEICHEN_NAMEN) {
    assert.ok(SIG.atlasFeld(name), name + ' hat kein Atlasfeld');
    assert.equal(typeof SIG.MALER[name], 'function', name + ' hat keinen Maler');
  }
  // Gegenrichtung: kein Maler ohne Katalogeintrag (ein Zeichen, das gemalt
  // wird, aber niemandem gehoert, waere Tinte, die nie auf die Karte kommt).
  for (const name of Object.keys(SIG.MALER)) {
    assert.ok(SIG.ZEICHEN[name], 'Maler ohne Katalogeintrag: ' + name);
  }
});

test('kein Atlasfeld ist doppelt belegt', () => {
  const belegt = new Map();
  for (const name of SIG.ZEICHEN_NAMEN) {
    const f = SIG.atlasFeld(name);
    const schluessel = f.zeile + '/' + f.spalte;
    assert.ok(!belegt.has(schluessel),
      'Feld ' + schluessel + ' doppelt: ' + belegt.get(schluessel) + ' und ' + name);
    belegt.set(schluessel, name);
    assert.ok(f.zeile >= 0 && f.zeile < SIG.ATLAS_RASTER, name + ': Zeile ausserhalb');
    assert.ok(f.spalte >= 0 && f.spalte < SIG.ATLAS_RASTER, name + ': Spalte ausserhalb');
  }
  assert.ok(belegt.size <= SIG.ATLAS_RASTER * SIG.ATLAS_RASTER,
    'mehr Zeichen als Felder — das Blatt muss wachsen');
});

test('alle UV liegen im Blatt, sind sortiert und frei von NaN', () => {
  for (const name of SIG.ZEICHEN_NAMEN) {
    const [u0, v0, u1, v1] = SIG.atlasUV(name);
    for (const [w, bez] of [[u0, 'u0'], [v0, 'v0'], [u1, 'u1'], [v1, 'v1']]) {
      assert.ok(Number.isFinite(w), name + '.' + bez + ' ist nicht endlich');
      assert.ok(w >= 0 && w <= 1, name + '.' + bez + ' ausserhalb [0,1]: ' + w);
    }
    assert.ok(u1 > u0, name + ': u-Spanne nicht positiv');
    assert.ok(v1 > v0, name + ': v-Spanne nicht positiv');
    // Ein Feld darf hoechstens seinen Rasterplatz einnehmen.
    assert.ok(u1 - u0 <= 1 / SIG.ATLAS_RASTER + 1e-9, name + ': u-Spanne zu breit');
    assert.ok(v1 - v0 <= 1 / SIG.ATLAS_RASTER + 1e-9, name + ': v-Spanne zu hoch');
  }
});

test('kein Zeichen malt ueber seinen Rand hinaus', () => {
  // Der Rand des Feldes ist Sicherheitsabstand gegen Mip-Ausblutung. Wer ihn
  // ueberzeichnet, holt sich sein Nachbarzeichen ins Bild — und zwar genau
  // bei den kleinen Groessen, auf die es ankommt.
  const rand = (1 - SIG.ATLAS_INHALT) * 0.5 / SIG.ATLAS_INHALT;   // in Inhaltseinheiten
  for (const name of SIG.ZEICHEN_NAMEN) {
    const k = protokollKontext();
    SIG.zeichneFeld(k, name, { kachel: 1 });
    let lo = Infinity, hi = -Infinity;
    for (const zeile of k.log) {
      const m = /^(moveTo|lineTo|arc)\(([^)]*)\)$/.exec(zeile);
      if (!m) continue;
      const a = m[2].split(',').map(Number);
      if (m[1] === 'arc') {
        lo = Math.min(lo, a[0] - a[2], a[1] - a[2]);
        hi = Math.max(hi, a[0] + a[2], a[1] + a[2]);
      } else {
        lo = Math.min(lo, a[0], a[1]);
        hi = Math.max(hi, a[0], a[1]);
      }
    }
    assert.ok(lo >= -rand, name + ' malt bei ' + lo.toFixed(3) + ' in den Nachbarn');
    assert.ok(hi <= 1 + rand, name + ' malt bei ' + hi.toFixed(3) + ' in den Nachbarn');
  }
});

test('die Streifenzeichen kacheln nahtlos', () => {
  for (const name of SIG.ZEICHEN_NAMEN) {
    const streifen = SIG.ZEICHEN[name].streifen;
    assert.equal(streifen, SIG.ZEICHEN[name].gruppe === 'linie',
      name + ': Streifenflagge und Gruppe passen nicht zusammen');
    if (!streifen) continue;
    // Der Kachelbereich ist der Inhaltskasten, NICHT das ganze Feld —
    // sonst klafft an jeder Kachelgrenze der leere Rand.
    const [su0, sv0, su1, sv1] = SIG.atlasStreifenUV(name);
    const f = SIG.atlasFeld(name);
    assert.ok(su0 > f.u0 && su1 < f.u1, name + ': Kachelbereich nicht eingezogen');
    assert.ok(sv0 > f.v0 && sv1 < f.v1, name + ': Kachelbereich nicht eingezogen');
    assert.ok(Math.abs((su1 - su0) - (1 / SIG.ATLAS_RASTER) * SIG.ATLAS_INHALT) < 1e-9,
      name + ': Kachelbereich hat nicht die Inhaltsbreite');
    const k = protokollKontext();
    SIG.zeichneFeld(k, name, { kachel: 1 });
    let lo = Infinity, hi = -Infinity;
    for (const zeile of k.log) {
      const m = /^(moveTo|lineTo)\(([^)]*)\)$/.exec(zeile);
      if (!m) continue;
      const a = m[2].split(',').map(Number);
      lo = Math.min(lo, a[0]); hi = Math.max(hi, a[0]);
    }
    if (SIG.ZEICHEN[name].strich) {
      // Gestrichelt: das Muster beginnt EXAKT am Kachelanfang, dann faellt
      // die Kachelgrenze in eine Luecke und geht ueber sie hinweg auf.
      assert.ok(Math.abs(lo) < 1e-9, name + ': Strichmuster beginnt bei ' + lo);
      assert.ok(hi < 1, name + ': Strichmuster laeuft bis in die Grenze');
    } else {
      // Durchgezogen: muss ueber den Kasten hinauslaufen, damit die Kante
      // glatt abgeschnitten wird statt mit einer Kappe zu enden.
      assert.ok(lo <= -SIG.STREIFEN_UEBER + 1e-9,
        name + ': kein Ueberstand links (' + lo + ')');
      assert.ok(hi >= 1 + SIG.STREIFEN_UEBER - 1e-9,
        name + ': kein Ueberstand rechts (' + hi + ')');
    }
  }
});

test('die Atlasfelder ueberlappen einander nicht im UV-Raum', () => {
  const felder = SIG.ZEICHEN_NAMEN.map(n => ({ n, ...SIG.atlasFeld(n) }));
  for (let i = 0; i < felder.length; i++) {
    for (let k = i + 1; k < felder.length; k++) {
      const a = felder[i], b = felder[k];
      const uEcht = a.u0 < b.u1 && b.u0 < a.u1;
      const vEcht = a.v0 < b.v1 && b.v0 < a.v1;
      assert.ok(!(uEcht && vEcht), a.n + ' und ' + b.n + ' ueberlappen im Atlas');
    }
  }
});

test('die Geometrie eines Zeichens traegt die UV seines Feldes, ohne NaN', () => {
  for (const name of SIG.ZEICHEN_NAMEN) {
    const g = SIG.signaturGeometrie(name);
    assert.ok(g, name + ': keine Geometrie');
    const [u0, v0, u1, v1] = SIG.atlasUV(name);
    const uv = g.attributes.uv, pos = g.attributes.position;
    assert.ok(uv && uv.count > 0, name + ': keine UV');
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      assert.ok(Number.isFinite(u) && Number.isFinite(v), name + ': NaN in UV');
      assert.ok(u >= u0 - 1e-6 && u <= u1 + 1e-6, name + ': u ausserhalb des Feldes');
      assert.ok(v >= v0 - 1e-6 && v <= v1 + 1e-6, name + ': v ausserhalb des Feldes');
    }
    for (let i = 0; i < pos.count * 3; i++) {
      assert.ok(Number.isFinite(pos.array[i]), name + ': NaN in der Position');
    }
    // flach in XZ: kein Punkt hat eine Hoehe (sonst traegt sy Geometrie und
    // koennte nicht den Ausblendfaktor tragen — siehe Zusage 4)
    // (Rundung nahe null aus der Drehung um die x-Achse zugelassen — das ist
    // dieselbe 1e-16-Klasse, die schon der Three-Ersatz mitbringt.)
    for (let i = 0; i < pos.count; i++) {
      assert.ok(Math.abs(pos.getY(i)) < 1e-12, name + ': Quad liegt nicht flach in XZ');
    }
  }
});


/* ==========================================================================
   2 — Determinismus
   ========================================================================== */

test('der Atlas wird zweimal Zug fuer Zug gleich gezeichnet', () => {
  const a = protokollKontext(), b = protokollKontext();
  const nA = SIG.zeichneAtlas(a), nB = SIG.zeichneAtlas(b);
  assert.equal(nA, SIG.ZEICHEN_NAMEN.length, 'nicht alle Felder gezeichnet');
  assert.equal(nA, nB);
  assert.ok(a.log.length > 500, 'verdaechtig wenig Zeichenaufrufe: ' + a.log.length);
  assert.deepEqual(a.log, b.log);
});

test('kein Zeichenaufruf enthaelt NaN oder Unendlich', () => {
  const k = protokollKontext();
  SIG.zeichneAtlas(k);
  const schlecht = k.log.filter(z => z.indexOf('NICHT-ENDLICH') >= 0 || z.indexOf('NaN') >= 0);
  assert.deepEqual(schlecht, []);
});

test('jedes Feld traegt tatsaechlich Tinte', () => {
  // Ein leeres Feld waere ein unsichtbares Zeichen — und das ist im Betrieb
  // nicht von einem fehlenden Pool zu unterscheiden.
  for (const name of SIG.ZEICHEN_NAMEN) {
    const k = protokollKontext();
    SIG.zeichneFeld(k, name);
    const male = k.log.filter(z => z.startsWith('stroke(') || z.startsWith('fill('));
    assert.ok(male.length >= 1, name + ': malt nichts');
  }
});

test('die Streuung liefert zweimal dieselben Punkte', () => {
  const opt = { x0: -40, z0: -30, x1: 60, z1: 50, sp: 7.5, seed: 4711,
    ankerX: 3.25, ankerZ: -1.75 };
  const a = SIG.streuRaster(opt), b = SIG.streuRaster(opt);
  assert.ok(a.length > 30, 'zu wenige Marken fuer eine Aussage');
  assert.deepEqual(a, b);
});

test('die Geometrie eines Zeichens ist zweimal identisch', () => {
  for (const name of ['sig_dorf', 'sig_laubwald', 'sig_grenze']) {
    const a = SIG.signaturGeometrie(name), b = SIG.signaturGeometrie(name);
    assert.deepEqual(Array.from(a.attributes.uv.array), Array.from(b.attributes.uv.array));
    assert.deepEqual(Array.from(a.attributes.position.array),
      Array.from(b.attributes.position.array));
  }
});


/* ==========================================================================
   3 — Baender lueckenlos
   ========================================================================== */

test('jedes Zeichen beginnt am Uebergabepunkt des Bestands', () => {
  // Der Wert, an dem alles haengt: nur wenn `ab` eines Zeichens EXAKT dem
  // `sichtbarBis` der Koerperstufe entspricht, summieren sich die beiden
  // Ausblendfaktoren zu 1 (Zusage 4). Vier verschiedene untere Grenzen, wie
  // sie der Entwurf nennt (40/45/55/60), koennten das nicht.
  for (const name of SIG.ZEICHEN_NAMEN) {
    const b = SIG.bandVon(name);
    assert.equal(b.ab, SIG.UEBERGABE.koerper, name + ': faengt nicht am Uebergabepunkt an');
    assert.ok(b.bis > b.ab, name + ': Band ist leer oder verkehrt herum');
    assert.ok(Object.keys(SIG.UEBERGABE).some(k => SIG.UEBERGABE[k] === b.bis),
      name + ': `bis` ist kein benannter Uebergabepunkt (' + b.bis + ')');
  }
  assert.equal(SIG.VORGABE_BAND.bis, SIG.UEBERGABE.koerper,
    'das Vorgabeband des Bestands muss am Uebergabepunkt enden');
  assert.equal(SIG.VORGABE_BAND.ab, 0, 'der Bestand darf keine untere Grenze bekommen');
});

test('jede Darstellungskette deckt die Leiter lueckenlos ab', () => {
  for (const sache of SIG.SACHEN_NAMEN) {
    const kette = SIG.SACHEN[sache].kette;
    assert.ok(kette.length >= 1, sache + ': leere Kette');
    assert.equal(kette[0].von, SIG.MASSSTAB_MIN, sache + ': Kette beginnt nicht unten');
    assert.equal(kette[kette.length - 1].bis, SIG.MASSSTAB_MAX,
      sache + ': Kette endet nicht oben');
    for (let i = 1; i < kette.length; i++) {
      assert.equal(kette[i].von, kette[i - 1].bis,
        sache + ': Luecke oder Ueberlappung zwischen Stufe ' + (i - 1) + ' und ' + i);
    }
    for (const st of kette) {
      assert.ok(['koerper', 'zeichen', 'flaechenton', 'entfaellt', 'aufgegangen']
        .indexOf(st.art) >= 0, sache + ': unbekannte Stufenart ' + st.art);
      // Weglassen muss EINGETRAGEN sein, nicht bloss passieren.
      if (st.art === 'entfaellt' || st.art === 'flaechenton') {
        assert.ok(st.hinweis && st.hinweis.length > 4,
          sache + ': ' + st.art + ' ohne Begruendung');
      }
      if (st.art === 'aufgegangen') {
        assert.ok(SIG.SACHEN[st.in], sache + ': geht in eine unbekannte Sache auf');
      }
    }
  }
});

test('zu jedem Massstab gibt es fuer jede Sache eine Stufe — und nie null Darstellungen', () => {
  for (const sache of SIG.SACHEN_NAMEN) {
    const S1 = SIG.SACHEN[sache];
    for (const m of LEITER) {
      const st = SIG.darstellungAn(sache, m);
      assert.ok(st, sache + ' @ ' + m + ': keine Stufe');
      if (st.art !== 'koerper' && st.art !== 'zeichen') continue;
      // Aktive Darstellungen: die Koerperstufe im Vorgabeband und das
      // Leitzeichen der Sache. Genau eine oder zwei — nie null.
      const fK = SIG.bandFaktor(SIG.VORGABE_BAND.ab, SIG.VORGABE_BAND.bis, m);
      const fZ = S1.leit ? SIG.zeichenFaktor(S1.leit, m) : 0;
      const aktiv = (fK > 0 ? 1 : 0) + (fZ > 0 ? 1 : 0);
      assert.ok(aktiv >= 1 && aktiv <= 2,
        sache + ' @ ' + m + ': ' + aktiv + ' Darstellungen (' + fK + '/' + fZ + ')');
      assert.ok(fK + fZ > 1e-6,
        sache + ' @ ' + m + ': beide Darstellungen fast unsichtbar — hier klafft ein Loch');
    }
  }
});

test('kein Zeichen faellt zwischen die Baender seiner Wahlgruppe', () => {
  // Ein Zeichen, das die Zeichenwahl liefert, muss bei diesem Massstab auch
  // sichtbar sein — sonst gaebe die Wahl etwas zurueck, das niemand sieht.
  for (const sache of SIG.SACHEN_NAMEN) {
    const S1 = SIG.SACHEN[sache];
    if (!S1.waehle) continue;
    for (const m of LEITER) {
      for (const art of S1.zeichen) {
        for (const k of [0, 5, 40, 41, 150, 900]) {
          for (const name of SIG.zeichenFuer(sache, k, m, { art })) {
            assert.ok(SIG.zeichenFaktor(name, m) > 0,
              sache + ' @ ' + m + ' liefert ' + name + ', das dort unsichtbar ist');
          }
        }
      }
    }
  }
});


/* ==========================================================================
   4 — Der Ausblendfaktor
   ========================================================================== */

test('der Ausblendfaktor ist 0 ausserhalb, 1 in der Mitte und monoton dazwischen', () => {
  const ab = 60, bis = 2500;
  assert.equal(SIG.bandFaktor(ab, bis, ab), 0, 'an der unteren Kante nicht 0');
  assert.equal(SIG.bandFaktor(ab, bis, ab * 0.5), 0, 'unterhalb nicht 0');
  assert.equal(SIG.bandFaktor(ab, bis, bis * SIG.BLENDE), 0, 'an der oberen Kante nicht 0');
  assert.equal(SIG.bandFaktor(ab, bis, bis * 3), 0, 'oberhalb nicht 0');
  assert.equal(SIG.bandFaktor(ab, bis, 400), 1, 'in der Mitte nicht voll');

  // monoton steigend ueber die Einblendrampe, monoton fallend ueber die Ausblendrampe
  let vor = -1;
  for (let i = 0; i <= 40; i++) {
    const m = ab + (ab * SIG.BLENDE - ab) * i / 40;
    const f = SIG.bandFaktor(ab, bis, m);
    assert.ok(f >= vor - 1e-12, 'Einblendrampe faellt bei m=' + m);
    vor = f;
  }
  vor = 2;
  for (let i = 0; i <= 40; i++) {
    const m = bis + (bis * SIG.BLENDE - bis) * i / 40;
    const f = SIG.bandFaktor(ab, bis, m);
    assert.ok(f <= vor + 1e-12, 'Ausblendrampe steigt bei m=' + m);
    vor = f;
  }
});

test('an der Grenze zweier Stufen summieren sich beide zu genau 1', () => {
  // Der eigentliche Grund fuer die benannten Uebergabepunkte: weil
  // smoothstep punktsymmetrisch ist, ergaenzen sich die beiden Rampen ueber
  // demselben Intervall EXAKT — kein Loch, kein doppelt deckendes Bild.
  const X = SIG.UEBERGABE.koerper;
  for (let i = 0; i <= 60; i++) {
    const m = X * (1 + (SIG.BLENDE - 1) * i / 60);
    const unten = SIG.bandFaktor(SIG.VORGABE_BAND.ab, X, m);
    const oben = SIG.bandFaktor(X, SIG.UEBERGABE.voll, m);
    assert.ok(Math.abs(unten + oben - 1) < 1e-12,
      'Summe bei m=' + m + ' ist ' + (unten + oben));
  }
  // und weiter oben genauso, an einem anderen Uebergabepunkt
  const Y = SIG.UEBERGABE.gross;
  for (let i = 0; i <= 20; i++) {
    const m = Y * (1 + (SIG.BLENDE - 1) * i / 20);
    const unten = SIG.bandFaktor(X, Y, m);
    const oben = SIG.bandFaktor(Y, Y * SIG.BLENDE * 2, m);
    assert.ok(Math.abs(unten + oben - 1) < 1e-12,
      'Summe bei m=' + m + ' ist ' + (unten + oben));
  }
});

test('das Vorgabeband des Bestands rechnet nicht 0/0', () => {
  // sstep(0, 0, m) waere NaN und liefe als Tint bis in die Instanzdaten.
  for (const m of [0, 0.5, 1, 30, 60, 96, 4000]) {
    const f = SIG.bandFaktor(SIG.VORGABE_BAND.ab, SIG.VORGABE_BAND.bis, m);
    assert.ok(Number.isFinite(f), 'kein endlicher Faktor bei m=' + m);
    assert.ok(f >= 0 && f <= 1, 'Faktor ausserhalb [0,1] bei m=' + m);
  }
  assert.equal(SIG.bandFaktor(0, 60, 1), 1, 'der Bestand muss im Nahbereich voll da sein');
});

test('ohne Massstab bleibt alles sichtbar — der Bestand aendert sich nicht', () => {
  for (const m of [undefined, null, NaN, 'viel']) {
    assert.equal(SIG.bandFaktor(0, 60, m), 1);
    assert.equal(SIG.zeichenFaktor('sig_dorf', m), 1);
  }
});

test('der Ausblendfaktor landet als Verblassung in der Instanzskalierung', () => {
  // sy traegt bei einem flachen Quad keine Geometrie und ist deshalb der
  // einzige der 12 Festwerte, der frei ist.
  const nah = SIG.signaturPlatzierung('sig_dorf', { massstab: 400, kante: 256 });
  assert.ok(nah && Math.abs(nah.sy - 1) < 1e-9, 'volle Sichtbarkeit ergibt sy = 1');
  const rand = SIG.signaturPlatzierung('sig_dorf', { massstab: 75, kante: 256 });
  assert.ok(rand.sy > 0 && rand.sy < 1, 'in der Rampe muss sy dazwischenliegen');
  assert.ok(rand.sy >= SIG.VERBLASST_MIN, 'sy darf die Matrix nie singulaer machen');
  assert.equal(SIG.signaturPlatzierung('sig_dorf', { massstab: 20, kante: 256 }), null,
    'unterhalb des Bandes darf gar nichts erzeugt werden');
});


/* ==========================================================================
   5 — Groesse im Bild statt in der Welt
   ========================================================================== */

/** Kameraabstand, bei dem eine Karte der Kante `kante` gerade ins Bild passt. */
function ganzImBild(kante, fov) {
  return kante / (2 * Math.tan(fov * 0.5 * Math.PI / 180));
}

test('ein Zeichen ist auf jeder Kartengroesse im Bild gleich gross', () => {
  const fov = 30, bildHoehe = 900;
  const werte = [256, 512, 1024].map(kante =>
    SIG.signaturGroesse('sig_dorf',
      { kante, abstand: ganzImBild(kante, fov), fov, bildHoehe }).px);
  for (const px of werte) {
    assert.ok(Math.abs(px - werte[0]) < 1e-6,
      'Bildgroesse haengt an der Kartenkante: ' + werte.join(' / '));
  }
});

test('die Bildgroesse haengt nicht am Massstab der Karte', () => {
  // Eine 2-km-Karte und eine 2000-km-Karte haben dieselbe Kante in
  // Welteinheiten; nur die Bedeutung einer Zelle unterscheidet sich. Genau
  // deshalb rechnet die Groesse gegen die KANTE und nicht gegen Meter.
  const sicht = { kante: 512, abstand: ganzImBild(512, 30), fov: 30, bildHoehe: 900 };
  const klein = SIG.signaturGroesse('sig_dorf', { ...sicht, massstab: 1 });
  const gross = SIG.signaturGroesse('sig_dorf', { ...sicht, massstab: 4000 });
  assert.deepEqual(klein, gross);
});

test('Mindest- und Hoechstgroesse im Bildraum greifen', () => {
  const basis = { kante: 256, fov: 30, bildHoehe: 900 };
  const weit = SIG.signaturGroesse('sig_weiler', { ...basis, abstand: 40000 });
  assert.equal(weit.gedeckelt, 'min');
  assert.ok(Math.abs(weit.px - SIG.SIG_MIN_PX) < 1e-9);
  assert.ok(weit.marke > SIG.ZEICHEN.sig_weiler.anteil * 256,
    'die Mindestgroesse muss die Marke vergroessern');

  const nah = SIG.signaturGroesse('sig_grat', { ...basis, abstand: 6 });
  assert.equal(nah.gedeckelt, 'max');
  assert.ok(Math.abs(nah.px - SIG.SIG_MAX_PX) < 1e-9);
  assert.ok(nah.marke < SIG.ZEICHEN.sig_grat.anteil * 256,
    'die Hoechstgroesse muss die Marke verkleinern');
});

test('zwischen den Schranken gilt der Anteil unveraendert', () => {
  const name = 'sig_stadt', kante = 256, fov = 30, bildHoehe = 900;
  const roh = SIG.ZEICHEN[name].anteil * kante;
  // Abstand so waehlen, dass die Bildgroesse zwischen Mindest und Hoechst liegt
  const ziel = (SIG.SIG_MIN_PX + SIG.SIG_MAX_PX) * 0.5;
  const abstand = roh * bildHoehe / (ziel * 2 * Math.tan(fov * 0.5 * Math.PI / 180));
  const g = SIG.signaturGroesse(name, { kante, abstand, fov, bildHoehe });
  assert.equal(g.gedeckelt, '');
  assert.ok(Math.abs(g.marke - roh) < 1e-9, 'die Marke wurde ungefragt veraendert');
  assert.ok(Math.abs(g.quad * SIG.ATLAS_INHALT - g.marke) < 1e-9,
    'das Quad muss den Randabstand des Atlasfeldes ausgleichen');
});

test('ohne Kameraangaben bleibt die Bildschranke aus', () => {
  const g = SIG.signaturGroesse('sig_dorf', { kante: 256 });
  assert.equal(g.px, null);
  assert.equal(g.gedeckelt, '');
  assert.ok(Math.abs(g.marke - 0.006 * 256) < 1e-9);
});

test('die Schwebehoehe waechst mit der Karte', () => {
  assert.ok(SIG.schwebeHoehe(1024) > SIG.schwebeHoehe(256));
  assert.ok(SIG.schwebeHoehe(256) > 0);
  // ohne Angabe die laufende Karte
  assert.equal(SIG.schwebeHoehe(), SIG.SCHWEBE_ANTEIL * STORE.KARTE.map);
});


/* ==========================================================================
   6 — Zeichenwahl aus der Kennzahl
   ========================================================================== */

test('die Schwellen der Ortssignatur stimmen und sind an den Raendern eindeutig', () => {
  const m = 300;   // Regionsmassstab: dort sind alle Ortszeichen sichtbar
  const w = k => SIG.zeichenFuer('ort', k, m);
  assert.deepEqual(w(1), ['sig_weiler']);
  assert.deepEqual(w(8), ['sig_weiler'], '8 Baukoerper sind noch ein Weiler');
  assert.deepEqual(w(9), ['sig_dorf'], '9 Baukoerper sind schon ein Dorf');
  assert.deepEqual(w(40), ['sig_dorf'], 'genau 40 Baukoerper sind noch ein Dorf');
  assert.deepEqual(w(41), ['sig_stadt'], '41 Baukoerper sind schon eine Stadt');
  assert.deepEqual(w(150), ['sig_stadt']);
  assert.deepEqual(w(151), ['sig_stadt', 'sig_stadtmauer'],
    'ueber 150 kommt der Mauerkranz dazu, die Stadt bleibt');
});

test('ein Dorf wird EIN Zeichen, nicht dreissig', () => {
  // Der ganze Zweck des Zusammenzeichnens: 30 Haeuser ergeben eine
  // Dorfsignatur, nicht 30 Weilersignaturen.
  const gewaehlt = SIG.zeichenFuer('ort', 30, 300);
  assert.equal(gewaehlt.length, 1);
  assert.equal(gewaehlt[0], 'sig_dorf');
});

test('ein Element ohne Kennzahl faellt auf das kleinste Zeichen zurueck', () => {
  // Ein zu klein gezeichneter Ort ist ein Fehler zweiter Ordnung, eine
  // erfundene Stadt einer erster.
  for (const k of [undefined, null, NaN, 'viele']) {
    assert.deepEqual(SIG.zeichenFuer('ort', k, 300), ['sig_weiler']);
  }
});

test('der Mauerkranz blendet fuer sich aus, die Stadt bleibt', () => {
  const drueber = SIG.UEBERGABE.nah * SIG.BLENDE + 1;
  const gewaehlt = SIG.zeichenFuer('ort', 400, drueber);
  assert.deepEqual(gewaehlt, ['sig_stadt']);
});

test('die Zeichenwahl generalisiert statt zu verschwinden, wo ein Rueckfall steht', () => {
  const nah = SIG.UEBERGABE.detail * 0.9;          // Weinberg noch sichtbar
  const fern = SIG.UEBERGABE.detail * SIG.BLENDE + 10;   // Weinberg draussen
  assert.deepEqual(SIG.zeichenFuer('acker', 1, nah, { art: 'sig_weinberg' }),
    ['sig_weinberg']);
  assert.deepEqual(SIG.zeichenFuer('acker', 1, fern, { art: 'sig_weinberg' }),
    ['sig_acker'], 'ein Weinberg wird auf Regionsmassstab zu Ackerland');
});

test('die Waldwahl trennt Hain von Wald und richtet sich nach der Mischung', () => {
  const m = 300;
  assert.deepEqual(SIG.zeichenFuer('wald', 12, m), ['sig_hain']);
  assert.deepEqual(SIG.zeichenFuer('wald', 40, m), ['sig_hain'], 'Grenzfall 40');
  assert.deepEqual(SIG.zeichenFuer('wald', 41, m, { mischung: 0 }), ['sig_laubwald']);
  assert.deepEqual(SIG.zeichenFuer('wald', 400, m, { mischung: 1 }), ['sig_nadelwald']);
  assert.deepEqual(SIG.zeichenFuer('wald', 400, m, { mischung: 0.5 }), ['sig_mischwald']);
});

test('unterhalb des Uebergabepunkts liefert die Zeichenwahl nichts', () => {
  // Dort zeichnen die Koerper. Zwei Bildsprachen gleichzeitig waeren genau
  // das, was der Entwurf verhindern will.
  for (const sache of SIG.SACHEN_NAMEN) {
    assert.deepEqual(SIG.zeichenFuer(sache, 100, 2), [],
      sache + ' liefert auf Ortsmassstab ein Kartenzeichen');
  }
});

test('eine unbekannte Sache liefert eine leere Liste statt zu werfen', () => {
  assert.deepEqual(SIG.zeichenFuer('gibtsnicht', 5, 300), []);
  assert.equal(SIG.darstellungAn('gibtsnicht', 300), null);
});


/* ==========================================================================
   7 — Streuung ortsstabil
   ========================================================================== */

/** Rechteckige Testflaeche mit Verschiebung. */
function flaeche(dx, dz) {
  const x0 = -50 + dx, x1 = 50 + dx, z0 = -30 + dz, z1 = 30 + dz;
  return {
    x0, x1, z0, z1, sp: 9, seed: 20260727,
    ankerX: dx, ankerZ: dz,
    imInneren: (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1
  };
}

test('eine verschobene Flaeche nimmt ihre Marken mit, statt neu zu wuerfeln', () => {
  const sp = 9;
  const dx = 0.37 * sp, dz = -1.23 * sp;   // ausdruecklich KEIN Vielfaches
  const a = SIG.streuRaster(flaeche(0, 0));
  const b = SIG.streuRaster(flaeche(dx, dz));
  assert.ok(a.length > 40, 'zu wenige Marken fuer eine Aussage');
  assert.equal(a.length, b.length, 'die Zahl der Marken hat sich geaendert');
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].cx, b[i].cx, 'Zellenindex gewandert');
    assert.equal(a[i].cz, b[i].cz, 'Zellenindex gewandert');
    assert.ok(Math.abs((b[i].x - a[i].x) - dx) < 1e-9,
      'Marke ' + i + ' ist nicht mitgewandert (x)');
    assert.ok(Math.abs((b[i].z - a[i].z) - dz) < 1e-9,
      'Marke ' + i + ' ist nicht mitgewandert (z)');
    assert.equal(a[i].dreh, b[i].dreh, 'die Marke hat neu gewuerfelt');
    assert.equal(a[i].skala, b[i].skala, 'die Marke hat neu gewuerfelt');
  }
});

test('ohne Anker ist es das Weltraster von genWald', () => {
  // Gegenprobe zur vorigen Zusage: laesst man den Anker weg, bleiben die
  // Marken im Weltgitter stehen — was fuer Baeume richtig ist und fuer
  // Kartenzeichen falsch. Der Aufrufer entscheidet, nicht das Modul.
  const sp = 9, dx = 0.37 * sp, dz = -1.23 * sp;
  const grund = { x0: -50, x1: 50, z0: -30, z1: 30, sp, seed: 99 };
  const a = SIG.streuRaster(grund);
  const b = SIG.streuRaster({ ...grund, x0: -50 + dx, x1: 50 + dx,
    z0: -30 + dz, z1: 30 + dz });
  const nachZelle = new Map(b.map(p => [p.cx + '/' + p.cz, p]));
  let gemeinsam = 0;
  for (const p of a) {
    const q = nachZelle.get(p.cx + '/' + p.cz);
    if (!q) continue;
    gemeinsam++;
    assert.equal(p.x, q.x, 'Weltraster ist gewandert');
    assert.equal(p.z, q.z, 'Weltraster ist gewandert');
  }
  assert.ok(gemeinsam > 20, 'zu wenig Ueberlappung fuer eine Aussage');
});

test('die Streuung bleibt im Polygon und unter dem Deckel', () => {
  const f = flaeche(0, 0);
  const punkte = SIG.streuRaster(f);
  for (const p of punkte) {
    assert.ok(f.imInneren(p.x, p.z), 'Marke ausserhalb der Flaeche');
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), 'NaN in einer Marke');
  }
  const gedeckelt = SIG.streuRaster({ ...f, sp: 0.4, maxN: 25 });
  assert.ok(gedeckelt.length <= 25, 'der Deckel greift nicht');
});

test('der Streuabstand haengt an der Markengroesse', () => {
  const g = SIG.signaturGroesse('sig_laubwald', { kante: 256 });
  const sp = SIG.streuAbstand(g.marke);
  assert.ok(sp > g.marke, 'die Marken duerfen sich nicht ueberlappen');
  assert.ok(Math.abs(sp - g.marke * SIG.STREU_ABSTAND) < 1e-9);
});


/* ==========================================================================
   8 — Keine toten Zeichen
   ========================================================================== */

test('jedes Zeichen ist ueber eine Zuordnung erreichbar', () => {
  // Genau diese Pruefung hat in Runde I5 einen seit Monaten toten Pool
  // gefunden (`pechnase`). Sie ist hier billiger zu haben, weil die Zuordnung
  // Daten sind und nicht ueber 250 Generatorzeilen verstreut.
  const erreicht = new Set();
  const kennzahlen = [0, 1, 5, 8, 9, 30, 40, 41, 150, 151, 400, 4000];
  for (const sache of SIG.SACHEN_NAMEN) {
    const S1 = SIG.SACHEN[sache];
    if (!S1.waehle) continue;
    const arten = S1.zeichen.concat([undefined]);
    for (const art of arten) {
      for (const k of kennzahlen) {
        for (const m of LEITER) {
          for (const hs of [false, true]) {
            for (const mi of [0, 0.5, 1]) {
              for (const n of SIG.zeichenFuer(sache, k, m,
                { art, hauptstadt: hs, mischung: mi })) erreicht.add(n);
            }
          }
        }
      }
    }
  }
  const tot = SIG.ZEICHEN_NAMEN.filter(n => !erreicht.has(n));
  assert.deepEqual(tot, [], 'tote Zeichen (in keiner Zuordnung erreichbar)');
});

test('jedes Zeichen gehoert zu genau einer Sache', () => {
  const zaehler = new Map();
  for (const sache of SIG.SACHEN_NAMEN) {
    for (const n of SIG.SACHEN[sache].zeichen) {
      assert.ok(SIG.ZEICHEN[n], sache + ' nennt ein unbekanntes Zeichen: ' + n);
      zaehler.set(n, (zaehler.get(n) || 0) + 1);
    }
  }
  for (const n of SIG.ZEICHEN_NAMEN) {
    assert.equal(zaehler.get(n), 1, n + ' gehoert zu ' + (zaehler.get(n) || 0) + ' Sachen');
  }
});

test('jede Sache mit Zeichenstufe hat ein Leitzeichen, das ihre Stufe traegt', () => {
  for (const sache of SIG.SACHEN_NAMEN) {
    const S1 = SIG.SACHEN[sache];
    const zStufe = S1.kette.filter(s => s.art === 'zeichen');
    if (!zStufe.length) { assert.equal(S1.leit, null); continue; }
    assert.ok(S1.leit && SIG.ZEICHEN[S1.leit], sache + ': kein gueltiges Leitzeichen');
    for (const st of zStufe) {
      assert.ok(SIG.ZEICHEN[S1.leit].bis >= st.bis,
        sache + ': das Leitzeichen ' + S1.leit + ' endet vor seiner Stufe');
    }
  }
});


/* ==========================================================================
   9 — Farbe, Registrierung, Randfaelle
   ========================================================================== */

test('der Tint kommt aus der Biompalette und wechselt mit dem Biom', () => {
  const nadel = SIG.signaturTint('sig_nadelwald', 'wiese');
  const wueste = SIG.signaturTint('sig_nadelwald', 'wueste');
  for (const t of [nadel, wueste]) {
    assert.equal(t.length, 3);
    for (const c of t) {
      assert.ok(Number.isFinite(c) && c >= 0 && c <= 1, 'Tint ausserhalb [0,1]: ' + c);
    }
  }
  assert.notDeepEqual(nadel, wueste, 'die Waldsignatur muss das Biom tragen');
});

test('Tinte und Arborweiss stehen ausserhalb der Palette', () => {
  // Ein Ortsring darf nicht mit dem Untergrund mitwandern, sonst verliert die
  // Karte ihren Halt; Arbor gehoert keinem Biom.
  for (const biom of Object.keys(STORE.BIOME)) {
    assert.deepEqual(SIG.signaturTint('sig_dorf', biom), SIG.TINTE);
    assert.deepEqual(SIG.signaturTint('sig_ranke', biom), SIG.ARBOR_FARBE);
  }
  // Und nur Arbor liegt ueber der Bloom-Schwelle der Pipeline (0.9): auf
  // einer Kontinentkarte leuchtet genau eine Sache, und das ist Absicht.
  const hell = t => Math.max(t[0], t[1], t[2]);
  assert.ok(hell(SIG.ARBOR_FARBE) > 0.9, 'Arbor bliebe stumpf');
  for (const biom of Object.keys(STORE.BIOME)) {
    for (const name of SIG.ZEICHEN_NAMEN) {
      if (SIG.ZEICHEN[name].leuchtet) continue;
      assert.ok(hell(SIG.signaturTint(name, biom)) <= 0.9,
        name + ' in ' + biom + ' liegt ueber der Bloom-Schwelle');
    }
  }
});

test('ein unbekanntes Biom faellt auf die Wiese zurueck statt zu werfen', () => {
  const a = SIG.signaturTint('sig_laubwald', 'gibtsnicht');
  const b = SIG.signaturTint('sig_laubwald', 'wiese');
  assert.deepEqual(a, b);
});

test('nur die Arborzeichen leuchten', () => {
  for (const name of SIG.ZEICHEN_NAMEN) {
    const soll = SIG.ZEICHEN[name].gruppe === 'arbor';
    assert.equal(SIG.ZEICHEN[name].leuchtet, soll, name + ': falsches Eigenleuchten');
  }
});

test('die Poolregistrierung meldet jedes Zeichen genau einmal an', () => {
  const gesehen = [];
  const namen = SIG.registriereSignaturPools((name, geo, opts) => {
    gesehen.push({ name, geo, opts });
  }, { atlas: null });
  assert.equal(namen.length, SIG.ZEICHEN_NAMEN.length);
  assert.deepEqual(new Set(namen), new Set(SIG.ZEICHEN_NAMEN));
  for (const e of gesehen) {
    assert.ok(e.geo && e.geo.attributes.uv, e.name + ': Geometrie ohne UV');
    assert.equal(e.opts.karte, true, e.name + ': nicht als Kartenzeichen markiert');
    assert.equal(e.opts.familie, 'karte', e.name + ': falsche Materialfamilie');
    assert.equal(e.opts.flach, true, e.name + ': wuerde beleuchtet gezeichnet');
    assert.equal(e.opts.radius, 0, e.name + ': eine Signatur wirft keinen Schatten');
    assert.equal(e.opts.sichtbarAb, SIG.ZEICHEN[e.name].ab);
    assert.equal(e.opts.sichtbarBis, SIG.ZEICHEN[e.name].bis);
  }
});

test('ohne definePool passiert nichts, statt dass es kracht', () => {
  assert.deepEqual(SIG.registriereSignaturPools(null), []);
  assert.deepEqual(SIG.registriereSignaturPools(undefined), []);
});

test('die Massstabsleiter ist lueckenlos und ordnet jeden Massstab ein', () => {
  const L = SIG.MASSSTABSLEITER;
  assert.equal(L[0].von, SIG.MASSSTAB_MIN);
  assert.equal(L[L.length - 1].bis, SIG.MASSSTAB_MAX);
  for (let i = 1; i < L.length; i++) assert.equal(L[i].von, L[i - 1].bis);
  for (const m of LEITER) {
    assert.ok(SIG.stufeFuer(m), 'kein Stufenname fuer m=' + m);
  }
  assert.equal(SIG.stufeFuer(NaN), null);
  assert.equal(SIG.stufeFuer(1), 'ort');
  assert.equal(SIG.stufeFuer(25), 'landschaft');
  assert.equal(SIG.stufeFuer(250), 'region');
  assert.equal(SIG.stufeFuer(2000), 'kontinent');
});

test('die Platzierung liefert vollstaendige, endliche Instanzwerte', () => {
  for (const name of SIG.ZEICHEN_NAMEN) {
    const p = SIG.signaturPlatzierung(name, {
      massstab: 300, kante: 512, abstand: 900, fov: 30, bildHoehe: 900,
      biom: 'wiese', dreh: 0.3, skala: 1.1
    });
    if (!p) continue;                       // bei 300 nicht jedes Zeichen sichtbar
    for (const k of ['sx', 'sy', 'sz', 'yaw', 'faktor', 'marke', 'schwebe']) {
      assert.ok(Number.isFinite(p[k]), name + ': ' + k + ' ist nicht endlich');
    }
    assert.ok(p.sx > 0 && p.sz > 0, name + ': Quad ohne Ausdehnung');
    assert.equal(p.sx, p.sz, name + ': Kartenzeichen sind quadratisch');
    for (const c of p.tint) assert.ok(Number.isFinite(c), name + ': NaN im Tint');
  }
});
