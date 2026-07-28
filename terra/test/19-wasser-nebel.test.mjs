/* ==========================================================================
   Ebene 6 — Wasser und Nebel (Nachtrag Runde H)

   Zwei Bildmaengel aus den letzten Runden, beide hier festgehalten:

     1. Die Seeflaeche stand voellig still. Jetzt meldet generators/see.js
        seine Flaechen ueber ein exportiertes Buendel (`seeWogen`) an, und
        world/water.js — der Besitzer der Wogenformel — patcht die
        Modulmaterialien beim Modulstart. Geprueft wird hier die ANMELDUNG
        (ohne See keine Kosten, mit See deterministisch, nach dem Loeschen
        abgemeldet) und die IMPORTRICHTUNG: water.js -> see.js, niemals
        umgekehrt.

     2. Der Hoehennebel machte die Kontinentkarte milchig. world/atmosphere.js
        gibt die Karte jetzt oberhalb von 600 m je Zelle frei (dieselbe
        Schwelle wie RELIEF_AB/RUHE_AB in terrain.js). Geprueft wird die
        Bitgleichheit unterhalb der Schwelle fuer JEDES Tageszeit-Preset und
        die monotone Daempfung darueber.

   ---------------------------------------------------------------------------
   EINE EIGENHEIT DES AUFBAUS: haken.mjs tauscht world/atmosphere.js und
   world/water.js gegen Ersatzmodule — zu Recht, beide sind Rendering und
   haengen an pipeline/camera. Die Nebelfreigabe lebt aber IM ECHTEN
   atmosphere.js, und eine Pruefung gegen den Ersatz pruefte nichts. Deshalb
   registriert diese Datei einen ZWEITEN Loader-Haken (data:-URL, kein
   Eingriff in hilfen/): er loest ausschliesslich den Spezialbezeichner
   `terra-echt/...` auf die echte Datei auf. Deren EIGENE Importe laufen
   weiter durch die normale Kette — three-Ersatz, pipeline-Ersatz,
   camera-Ersatz, water-Ersatz. Es wird also genau EIN Modul echt geladen,
   und zwar das, dessen Verhalten diese Datei prueft.

   Und wie ueberall seit den zwei Fehlschlaegen: Testwelten entstehen IM Test,
   nie beim Import der Datei.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { testWelt, hashElement } from './hilfen/karte.mjs';
import { ladeTerra, ladeGeneratoren, SRC } from './hilfen/laden.mjs';

/* Zweiter Haken NACH dem von laden.mjs registriert — er laeuft damit ZUERST
   und kann `terra-echt/...` kurzschliessen, bevor der Ersatz-Tausch greift. */
const HOOK =
  'let wurzel = "";\n' +
  'export function initialize(d) { wurzel = d; }\n' +
  'export function resolve(spec, ctx, next) {\n' +
  '  if (spec.startsWith("terra-echt/")) {\n' +
  '    return { url: wurzel + spec.slice("terra-echt/".length),' +
  ' format: "module", shortCircuit: true };\n' +
  '  }\n' +
  '  return next(spec, ctx);\n' +
  '}\n';
register('data:text/javascript,' + encodeURIComponent(HOOK),
  { data: pathToFileURL(path.join(SRC, 'x')).href.slice(0, -1) });

await ladeGeneratoren();
const { terraUniforms } = await ladeTerra('render/materials.js');
const { S } = await ladeTerra('core/store.js');
const THREE = await import('three');
const atm = await import('terra-echt/world/atmosphere.js');

/* --------------------------------------------------------------------------
   Aufbau fuer die Nebelpruefungen
   -------------------------------------------------------------------------- */

/** Frisch verdrahtete Szene mit Nebel; initAtmosphere haengt sun/hemi/... in
 *  eine Attrappe, gelesen werden nur fog.near/far und uFogCap. */
function nebelSzene() {
  const szene = { add() {}, fog: { color: new THREE.Color(0), near: 1, far: 2 } };
  atm.initAtmosphere(szene);
  return szene;
}

/** Preset bei Maßstab m anwenden und die drei Nebelwerte liefern. Der Umweg
 *  ueber mittag haelt die Blendquelle (schnappschuss) fuer jede Messung
 *  identisch — nur so sind Werte ueber verschiedene m vergleichbar. */
function nebelWerte(szene, preset, m) {
  S.einheitMeter = m;
  atm.setTod('mittag', true);
  atm.setTod(preset, true);
  return { near: szene.fog.near, far: szene.fog.far, cap: terraUniforms.uFogCap.value };
}

const PRESET_NAMEN = Object.keys(atm.PRESETS);

/* --------------------------------------------------------------------------
   1 — die Schwelle selbst
   -------------------------------------------------------------------------- */

test('19 — nebelDaempfung: exakt 0 unterhalb, exakt 1 oberhalb, monoton', () => {
  // Exakt 0, nicht „klein": daran haengt der Bitgleichheits-Beweis — der
  // Block in applyTod steht hinter `if (d > 0)` und wird nie betreten.
  for (const m of [1, 60, 250, 599.9999, atm.NEBEL_KARTE_AB]) {
    assert.ok(Object.is(atm.nebelDaempfung(m), 0), 'nicht exakt 0 bei m=' + m);
  }
  assert.ok(Object.is(atm.nebelDaempfung(NaN), 0), 'NaN muss auf 0 fallen');
  for (const m of [atm.NEBEL_KARTE_VOLL, 2000, 4000]) {
    assert.ok(Object.is(atm.nebelDaempfung(m), 1), 'nicht exakt 1 bei m=' + m);
  }
  // Streng monoton auf der Rampe — beim Zoomen darf nichts springen.
  const stufen = [610, 660, 720, 780, 840, 900, 950];
  for (let i = 1; i < stufen.length; i++) {
    assert.ok(atm.nebelDaempfung(stufen[i]) > atm.nebelDaempfung(stufen[i - 1]),
      'Rampe nicht streng monoton bei m=' + stufen[i]);
  }
  // Die Schwelle passt zur Maßstabsleiter: 600 ist `ab` der Stufe
  // „kontinent" (world/kartenbaum.js) — dieselbe Zahl wie RELIEF_AB.
  const kb = fs.readFileSync(path.join(SRC, 'world', 'kartenbaum.js'), 'utf8');
  assert.match(kb, /kontinent[^}]*ab:\s*600\b/s,
    'MASSSTAB_LEITER: Stufe kontinent beginnt nicht mehr bei 600 — ' +
    'NEBEL_KARTE_AB in atmosphere.js (und RELIEF_AB in terrain.js) nachziehen');
  assert.equal(atm.NEBEL_KARTE_AB, 600);
});

/* --------------------------------------------------------------------------
   2 — unterhalb der Schwelle bitgleich, fuer jedes Preset
   -------------------------------------------------------------------------- */

test('19 — Nebel unterhalb der Schwelle bitgleich zum Bestand, jedes Preset', () => {
  const szene = nebelSzene();
  S.biom = 'wiese';
  atm.setWetter('klar', true);
  for (const name of PRESET_NAMEN) {
    const basis = nebelWerte(szene, name, 1);
    // Der Bestand: exakt die Preset-Zahlen (klar-Wetter traegt Faktoren, die
    // exakt 1.0 sind; wiese hat keinen luft-Nebelblock).
    const p = atm.PRESETS[name];
    assert.ok(Object.is(basis.near, p.fogNah), name + ': fogNah veraendert');
    assert.ok(Object.is(basis.far, p.fogFern), name + ': fogFern veraendert');
    assert.ok(Object.is(basis.cap, p.fogCap), name + ': fogCap veraendert');
    // Und bit fuer bit dieselben Werte bis einschliesslich der Schwelle.
    for (const m of [60, 250, 599.9999, atm.NEBEL_KARTE_AB]) {
      const w = nebelWerte(szene, name, m);
      assert.ok(Object.is(w.near, basis.near), name + '/' + m + ': near weicht ab');
      assert.ok(Object.is(w.far, basis.far), name + '/' + m + ': far weicht ab');
      assert.ok(Object.is(w.cap, basis.cap), name + '/' + m + ': cap weicht ab');
    }
  }
  S.einheitMeter = 1;
});

/* --------------------------------------------------------------------------
   3 — oberhalb messbar gedaempft, monoton mit dem Maßstab
   -------------------------------------------------------------------------- */

test('19 — Nebel oberhalb der Schwelle gedaempft und monoton, jedes Preset', () => {
  const szene = nebelSzene();
  S.biom = 'wiese';
  atm.setWetter('klar', true);
  for (const name of PRESET_NAMEN) {
    const basis = nebelWerte(szene, name, 1);
    let vorher = basis;
    for (const m of [640, 720, 800, 880, 950]) {
      const w = nebelWerte(szene, name, m);
      assert.ok(w.cap < vorher.cap, name + '/' + m + ': Deckel faellt nicht');
      assert.ok(w.near > vorher.near && w.far > vorher.far,
        name + '/' + m + ': Distanzen ruecken nicht hinaus');
      vorher = w;
    }
    // Volle Freigabe: der Deckel ist EXAKT 0 (cap * (1 - 1)), die Distanzen
    // liegen hinter jeder Sichtweite. Der Standardnebel rechnet
    // smoothstep(near, far, d) — fuer alles Naeher als near exakt 0.
    for (const m of [atm.NEBEL_KARTE_VOLL, 2000, 4000]) {
      const w = nebelWerte(szene, name, m);
      assert.ok(Object.is(w.cap, 0), name + '/' + m + ': Deckel nicht exakt 0');
      assert.ok(w.near > 10000 && w.far > w.near, name + '/' + m + ': Distanzen zu nah');
      // „die halbe Karte im Dunst": der lineare Nebelfaktor in 800 Einheiten
      // Sehweite war vorher deutlich messbar und ist jetzt exakt 0.
      const faktorVorher = Math.min(1, Math.max(0, (800 - basis.near) / (basis.far - basis.near)));
      assert.ok(faktorVorher > 0.4, name + ': Kontrollwert — vorher war Dunst da');
      assert.ok(800 < w.near, name + '/' + m + ': 800 Einheiten liegen nicht mehr vor near');
    }
  }
  // Die Freigabe hat auch gegen das Wetter das letzte Wort: Regen verkuerzt
  // die Sicht einer Ortskarte, vernebelt aber keine Kontinentkarte.
  atm.setWetter('regen', true);
  const w = nebelWerte(szene, 'mittag', 2000);
  assert.ok(Object.is(w.cap, 0) && w.near > 10000, 'Regen unterlaeuft die Freigabe');
  atm.setWetter('klar', true);
  S.einheitMeter = 1;
});

/* --------------------------------------------------------------------------
   4 — die Seeflaechen-Anmeldung
   -------------------------------------------------------------------------- */

/* Polygon auf der Landmasse von Seed 4711 (siehe BEISPIEL_SEED in karte.mjs). */
const SEE_PUNKTE = [{ x: -40, z: -40 }, { x: 20, z: -50 }, { x: 45, z: 10 },
  { x: 0, z: 45 }, { x: -45, z: 15 }];

test('19 — Anmeldung: ohne See keine Kosten, mit See deterministisch, nach Loeschen frei', async () => {
  const w = await testWelt({ seed: 4711, biom: 'wiese' });
  const see = await ladeTerra('generators/see.js');
  see.seeWogen.aktive.clear();               // Frische wie beim Terrain: kein Rest anderer Pruefungen

  /* Ohne See laeuft nichts: kein Mesh in der Liste — und damit existiert kein
     Traeger fuer den onBeforeRender-Aufruf, der die Uhr stellt. Der Zaehler
     haelt genau das fest. */
  const schreiber0 = see.seeWogen.zeitSchreiber;
  const wald = w.element('flaeche', 'wald', SEE_PUNKTE, null, 0x2001);
  w.erzeuge(wald);
  assert.equal(see.seeWogen.aktive.size, 0, 'ein Wald darf sich nicht anmelden');
  assert.equal(see.seeWogen.zeitSchreiber, schreiber0, 'die Uhr lief ohne See');

  /* Mit See: genau zwei Meshes (Wasserflaeche renderOrder 5, Saumband 6),
     beide in der Elementgruppe, beide mit der Uhr verdrahtet. */
  const el = w.element('flaeche', 'see', SEE_PUNKTE, { saum: 5, dichte: 1 }, 0x51ee7);
  w.erzeuge(el);
  assert.equal(see.seeWogen.aktive.size, 2, 'Wasserflaeche und Saumband melden sich an');
  const angemeldet = [...see.seeWogen.aktive];
  assert.deepEqual(angemeldet.map((m) => m.renderOrder), [5, 6],
    'Anmeldereihenfolge ist die Zeichenreihenfolge');
  for (const m of angemeldet) {
    assert.equal(m.parent, el.group, 'angemeldetes Mesh haengt nicht in der Elementgruppe');
    assert.equal(typeof m.onBeforeRender, 'function');
  }
  const h1 = hashElement(el);

  // Die Uhr: EIN Aufruf schreibt uSeeZeit und zaehlt genau einmal.
  angemeldet[0].onBeforeRender();
  assert.equal(see.seeWogen.zeitSchreiber, schreiber0 + 1);
  assert.ok(see.seeWogen.uniforms.uSeeZeit.value > 0, 'uSeeZeit wurde nicht gestellt');

  /* Regenerieren (der Undo/Redo-Weg laeuft ueber clearElement + genElement):
     die Liste waechst NICHT — die ausgehaengten Meshes fliegen bei der
     naechsten Anmeldung heraus — und das Ergebnis ist dasselbe, Hash fuer
     Hash. Bewegung ist Shadersache; die GEOMETRIE bleibt deterministisch. */
  w.erzeuge(el);
  assert.equal(see.seeWogen.aktive.size, 2, 'Regenerieren laesst die Liste wachsen (Leck)');
  assert.equal(hashElement(el), h1, 'Regenerieren aendert die Geometrie');

  /* Loeschen: dropElement haengt die Kinder aus; seeWogenAufraeumen — genau
     der Aufruf, den updateWater (water.js) je Bild hinter einem
     Groessen-Vergleich macht — raeumt die Huellen aus. Kein Leck: Elemente
     kommen und gehen mit Undo. */
  w.m.store.dropElement(el);
  assert.equal(see.seeWogenAufraeumen(), 0, 'nach dem Loeschen bleibt etwas angemeldet');
  assert.equal(see.seeWogen.aktive.size, 0);

  // Und einmal die ganze Schleife: anlegen, loeschen, anlegen — stabil bei 2.
  const el2 = w.element('flaeche', 'see', SEE_PUNKTE, { saum: 5, dichte: 1 }, 0x51ee7);
  w.erzeuge(el2);
  assert.equal(see.seeWogen.aktive.size, 2);
  assert.equal(hashElement(el2), h1, 'derselbe See nach Undo-Zyklus ist ein anderer');
  w.leeren();
  assert.equal(see.seeWogenAufraeumen(), 0);
});

test('19 — die Daempfungs-Uniforms stehen auf dem gedaempften Maß', async () => {
  const see = await ladeTerra('generators/see.js');
  // Der Anspruch ist nicht „wie das Meer": ein Bergsee wogt weniger als eine
  // Kueste. Meer: volle Woge (Betrag bis 0.78) und Streifen 0.30.
  assert.ok(see.seeWogen.uniforms.uSeeWoge.value > 0
    && see.seeWogen.uniforms.uSeeWoge.value <= 0.5,
    'uSeeWoge soll daempfen, nicht abschalten und nicht meerhoch wogen');
  assert.ok(see.seeWogen.uniforms.uSeeStreif.value > 0
    && see.seeWogen.uniforms.uSeeStreif.value < 0.30,
    'uSeeStreif soll unter der Meeresstaerke (0.30) liegen');
});

/* --------------------------------------------------------------------------
   5 — die Importrichtung
   -------------------------------------------------------------------------- */

/** Alle relativen Importziele einer Quelldatei, aufgeloest auf Pfade
 *  relativ zu src/ (mit /-Trennern). */
function importeVon(rel) {
  const quelle = fs.readFileSync(path.join(SRC, rel), 'utf8');
  const aus = [];
  for (const m of quelle.matchAll(/import\s[^;]*?from\s*['"]([^'"]+)['"]/g)) {
    if (!m[1].startsWith('.')) continue;     // three usw.
    const ziel = path.relative(SRC, path.resolve(path.join(SRC, rel), '..', m[1]));
    aus.push(ziel.split(path.sep).join('/'));
  }
  return aus;
}

test('19 — Richtung: water.js importiert see.js, niemals umgekehrt', () => {
  /* Die gewaehlte Richtung (wie bruchMaskeUniforms): world/water.js holt sich
     das Anmeldebuendel beim Generator ab. */
  assert.ok(importeVon('world/water.js').includes('generators/see.js'),
    'water.js holt das Anmeldebuendel nicht mehr aus see.js');

  /* Die NICHT gewaehlte Richtung als Testaussage: see.js darf water.js nicht
     importieren — nicht direkt und nicht ueber Zwischenmodule. Ein solcher
     Import drehte die Modulreihenfolge von main.js um und schloesse ueber
     water.js -> paths.js einen Kreis. Geprueft per Grapherreichbarkeit. */
  const gesehen = new Set();
  const stapel = ['generators/see.js'];
  while (stapel.length) {
    const rel = stapel.pop();
    if (gesehen.has(rel)) continue;
    gesehen.add(rel);
    for (const ziel of importeVon(rel)) {
      if (!gesehen.has(ziel)) stapel.push(ziel);
    }
  }
  assert.ok(!gesehen.has('world/water.js'),
    'world/water.js ist von generators/see.js aus erreichbar — Zyklusgefahr');
  assert.ok(!gesehen.has('world/atmosphere.js'),
    'world/atmosphere.js ist von see.js aus erreichbar — Zyklusgefahr');
  // Gegenprobe, dass der Graphlauf ueberhaupt etwas sieht:
  assert.ok(gesehen.has('render/materials.js') && gesehen.has('world/terrain.js'));
});
