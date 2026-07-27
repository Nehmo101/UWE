/* Browsertest fuer die Binnenseen (Runde H).
   Deckt das ab, was `node --test` nicht sehen kann: wie ein See AUSSIEHT.

   Eine Eigenheit: generators/areas.js (genFlaeche) darf in dieser Runde nicht
   angefasst werden, die Verteilung auf `flaeche:see` fehlt also noch. Sie wird
   hier zur Laufzeit nachgeholt — genau die eine Zeile, die im Bericht steht.  */
import pw from 'file:///C:/git/UWE/node_modules/.pnpm/playwright@1.61.0/node_modules/playwright/index.js';
const { chromium } = pw;
import { mkdirSync } from 'node:fs';

const ZIEL = process.argv[2]
  || 'C:/Users/lasse/AppData/Local/Temp/claude/C--Users-lasse/499e1b74-f718-4923-9320-275b6a5c0e6c/scratchpad/shots-seen';
mkdirSync(ZIEL, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist', '--enable-webgl']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const fehler = [], konsole = [];
page.on('pageerror', (e) => fehler.push(String(e)));
page.on('console', (m) => konsole.push('[' + m.type() + '] ' + m.text()));

const S = [];
function melde(n, ok, z) {
  S.push(ok);
  console.log((ok ? 'OK  ' : 'FEHL') + '  ' + n + (z === undefined ? '' : '  — ' + z));
}

await page.goto('http://localhost:8123/index.html', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => window.__terraOk === true, { timeout: 90000 });
await page.waitForTimeout(3500);
melde('Editor startet ohne Fehler', fehler.length === 0, fehler.slice(0, 2).join(' | '));

const SEED = Number(process.argv[3] || 4711);

const r = await page.evaluate(async (seed) => {
  const St = await import('/src/core/store.js');
  const t = await import('/src/world/terrain.js');
  const d = await import('/src/core/dirty.js');
  const p = await import('/src/core/pools.js');
  const w = await import('/src/generators/welt.js');
  const see = await import('/src/generators/see.js');
  const Sx = St.S;
  Sx.worldSeed = seed;
  // Gelaende NEU aus diesem Seed — sonst wuerfelt der Generator auf dem
  // Terrain der Startkarte und die Seen laegen woanders als die Wannen.
  t.genBase(seed);
  t.refreshTerrainFull();
  const liste = w.erzeugeWelt(seed, {});
  St.hydrate(liste);
  d.rebuildAll();
  // --- die fehlende Zeile aus generators/areas.js, hier zur Laufzeit -------
  for (const el of Sx.elements) if (el.variant === 'see') see.genSee(el);
  p.flushPack();
  const seen = Sx.elements.filter((e) => e.variant === 'see').map((e) => ({
    punkte: e.points.length,
    spiegel: Math.round(see.seeSpiegel(e) * 100) / 100,
    saum: e.params.saum,
    name: e.params.name || null,
    meshes: e.group ? e.group.children.length : 0,
    ufer: Object.keys(e.inst).length,
    mitte: e.points.reduce((a, q) => ({ x: a.x + q.x / e.points.length,
      z: a.z + q.z / e.points.length }), { x: 0, z: 0 })
  }));
  return { seen, bericht: liste.bericht };
}, SEED);

melde('Seen erzeugt', r.seen.length > 0, JSON.stringify(r.bericht && r.bericht.seen));
melde('jeder See hat Wasserflaeche und Saumband',
  r.seen.every((s) => s.meshes >= 2), r.seen.map((s) => s.meshes).join(','));
melde('jeder See hat Uferbewuchs',
  r.seen.every((s) => s.ufer > 0), r.seen.map((s) => s.ufer).join(','));
melde('jeder See traegt einen Namen',
  r.seen.every((s) => !!s.name), r.seen.map((s) => s.name).join(' | '));
console.log('   Seen: ' + JSON.stringify(r.seen.map((s) => ({ p: s.punkte, y: s.spiegel, saum: s.saum }))));

/* --- Bilder: Uebersicht und je See eine Nahaufnahme ---------------------- */
async function blick(x, z, dist, yaw, pitch, datei) {
  await page.evaluate(async (o) => {
    const c = await import('/src/editor/camera.js');
    c.cam.tFocus.x = c.cam.focus.x = o.x;
    c.cam.tFocus.z = c.cam.focus.z = o.z;
    c.cam.tDist = c.cam.dist = o.dist;
    c.cam.tYaw = c.cam.yaw = o.yaw;
    c.cam.tPitch = c.cam.pitch = o.pitch;
  }, { x, z, dist, yaw, pitch });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: ZIEL + '/' + datei, timeout: 180000 });
}

await blick(0, 0, 420, 0.7, 1.0, '00-uebersicht.png');
for (let i = 0; i < Math.min(4, r.seen.length); i++) {
  const s = r.seen[i];
  await blick(s.mitte.x, s.mitte.z, 90, 0.7 + i * 0.4, 0.42, '0' + (i + 1) + '-see-nah.png');
  await blick(s.mitte.x, s.mitte.z, 190, 0.7 + i * 0.4, 0.95, '0' + (i + 1) + '-see-hoch.png');
}

/* --- Kartenmassstab: die Wasserflaeche IST das Zeichen, dazu der Kuestenstrich */
const k = await page.evaluate(async () => {
  const St = await import('/src/core/store.js');
  const d = await import('/src/core/dirty.js');
  const p = await import('/src/core/pools.js');
  const see = await import('/src/generators/see.js');
  const Sx = St.S;
  Sx.einheitMeter = 250;
  d.rebuildAll();
  for (const el of Sx.elements) if (el.variant === 'see') see.genSee(el);
  p.flushPack();
  const seen = Sx.elements.filter((e) => e.variant === 'see');
  return {
    flaechen: seen.map((e) => e.group ? e.group.children.length : 0),
    // sig_kueste ist ein STREIFEN-Zeichen: bandZeichen haengt ein Mesh in die
    // Elementgruppe, es entsteht also keine Pool-Instanz. Gezaehlt wird
    // stattdessen der Koerperbewuchs, der oben wegfallen MUSS.
    koerper: seen.reduce((a, e) => a + Object.keys(e.inst).length, 0)
  };
});
melde('Kartenmassstab: Wasserflaeche bleibt stehen', k.flaechen.every((n) => n >= 1),
  JSON.stringify(k.flaechen));
melde('Kartenmassstab: Kuestenstrich statt Uferbewuchs',
  k.flaechen.every((n) => n >= 2) && k.koerper === 0, 'Koerperpools ' + k.koerper);
await blick(0, 0, 420, 0.7, 1.0, '90-karte.png');
melde('keine Seitenfehler', fehler.length === 0, fehler.slice(0, 3).join(' | '));
const warn = konsole.filter((k) => k.startsWith('[warning]') || k.startsWith('[error]'));
melde('keine Shader-Warnungen', warn.length === 0, warn.slice(0, 3).join(' | '));

const n = S.filter(Boolean).length;
console.log('\n=== ' + n + '/' + S.length + ' Schritte gruen — Bilder in ' + ZIEL + ' ===');
await browser.close();
process.exit(n === S.length ? 0 : 1);
