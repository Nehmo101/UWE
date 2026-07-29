/* ==========================================================================
   Ebene 5 — Registry-Konsistenz

   Billig zu schreiben, faengt aber die Fehlerklasse, die sonst erst beim
   Klicken auffaellt: ein Biom, das einen Pool nennt, den es nicht gibt; ein
   Partikeltyp mit Tippfehler; ein Hoehenprofil-Schluessel, den hoehenProfil()
   still ueberliest; ein Pool, den niemand mehr benutzt und der trotzdem
   Speicher, Material und Shaderprogramm kostet.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ladeTerra, SRC, TERRA } from './hilfen/laden.mjs';
import { testWelt } from './hilfen/karte.mjs';

const welt = await testWelt({ seed: 4711 });
const { BIOME, HOEHEN_STANDARD } = welt.m.store;
const LUFTWERKZEUGE = await ladeTerra('editor/luftwerkzeuge.js');
LUFTWERKZEUGE.registriereLuftbiom(BIOME);
const POOLS = welt.m.pools.POOLS;
const OBJEKTE = welt.m.objects;
const ARCHITEKTUR = await ladeTerra('assets/architektur-katalog.js');
const ARCHITEKTUR_NAMEN = ARCHITEKTUR.ARCHITEKTUR_ASSET_NAMEN;
const ARCHITEKTUR_SET = new Set(ARCHITEKTUR_NAMEN);
const FLOTTE = await ladeTerra('assets/steampunk-luftflotte.js');
const INSELN = await ladeTerra('assets/luftinsel-assets.js');
const BAMBUS = await ladeTerra('assets/hochbambus-assets.js');
const NEUE_LUFT_ASSET_NAMEN = FLOTTE.STEAMPUNK_LUFTFLOTTEN_NAMEN.concat(
  Object.values(INSELN.LUFTINSEL_POOL_IDS), Object.values(BAMBUS.HOCHBAMBUS_POOL_IDS));
const DYNAMISCHE_POOL_SET = new Set(ARCHITEKTUR_NAMEN.concat(NEUE_LUFT_ASSET_NAMEN));

function quelltext(rel) { return fs.readFileSync(path.join(SRC, rel), 'utf8'); }

/* Alle Quelldateien, in denen ein Poolname sinnvoll vorkommen kann. Bewusst
   ALLE Module unter src/ — so zaehlt auch ein Pool als benutzt, den nur die
   Werkzeugliste (editor/tools.js, Einzelstueck-Auswahl) anbietet. */
const ALLE_QUELLEN = (() => {
  const out = [];
  const lauf = (ordner) => {
    for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
      const p = path.join(ordner, e.name);
      if (e.isDirectory()) lauf(p);
      else if (e.name.endsWith('.js')) out.push(fs.readFileSync(p, 'utf8'));
    }
  };
  lauf(SRC);
  return out.join('\n');
})();

test('Ebene 5 — jedes Biom nennt existierende Pools', () => {
  const fehlt = [];
  for (const name of Object.keys(BIOME)) {
    const veg = BIOME[name].veg;
    if (!veg) { fehlt.push(name + ': kein veg-Block'); continue; }
    for (const art of Object.keys(veg.arten || {})) {
      if (!POOLS[art]) fehlt.push(name + '.veg.arten -> ' + art);
    }
    if (veg.ersatz && !POOLS[veg.ersatz]) fehlt.push(name + '.veg.ersatz -> ' + veg.ersatz);
    for (const eintrag of (veg.uwTabelle || [])) {
      if (!POOLS[eintrag[0]]) fehlt.push(name + '.veg.uwTabelle -> ' + eintrag[0]);
    }
  }
  assert.deepEqual(fehlt, []);
});

test('Ebene 5 — jeder Biom-Partikeltyp existiert in vfx.js', async () => {
  const vfx = await ladeTerra('world/vfx.js');
  const fehlt = [];
  for (const name of Object.keys(BIOME)) {
    const v = BIOME[name].vfx;
    if (!v) continue;
    const typ = typeof v === 'string' ? v : v.typ;
    if (!vfx.VFX_TYPEN[typ]) fehlt.push(name + '.vfx -> ' + typ);
    if (typeof v === 'object' && v.dichte !== undefined) {
      assert.ok(Number.isFinite(v.dichte) && v.dichte >= 0 && v.dichte <= 1,
        name + '.vfx.dichte liegt nicht in 0..1: ' + v.dichte);
    }
  }
  assert.deepEqual(fehlt, []);
});

test('Ebene 5 — jede Palettenrampe ist vollstaendig und ohne undefinierte Farben', () => {
  const FARBEN = ['grasKuehl', 'grasWarm', 'grasTrocken', 'erde', 'fels', 'schnee', 'sand',
    'seegrund', 'tiefe', 'tritt', 'brandung', 'driftGelb', 'driftBlau'];
  const SCHWELLEN = ['sandA', 'sandB', 'saumSand', 'felsA', 'felsB', 'saumFels',
    'schneeA', 'schneeB', 'saumSchnee'];
  const luecken = [];
  for (const name of Object.keys(BIOME)) {
    const t = BIOME[name].terrain;
    if (!t) { luecken.push(name + ': kein terrain-Block'); continue; }
    for (const k of FARBEN) {
      const f = t[k];
      if (!f || typeof f.r !== 'number') { luecken.push(name + '.' + k + ' ist keine Farbe'); continue; }
      if (!Number.isFinite(f.r) || !Number.isFinite(f.g) || !Number.isFinite(f.b)) {
        luecken.push(name + '.' + k + ' enthaelt NaN');
      }
    }
    for (const k of SCHWELLEN) {
      if (!Number.isFinite(t[k])) luecken.push(name + '.' + k + ' ist keine Zahl');
    }
    /* Die Kantenpaare duerfen nicht zusammenfallen: sstep teilt durch
       (e1 - e0). Die REIHENFOLGE wird bewusst nicht geprueft — sstep darf
       fallende Kanten haben, und der Bestand nutzt das: `sand` laeuft von
       2.0 auf 1.0 abwaerts, und in `schnee`/`eis` liegt die Schneekante
       absichtlich UNTER der Felskante (Schnee bis ins Tal, Fels bricht ueber
       den Steilhangzweig durch). */
    for (const [a, b] of [['sandA', 'sandB'], ['felsA', 'felsB'], ['schneeA', 'schneeB']]) {
      if (t[a] === t[b]) luecken.push(name + ': ' + a + ' und ' + b + ' sind gleich (sstep teilt durch 0)');
    }
    if (t.oase > 0 && (!t.oaseFarbe || typeof t.oaseFarbe.r !== 'number')) {
      luecken.push(name + ': oase > 0, aber keine oaseFarbe');
    }
    if (!BIOME[name].label) luecken.push(name + ': kein label');
  }
  assert.deepEqual(luecken, []);
});

test('Ebene 5 — Hoehenprofile nennen nur bekannte Schluessel', () => {
  /* hoehenProfil() uebernimmt aus BIOME[x].hoehe NUR Schluessel, die es in
     HOEHEN_STANDARD gibt. Ein Tippfehler wuerde also stillschweigend
     wirkungslos bleiben — genau deshalb wird er hier gesucht. */
  const unbekannt = [], falscherTyp = [];
  for (const name of Object.keys(BIOME)) {
    const h = BIOME[name].hoehe;
    if (!h) continue;
    for (const k of Object.keys(h)) {
      if (!(k in HOEHEN_STANDARD)) unbekannt.push(name + '.hoehe.' + k);
      else if (!Number.isFinite(h[k])) falscherTyp.push(name + '.hoehe.' + k);
    }
  }
  assert.deepEqual(unbekannt, [], 'Diese Schluessel liest hoehenProfil() nie');
  assert.deepEqual(falscherTyp, [], 'Nicht-Zahlen werden von hoehenProfil() verworfen');
});

test('Ebene 5 — Biom-Registry und Auswahlliste in index.html stimmen ueberein', () => {
  const html = fs.readFileSync(path.join(TERRA, 'index.html'), 'utf8');
  const anfang = html.indexOf('id="biomSel"');
  assert.ok(anfang > 0, 'In index.html gibt es kein Auswahlfeld biomSel');
  const block = html.slice(anfang, html.indexOf('</select>', anfang));
  const imHtml = [...block.matchAll(/value="([a-zA-Z0-9_]+)"/g)].map((m) => m[1]);
  const inRegistry = Object.keys(BIOME);
  assert.deepEqual(imHtml.filter((b) => !BIOME[b]), [],
    'index.html bietet Biome an, die es in der Registry nicht gibt');
  assert.deepEqual(inRegistry.filter((b) => !imHtml.includes(b)), [],
    'Diese Biome sind nur ueber eine Kartendatei erreichbar, nicht ueber die Leiste');
  assert.equal(imHtml.length, inRegistry.length);
});

test('Ebene 5 — keine doppelten Poolnamen', async () => {
  /* definePool ueberschreibt einen bereits vergebenen Namen kommentarlos —
     der zuerst gebaute Pool waere dann unsichtbar, sein Speicher belegt.

     Seit I1 kommen die Pools aus ZWEI Quellen: die Koerper stehen als
     literale definePool-Zeilen in geometry.js, die 49 Kartenzeichen
     registriert `registriereSignaturPools` aus render/signaturen.js zur
     Laufzeit. Ein Abgleich gegen die Literale allein wuerde deshalb dauerhaft
     scheitern — geprueft wird jetzt die SUMME beider Quellen gegen die
     Registry, und das haelt die Zusage unveraendert: passt die Summe nicht,
     hat einer den anderen ueberschrieben. */
  const literal = [...quelltext('generators/geometry.js')
    .matchAll(/definePool\(\s*["']([a-zA-Z0-9_]+)["']/g)].map((m) => m[1]);
  const sig = await ladeTerra('render/signaturen.js');
  const zeichen = sig.ZEICHEN_NAMEN.map((n) => 'sig_' + n.replace(/^sig_/, ''));
  const namen = literal.concat(zeichen, ARCHITEKTUR_NAMEN, NEUE_LUFT_ASSET_NAMEN);
  const doppelt = namen.filter((n, i) => namen.indexOf(n) !== i);
  assert.deepEqual([...new Set(doppelt)], [],
    'Dieser Name wird zweimal vergeben — der zuerst gebaute Pool waere unsichtbar');
  assert.equal(namen.length, Object.keys(POOLS).length,
    'Koerper (' + literal.length + ') + Kartenzeichen (' + zeichen.length
    + ') + Architektur (' + ARCHITEKTUR_NAMEN.length + ') decken sich '
    + 'nicht mit der Registry (' + Object.keys(POOLS).length + ') — ein Name wurde ueberschrieben');
});

test('Ebene 5 - neue dynamische Assetkataloge sind vollstaendig registriert', () => {
  assert.equal(NEUE_LUFT_ASSET_NAMEN.length, 17);
  assert.deepEqual(NEUE_LUFT_ASSET_NAMEN.filter((name) => !POOLS[name]), [],
    'Diese Luftwelt-Assets fehlen in der Pool-Registry');
});

test('Ebene 5 - der dynamische Architekturkatalog ist vollstaendig registriert', () => {
  assert.equal(ARCHITEKTUR_NAMEN.length, 216);
  assert.deepEqual(ARCHITEKTUR_NAMEN.filter((name) => !POOLS[name]), [],
    'Diese Architektur-Assets fehlen in der Pool-Registry');
  assert.deepEqual(Object.keys(POOLS)
    .filter((name) => name.startsWith('arch_') && !ARCHITEKTUR_SET.has(name)), [],
    'Diese arch_-Pools gehoeren nicht zum stabilen Architektur-Katalog');
});

test('Ebene 5 — POOL_NAMES deckt sich mit POOLS', () => {
  const { POOL_NAMES } = welt.m.pools;
  assert.deepEqual([...POOL_NAMES].sort(), Object.keys(POOLS).sort(),
    'setPoolNames() wurde nach dem letzten definePool nicht mehr aufgerufen');
});

test('Ebene 5 — jeder Pool hat Material, Radius und Geometrie', () => {
  const kaputt = [];
  for (const name of Object.keys(POOLS)) {
    const p = POOLS[name];
    if (!p.geo || !p.geo.attributes.position) kaputt.push(name + ': keine Geometrie');
    if (!p.mat) kaputt.push(name + ': kein Material');
    if (!Number.isFinite(p.radius)) kaputt.push(name + ': radius ist ' + p.radius);
  }
  assert.deepEqual(kaputt, []);
});

test('Ebene 5 — jede in geometry.js genannte Materialfamilie existiert', async () => {
  const materials = await ladeTerra('render/materials.js');
  const benutzt = [...new Set([
    ...[...quelltext('generators/geometry.js')
      .matchAll(/familie:\s*['"]([a-zA-Z]+)['"]/g)].map((m) => m[1]),
    ...ARCHITEKTUR.ARCHITEKTUR_STILE.map((stil) => stil.familie)
  ])];
  assert.ok(benutzt.length > 5, 'Die Suche nach Familien hat kaum etwas gefunden');
  assert.deepEqual(benutzt.filter((f) => !materials.FAMILIEN[f]), [],
    'Diese Familien kennt render/materials.js nicht — die Malschicht bliebe aus');
});

/* --- Erreichbarkeit der Pools -------------------------------------------
   „Erreichbar" heisst: der Name kommt in irgendeiner Quelldatei unter src/
   noch einmal vor — als Eintrag in OBJGRUPPEN oder KULTUR, als direkter
   emit()-Aufruf eines Generators oder als Einzelstueck in der Werkzeugliste.
   Kommt er nur in seiner eigenen definePool-Zeile vor, kann ihn niemand
   erzeugen: tote Geometrie samt Material und Shaderprogramm. ------------- */
function unerreichbarePools() {
  const out = [];
  for (const name of Object.keys(POOLS)) {
    const alle = (ALLE_QUELLEN.match(new RegExp('["\']' + name + '["\']', 'g')) || []).length;
    const definitionen = (ALLE_QUELLEN.match(
      new RegExp('definePool\\(\\s*["\']' + name + '["\']', 'g')) || []).length;
    /* Dynamische Architektur-IDs stehen nie vollstaendig im Quelltext; ihre
       echte Registrierung prueft der gesonderte Katalogtest oben. */
    if (DYNAMISCHE_POOL_SET.has(name)) continue;

    if (alle - definitionen <= 0) out.push(name);
  }
  return out;
}

/* Der eine Fund dieser Pruefung (Runde I5) war `pechnase`: definiert, aber von
   keinem Generator, keiner Gruppe und keiner Werkzeugliste genannt. Der Pool
   haengt seither als Reihe an der Aussenseite des Torriegels jeder Steinburg
   (genBurg in generators/strukturen.js). Damit ist die Liste leer, und die
   Pruefung steht ohne Ausnahme — jeder neue tote Pool faellt sofort auf. */
test('Ebene 5 — jeder Pool ist erreichbar', () => {
  assert.deepEqual(unerreichbarePools(), [],
    'Tote Pools — entweder anbinden oder loeschen');
});

test('Ebene 5 — jede Objektgruppe ist gewichtet und nicht leer', () => {
  const kaputt = [];
  for (const gruppe of Object.keys(OBJEKTE.OBJGRUPPEN)) {
    const tabelle = OBJEKTE.OBJGRUPPEN[gruppe];
    if (!Array.isArray(tabelle) || !tabelle.length) { kaputt.push(gruppe + ': leer'); continue; }
    for (const [name, gewicht] of tabelle) {
      if (typeof name !== 'string') kaputt.push(gruppe + ': Eintrag ohne Namen');
      if (!Number.isFinite(gewicht) || gewicht <= 0) kaputt.push(gruppe + '/' + name + ': Gewicht ' + gewicht);
    }
  }
  assert.deepEqual(kaputt, []);
});

/* Der Abgleich „Schemaschluessel in editor/tools.js <-> von einem Generator
   gelesener Parameter" fehlt hier bewusst: tools.js wird in dieser Runde
   parallel weiterentwickelt, und ein Test, der seinen Inhalt festschreibt,
   wuerde diese Arbeit blockieren statt sie zu sichern. Die Testelemente
   tragen ihre Parameter aus eigener Quelle (hilfen/karte.mjs), damit kein
   anderes Ergebnis an tools.js haengt. Nachzuholen, sobald die Datei wieder
   ruhig ist — siehe Bericht Runde I5. */
test('Ebene 5 — Schemaschluessel gegen Generatorparameter',
  { skip: 'editor/tools.js wird parallel bearbeitet (Runde I)' }, () => {});
