/* Browserpruefung der drei Bedienungsstuecke dieser Runde.

   Sie steht hier und nicht in `node --test`, weil genau die Module, um die es
   geht, dort durch Ersatzmodule getauscht sind: tools.js, selection.js,
   history.js und panels.js. Was diese Datei prueft, prueft sonst niemand.

     1  Der Biompinsel: Variante im Panel, Ring am Zeiger, Ziehen legt ein
        Element an, und die abgeleitete Biommaske traegt danach sein Biom.
     2  Die gebogene Beschriftung: das Auswahlfeld im Panel, die Verknuepfung,
        das flach liegende Quad in der Szene — und der Rueckfall auf die
        gerade Fassung, wenn das verknuepfte Element geloescht wird.
     3  Die Historie ueberlebt einen Kartenwechsel: Stapel parken, in eine
        Kindkarte springen, zurueckkommen, rueckgaengig machen.

   Voraussetzung wie bei den uebrigen Skripten: statischer Server auf
   terra/, Port 8123 (siehe README.md daneben).
       node test/browser/runde-h-bedienung.mjs
*/
import pw from 'file:///C:/git/UWE/node_modules/.pnpm/playwright@1.61.0/node_modules/playwright/index.js';
const { chromium } = pw;
import { mkdirSync } from 'node:fs';

const ZIEL = process.argv[2]
  || 'C:/Users/lasse/AppData/Local/Temp/claude/C--Users-lasse/499e1b74-f718-4923-9320-275b6a5c0e6c/scratchpad/shots-h-bedienung';
mkdirSync(ZIEL, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist', '--enable-webgl']
});
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });

const konsole = [], fehler = [];
page.on('console', m => konsole.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => fehler.push(String(e)));

const schritte = [];
function melde(name, ok, zusatz) {
  schritte.push({ name, ok, zusatz: zusatz === undefined ? '' : String(zusatz) });
  console.log((ok ? 'OK  ' : 'FEHL') + '  ' + name + (zusatz === undefined ? '' : '  — ' + zusatz));
}

await page.goto('http://localhost:8123/index.html', { waitUntil: 'load', timeout: 90000 });
const gestartet = await page.waitForFunction(() => window.__terraOk === true, { timeout: 90000 })
  .then(() => true).catch(() => false);
melde('Editor startet (window.__terraOk)', gestartet);
if (!gestartet) {
  console.log('\n--- Seitenfehler ---');
  fehler.forEach(f => console.log(f));
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(3500);
melde('keine Seitenfehler beim Start', fehler.length === 0, fehler.slice(0, 3).join(' | '));

/* ==========================================================================
   1 — Biompinsel
   ========================================================================== */
const pinselVariante = await page.evaluate(() => {
  const t = [...document.querySelectorAll('#rail .tool')].find((e) => /Pfad/i.test(e.textContent));
  if (t) t.click();
  const b = [...document.querySelectorAll('#panel .seg button')]
    .find((e) => /Biompinsel/i.test(e.textContent));
  if (b) b.click();
  return { werkzeug: !!t, variante: !!b };
});
melde('Werkzeug „Pfad" erreichbar', pinselVariante.werkzeug);
melde('Variante „Biompinsel" im Panel', pinselVariante.variante);

await page.waitForTimeout(400);
const pinselPanel = await page.evaluate(() =>
  [...document.querySelectorAll('#panel .row label span')].map((e) => e.textContent.trim()));
melde('Panel zeigt Biom, Pinselradius und Randbreite',
  ['Biom', 'Pinselradius', 'Randbreite'].every((k) => pinselPanel.includes(k)),
  pinselPanel.join(' / '));

// Biom auf etwas Auffaelliges stellen (Standard ist „moor" — bewusst noch
// einmal gesetzt, damit die Pruefung nicht am Standard haengt).
await page.evaluate(() => {
  const sel = [...document.querySelectorAll('#panel select')]
    .find((s) => [...s.options].some((o) => o.value === 'moor'));
  if (sel) { sel.value = 'moor'; sel.dispatchEvent(new Event('change')); }
});

// Der Ring folgt dem Zeiger, sobald das Werkzeug aktiv ist.
await page.mouse.move(520, 380);
await page.waitForTimeout(400);
const ring = await page.evaluate(async () => {
  const sel = await import('/src/editor/selection.js');
  return sel.brushRing.visible;
});
melde('Pinselring ist am Zeiger sichtbar', ring === true, String(ring));

// Ziehen — ein Strich quer ueber die Karte.
await page.mouse.move(470, 380);
await page.mouse.down();
for (let i = 1; i <= 8; i++) {
  await page.mouse.move(470 + i * 22, 380 + Math.sin(i * 0.6) * 18);
  await page.waitForTimeout(90);
}
await page.mouse.up();
await page.waitForTimeout(1500);

const strich = await page.evaluate(() => {
  const S = window.__terraDebug.S;
  const el = S.elements.filter((e) => e.kind === 'pfad' && e.variant === 'biompinsel');
  const l = el[el.length - 1];
  return { anzahl: el.length, punkte: l ? l.points.length : 0,
    params: l ? l.params : null, mitte: l ? l.points[Math.floor(l.points.length / 2)] : null };
});
melde('Ziehen legt ein Element „pfad:biompinsel" an', strich.anzahl === 1,
  JSON.stringify(strich.params));
melde('Der Strich sammelt mehrere Stuetzpunkte', strich.punkte >= 3, strich.punkte + ' Punkte');

const maske = await page.evaluate(async (mitte) => {
  const T = await import('/src/world/terrain.js');
  const BF = await import('/src/world/biomfeld.js');
  const { KARTE } = await import('/src/core/store.js');
  const idx = BF.biomIndexAn(T.biomFeld, KARTE.vw, KARTE.map, mitte.x, mitte.z);
  const fern = BF.biomIndexAn(T.biomFeld, KARTE.vw, KARTE.map, mitte.x, mitte.z + 120);
  return { auf: BF.biomName(idx), fern: BF.biomName(fern), keins: BF.BIOM_KEINS };
}, strich.mitte || { x: 0, z: 0 });
melde('Die Biommaske traegt das Biom auf dem Strich', maske.auf === 'moor', JSON.stringify(maske));
melde('… und nur dort', maske.fern !== 'moor', 'fern: ' + maske.fern);
await page.screenshot({ path: ZIEL + '/01-biompinsel.png', timeout: 180000 });

// Rueckgaengig: der Strich ist ein ganz gewoehnliches Element.
await page.evaluate(async () => { (await import('/src/editor/history.js')).undo(); });
await page.waitForTimeout(1200);
const nachUndo = await page.evaluate(() =>
  window.__terraDebug.S.elements.filter((e) => e.variant === 'biompinsel').length);
melde('Strg+Z nimmt den Strich zurueck', nachUndo === 0, nachUndo + ' uebrig');
await page.evaluate(async () => { (await import('/src/editor/history.js')).redo(); });
await page.waitForTimeout(1200);
const nachRedo = await page.evaluate(() =>
  window.__terraDebug.S.elements.filter((e) => e.variant === 'biompinsel').length);
melde('… und Strg+Y holt ihn wieder', nachRedo === 1, nachRedo + ' da');

/* ==========================================================================
   2 — Gebogene Beschriftung
   ========================================================================== */
const gesetzt = await page.evaluate(() => {
  const t = [...document.querySelectorAll('#rail .tool')].find((e) => /Marker/i.test(e.textContent));
  if (t) t.click();
  const b = [...document.querySelectorAll('#panel .seg button')]
    .find((e) => /Beschriftung/i.test(e.textContent));
  if (b) b.click();
  return !!t && !!b;
});
melde('Markerwerkzeug, Variante Beschriftung', gesetzt);
await page.waitForTimeout(400);
await page.mouse.click(560, 360);
await page.waitForTimeout(900);

// Text setzen (ueber das Panel-Textfeld, wie ein Mensch es taete).
const textGesetzt = await page.evaluate(() => {
  // Die Zeile „Text" — NICHT einfach das erste Textfeld: davor steht die
  // Namenszeile des Elements (J3).
  const zeile = [...document.querySelectorAll('#panel .row')]
    .find((r) => { const s = r.querySelector('label span'); return s && s.textContent.trim() === 'Text'; });
  const f = zeile && zeile.querySelector('input[type=text]');
  if (!f) return false;
  f.value = 'Silberfluss';
  f.dispatchEvent(new Event('change'));
  const S = window.__terraDebug.S;
  const b = S.elements.filter((e) => e.variant === 'beschriftung').pop();
  return !!(b && b.params.text === 'Silberfluss');
});
melde('Text der Beschriftung gesetzt', textGesetzt);
await page.waitForTimeout(900);

const feld = await page.evaluate(() => {
  const zeilen = [...document.querySelectorAll('#panel .row')];
  const zeile = zeilen.find((r) => /Entlang eines Pfades/.test(r.textContent));
  if (!zeile) return { da: false };
  const sel = zeile.querySelector('select');
  return { da: true, optionen: [...sel.options].map((o) => o.textContent) };
});
melde('Panel zeigt „Entlang eines Pfades"', feld.da === true);
melde('… mit den Pfaden der Karte zur Auswahl',
  !!feld.optionen && feld.optionen.length > 1, (feld.optionen || []).join(' | '));

// Den laengsten Pfad waehlen — er traegt den Text am ehesten.
const verknuepft = await page.evaluate(() => {
  const S = window.__terraDebug.S;
  const pfade = S.elements.filter((e) => e.kind === 'pfad' && e.points.length >= 2);
  if (!pfade.length) return { ok: false };
  let best = pfade[0], bl = 0;
  for (const p of pfade) {
    let l = 0;
    for (let i = 1; i < p.points.length; i++) {
      l += Math.hypot(p.points[i].x - p.points[i - 1].x, p.points[i].z - p.points[i - 1].z);
    }
    if (l > bl) { bl = l; best = p; }
  }
  const zeile = [...document.querySelectorAll('#panel .row')]
    .find((r) => /Entlang eines Pfades/.test(r.textContent));
  const sel = zeile && zeile.querySelector('select');
  if (!sel) return { ok: false };
  sel.value = String(best.id);
  sel.dispatchEvent(new Event('change'));
  const b = S.elements.filter((e) => e.variant === 'beschriftung').pop();
  return { ok: true, id: best.id, laenge: Math.round(bl), anPfad: b && b.params.anPfad };
});
melde('Verknuepfung wird uebernommen', verknuepft.ok && verknuepft.anPfad === verknuepft.id,
  JSON.stringify(verknuepft));
await page.waitForTimeout(1200);

const schicht = await page.evaluate(async () => {
  const B = await import('/src/ui/beschriftung.js');
  const g = B.holeBeschriftungsschicht().gruppe;
  return g.children.map((c) => ({ typ: c.type, rx: c.rotation.x,
    x: Math.round(c.position.x), z: Math.round(c.position.z) }));
});
const gebogen = schicht.filter((c) => c.typ === 'Mesh');
melde('Die Beschriftung liegt als Quad in der Karte', gebogen.length === 1,
  JSON.stringify(schicht));
melde('… flach gedreht (−90° um X)',
  gebogen.length === 1 && Math.abs(gebogen[0].rx + Math.PI / 2) < 1e-6,
  gebogen.length ? String(gebogen[0].rx) : '—');
await page.screenshot({ path: ZIEL + '/02-beschriftung-gebogen.png', timeout: 180000 });

// Das verknuepfte Element loeschen: die Beschriftung faellt auf gerade zurueck.
const nachLoeschen = await page.evaluate(async (id) => {
  const S = window.__terraDebug.S;
  const D = await import('/src/core/dirty.js');
  const sel = await import('/src/editor/selection.js');
  const el = S.elements.find((e) => e.id === id);
  if (el) D.deleteElement(el);
  D.commit(null, true);
  sel.beschriftungenAktualisieren();
  const B = await import('/src/ui/beschriftung.js');
  return B.holeBeschriftungsschicht().gruppe.children.map((c) => c.type);
}, verknuepft.id);
melde('Geloeschtes Zielelement -> die Beschriftung steht wieder gerade',
  nachLoeschen.length === 1 && nachLoeschen[0] === 'Sprite', JSON.stringify(nachLoeschen));
melde('keine Seitenfehler nach der Beschriftung', fehler.length === 0, fehler.slice(0, 3).join(' | '));

/* ==========================================================================
   3 — Historie ueber einen Kartenwechsel
   ========================================================================== */
// Ausgangsstand merken und einen klar erkennbaren Schritt tun.
const vorher = await page.evaluate(() => window.__terraDebug.S.elements.length);
await page.evaluate(async () => {
  const { S, mkElement, nextSeed } = await import('/src/core/store.js');
  const D = await import('/src/core/dirty.js');
  const H = await import('/src/editor/history.js');
  H.pushUndo();
  S.elements.push(mkElement('objekt', 'felsen', [{ x: 10, z: 10 }],
    { anzahl: 3, streuung: 6, groesse: 1, frei: false, nurTyp: '' }, nextSeed()));
  D.commit(S.elements[S.elements.length - 1], false);
});
const mitSchritt = await page.evaluate(() => window.__terraDebug.S.elements.length);
melde('Ein Schritt auf der Wurzelkarte', mitSchritt === vorher + 1,
  vorher + ' -> ' + mitSchritt);

// Kindkarte anlegen: Werkzeug „Ausschnitt", drei Klicks, Doppelklick.
/* Der Ausschnitt fragt nach einem Titel (prompt in editor/io.js). Playwright
   weist Dialoge sonst ab — und „Abbruch legt nichts an" waere das Ergebnis. */
page.on('dialog', (d) => d.accept('Prüfausschnitt'));

const werkzeugAusschnitt = await page.evaluate(async () => {
  const t = [...document.querySelectorAll('#rail .tool')].find((e) => /Ausschnitt/i.test(e.textContent));
  if (t) t.click();
  const { ed } = await import('/src/editor/tools.js');
  return ed.tool;
});
melde('Werkzeug „Ausschnitt" aktiv', werkzeugAusschnitt === 'ausschnitt', werkzeugAusschnitt);
await page.waitForTimeout(400);
/* Klein halten: der Ausschnitt muss FEINER werden als die Elternkarte, sonst
   weist legeKindkarteAn ihn ab („waere groeber als die Elternkarte"). Ein
   Viertel des Bildes ist reichlich Sicherheitsabstand. */
await page.mouse.click(520, 340);
await page.waitForTimeout(250);
await page.mouse.click(600, 340);
await page.waitForTimeout(250);
await page.mouse.click(600, 400);
await page.waitForTimeout(250);
const gezeichnet = await page.evaluate(async () => {
  const { ed } = await import('/src/editor/tools.js');
  return ed.draw ? ed.draw.kind + ':' + ed.draw.points.length : 'keine Zeichnung';
});
melde('Die drei Klicks setzen Punkte', /ausschnitt:3/.test(gezeichnet), gezeichnet);
await page.mouse.dblclick(520, 400);
await page.waitForTimeout(5000);

const inKind = await page.evaluate(() => ({
  aktiv: window.__terraDebug.S.aktiveKarte,
  karten: window.__terraDebug.S.baum ? window.__terraDebug.S.baum.karten.length : 0,
  elemente: window.__terraDebug.S.elements.length,
  toast: (document.getElementById('toast') || {}).textContent
}));
melde('Ausschnitt erzeugt eine Kindkarte und springt hinein',
  inKind.karten >= 2 && inKind.aktiv !== 'k0', JSON.stringify(inKind));

if (inKind.karten >= 2 && inKind.aktiv !== 'k0') {
  // Auf der Kindkarte ist die Historie leer — sie hat noch keine eigene.
  const kindStapel = await page.evaluate(async () =>
    (await import('/src/editor/history.js')).schritteInHistorie());
  melde('Die Kindkarte beginnt mit leerer Historie', kindStapel === 0, String(kindStapel));
  const geparkt = await page.evaluate(async () =>
    (await import('/src/editor/history.js')).geparkteHistorien());
  melde('Der Stapel der Wurzelkarte liegt in der Ablage', geparkt === 1, String(geparkt));

  await page.screenshot({ path: ZIEL + '/03-kindkarte.png', timeout: 180000 });

  // Zurueck ueber die Brotkrume im Panel.
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('#rail .tool')].find((e) => /Auswahl/i.test(e.textContent));
    if (t) t.click();
  });
  await page.waitForTimeout(600);
  const zurueck = await page.evaluate(() => {
    const k = document.querySelector('#panel .krumeLink');
    if (!k) return false;
    k.click();
    return true;
  });
  melde('Brotkrume fuehrt zurueck zur Wurzelkarte', zurueck);
  await page.waitForTimeout(4000);

  const daheim = await page.evaluate(async () => ({
    aktiv: window.__terraDebug.S.aktiveKarte,
    elemente: window.__terraDebug.S.elements.length,
    stapel: (await import('/src/editor/history.js')).schritteInHistorie()
  }));
  melde('Wieder auf der Wurzelkarte', daheim.aktiv === 'k0', JSON.stringify(daheim));
  melde('Die Historie der Wurzelkarte ist wieder da', daheim.stapel > 0,
    daheim.stapel + ' Schritte');

  // Und sie wirkt: der Schritt von vorhin laesst sich zuruecknehmen.
  await page.evaluate(async () => { (await import('/src/editor/history.js')).undo(); });
  await page.waitForTimeout(1500);
  const nachHeimUndo = await page.evaluate(() => window.__terraDebug.S.elements.length);
  melde('Undo ueber den Kartenwechsel hinweg wirkt',
    nachHeimUndo === daheim.elemente - 1,
    daheim.elemente + ' -> ' + nachHeimUndo + ' (erwartet ' + (daheim.elemente - 1) + ')');
  await page.screenshot({ path: ZIEL + '/04-zurueck.png', timeout: 180000 });
} else {
  melde('Kartenwechsel-Historie (uebersprungen: keine Kindkarte)', false, 'Ausschnitt scheiterte');
}

melde('keine Seitenfehler am Ende', fehler.length === 0, fehler.slice(0, 3).join(' | '));

/* --- Auswertung --------------------------------------------------------- */
const warnungen = konsole.filter((k) => k.startsWith('[warning]') || k.startsWith('[error]'));
console.log('\nWarnungen/Fehler in der Konsole:', warnungen.length);
warnungen.slice(0, 12).forEach((w) => console.log('  ' + w));

const fehlgeschlagen = schritte.filter((s) => !s.ok);
console.log('\n=== ' + (schritte.length - fehlgeschlagen.length) + '/' + schritte.length + ' Schritte grün ===');
if (fehler.length) {
  console.log('\n--- Seitenfehler ---');
  fehler.slice(0, 10).forEach((f) => console.log(f));
}
await browser.close();
process.exit(fehlgeschlagen.length ? 1 : 0);
