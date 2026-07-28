/* Browserpruefung der drei letzten Bedienungsluecken (Runde H, Teil „voll").

   Sie steht hier und nicht in `node --test`, weil genau die Module, um die es
   geht, dort durch Ersatzmodule getauscht sind: tools.js, selection.js und
   panels.js. Was diese Datei prueft, prueft sonst niemand.

     1  Beschriftung am Flaechenrand: See zeichnen, Beschriftung setzen, mit
        dem SEE verknuepfen — das flach liegende Quad entsteht, die Zeile
        laeuft am Ufer entlang (Bild 01).
     2  Das Kartenzeichen-Werkzeug (marker:zeichen): auf Ortsmaszstab bleibt
        das Zeichen unsichtbar (Maszstabsband!), auf Regionsmaszstab steht es
        (Bild 02); ein schwerer Commit nimmt die Instanz, die Selbstheilung
        (zeichenMarkerNachziehen) setzt sie wieder; Undo/Redo ueberlebt es;
        die Linienzeichen (Seeweg) bauen ein Bandstueck.
     3  Der Reglerweg: `art` im Panel umstellen wirkt sofort.

   Voraussetzung: statischer Server auf terra/, Port 8127 (eigener Port, damit
   parallele Skripte auf 8123 ungestoert bleiben):
       node test/browser/runde-h-voll.mjs
*/
import pw from 'file:///C:/git/UWE/node_modules/.pnpm/playwright@1.61.0/node_modules/playwright/index.js';
const { chromium } = pw;
import { mkdirSync } from 'node:fs';

const ZIEL = process.argv[2]
  || 'C:/Users/lasse/AppData/Local/Temp/claude/C--Users-lasse/499e1b74-f718-4923-9320-275b6a5c0e6c/scratchpad/shots-voll';
mkdirSync(ZIEL, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist', '--enable-webgl']
});
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });

const konsole = [], fehler = [];
page.on('console', m => konsole.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => fehler.push(String(e)));
page.on('dialog', (d) => d.accept());

const schritte = [];
function melde(name, ok, zusatz) {
  schritte.push({ name, ok });
  console.log((ok ? 'OK  ' : 'FEHL') + '  ' + name + (zusatz === undefined ? '' : '  — ' + zusatz));
}

await page.goto('http://localhost:8127/index.html', { waitUntil: 'load', timeout: 90000 });
const gestartet = await page.waitForFunction(() => window.__terraOk === true, { timeout: 90000 })
  .then(() => true).catch(() => false);
melde('Editor startet (window.__terraOk)', gestartet);
if (!gestartet) {
  fehler.forEach(f => console.log(f));
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(3000);

/* ==========================================================================
   1 — See zeichnen, Beschriftung ans Ufer
   ========================================================================== */
const seeWerkzeug = await page.evaluate(() => {
  const t = [...document.querySelectorAll('#rail .tool')].find((e) => /Fläche/i.test(e.textContent));
  if (t) t.click();
  const b = [...document.querySelectorAll('#panel .seg button')].find((e) => /^See$/i.test(e.textContent.trim()));
  if (b) b.click();
  return !!t && !!b;
});
melde('Werkzeug Fläche, Variante See', seeWerkzeug);
await page.waitForTimeout(300);
for (const [x, y] of [[470, 320], [600, 330], [620, 430], [480, 440]]) {
  await page.mouse.click(x, y);
  await page.waitForTimeout(200);
}
await page.mouse.dblclick(475, 325);
await page.waitForTimeout(2500);

const see = await page.evaluate(() => {
  const S = window.__terraDebug.S;
  const el = S.elements.filter((e) => e.kind === 'flaeche' && e.variant === 'see').pop();
  return el ? { id: el.id, punkte: el.points.length } : null;
});
melde('See-Element steht', !!see && see.punkte >= 3, JSON.stringify(see));

// Beschriftung setzen — an den Nordrand des Sees.
const beschriftung = await page.evaluate(() => {
  const t = [...document.querySelectorAll('#rail .tool')].find((e) => /Marker/i.test(e.textContent));
  if (t) t.click();
  const b = [...document.querySelectorAll('#panel .seg button')].find((e) => /Beschriftung/i.test(e.textContent));
  if (b) b.click();
  return !!t && !!b;
});
melde('Marker-Werkzeug, Variante Beschriftung', beschriftung);
await page.waitForTimeout(300);
await page.mouse.click(540, 330);
await page.waitForTimeout(800);

const textUndKlasse = await page.evaluate(() => {
  const zeilen = [...document.querySelectorAll('#panel .row')];
  const textZeile = zeilen.find((r) => { const s = r.querySelector('label span'); return s && s.textContent.trim() === 'Text'; });
  const f = textZeile && textZeile.querySelector('input[type=text]');
  if (!f) return { ok: false, grund: 'kein Textfeld' };
  f.value = 'Silbersee';
  f.dispatchEvent(new Event('change'));
  const klasseZeile = zeilen.find((r) => { const s = r.querySelector('label span'); return s && s.textContent.trim() === 'Klasse'; });
  const sel = klasseZeile && klasseZeile.querySelector('select');
  if (sel) { sel.value = 'gewaesser'; sel.dispatchEvent(new Event('change')); }
  const S = window.__terraDebug.S;
  const b = S.elements.filter((e) => e.variant === 'beschriftung').pop();
  return { ok: !!(b && b.params.text === 'Silbersee'), klasse: b && b.params.klasse };
});
melde('Text und Klasse gesetzt', textUndKlasse.ok && textUndKlasse.klasse === 'gewaesser',
  JSON.stringify(textUndKlasse));
await page.waitForTimeout(600);

// Die Verknuepfungszeile bietet den SEE an — und nimmt ihn.
const verknuepft = await page.evaluate((seeId) => {
  const zeile = [...document.querySelectorAll('#panel .row')]
    .find((r) => /Entlang eines Pfades/.test(r.textContent));
  if (!zeile) return { ok: false, grund: 'Zeile fehlt' };
  const sel = zeile.querySelector('select');
  const optionen = [...sel.options].map((o) => ({ v: o.value, t: o.textContent }));
  const seeOption = optionen.find((o) => Number(o.v) === seeId);
  if (!seeOption) return { ok: false, grund: 'See nicht in der Liste', optionen };
  sel.value = String(seeId);
  sel.dispatchEvent(new Event('change'));
  const S = window.__terraDebug.S;
  const b = S.elements.filter((e) => e.variant === 'beschriftung').pop();
  return { ok: b && b.params.anPfad === seeId, text: seeOption.t };
}, see ? see.id : -1);
melde('Der Flaechenrand steht in der Liste und wird uebernommen', verknuepft.ok === true,
  JSON.stringify(verknuepft));
await page.waitForTimeout(1200);

const quad = await page.evaluate(async () => {
  const B = await import('/src/ui/beschriftung.js');
  const g = B.holeBeschriftungsschicht().gruppe;
  return g.children.map((c) => ({ typ: c.type, rx: Math.round(c.rotation.x * 1000) / 1000 }));
});
const gebogen = quad.filter((c) => c.typ === 'Mesh');
melde('Die Beschriftung liegt als Quad am Ufer (kein Sprite)', gebogen.length === 1,
  JSON.stringify(quad));

// Fuer das Bild: Zeile groesser stellen (sonst ist sie auf 700 px Hoehe kaum
// zu lesen), abwaehlen (der blaue Griff saesse sonst mitten im Motiv) und die
// Kamera auf den Anker setzen.
await page.evaluate(() => {
  const zeile = [...document.querySelectorAll('#panel .row')]
    .find((r) => { const s = r.querySelector('label span'); return s && s.textContent.trim() === 'Größe'; });
  const inp = zeile && zeile.querySelector('input[type=range]');
  if (inp) {
    inp.value = '1.8';
    inp.dispatchEvent(new Event('input'));
    inp.dispatchEvent(new Event('change'));
  }
});
await page.waitForTimeout(600);
await page.evaluate(async () => {
  const { cam } = await import('/src/editor/camera.js');
  const S = window.__terraDebug.S;
  const b = S.elements.filter((e) => e.variant === 'beschriftung').pop();
  if (b) { cam.tFocus.x = b.points[0].x; cam.tFocus.z = b.points[0].z; }
  cam.tDist = 60;
});
await page.keyboard.press('Escape');
await page.waitForTimeout(2500);
await page.screenshot({ path: ZIEL + '/01-seeufer-beschriftung.png', timeout: 180000 });

/* ==========================================================================
   2 — Das Kartenzeichen-Werkzeug
   ========================================================================== */
/* ERST abwaehlen (Esc): die Variantenknoepfe wirken auf das AUSGEWAEHLTE
   Element, solange eines gewaehlt ist — ein Klick auf „Kartenzeichen" wuerde
   sonst die eben gesetzte Beschriftung umbauen statt die Werkzeugvariante zu
   stellen. Das ist das eingebaute Verhalten aller Werkzeuge, kein Fehler. */
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const zeichenVariante = await page.evaluate(() => {
  const b = [...document.querySelectorAll('#panel .seg button')].find((e) => /Kartenzeichen/i.test(e.textContent));
  if (b) b.click();
  return !!b;
});
melde('Variante „Kartenzeichen" im Panel', zeichenVariante);
await page.waitForTimeout(400);
await page.mouse.click(400, 300);
await page.waitForTimeout(600);

const gesetzt = await page.evaluate(() => {
  const S = window.__terraDebug.S;
  const el = S.elements.filter((e) => e.kind === 'marker' && e.variant === 'zeichen').pop();
  if (!el) return null;
  const inst = el.inst && el.inst.sig_hauptstadt ? el.inst.sig_hauptstadt.length : 0;
  return { id: el.id, art: el.params.art, inst, einheitMeter: S.einheitMeter,
    toast: (document.getElementById('toast') || {}).textContent };
});
melde('Klick legt ein marker:zeichen-Element an', !!gesetzt && gesetzt.art === 'sig_hauptstadt',
  JSON.stringify(gesetzt));
melde('Auf Ortsmaszstab (einheitMeter 1) bleibt das Zeichen unsichtbar — das Band greift',
  !!gesetzt && gesetzt.inst === 0, gesetzt && ('inst=' + gesetzt.inst));

// Auf Regionsmaszstab wechseln: ein SCHWERER Commit leert alle Instanzen —
// genau der Weg, den die Selbstheilung abdecken muss.
await page.evaluate(async () => {
  const S = window.__terraDebug.S;
  const D = await import('/src/core/dirty.js');
  S.einheitMeter = 120;
  D.commit(null, true);
});
await page.waitForTimeout(1500);            // Beschriftungs-Takt: 5x je Sekunde

const regional = await page.evaluate(() => {
  const S = window.__terraDebug.S;
  const el = S.elements.filter((e) => e.kind === 'marker' && e.variant === 'zeichen').pop();
  return { inst: el && el.inst.sig_hauptstadt ? el.inst.sig_hauptstadt.length : 0 };
});
melde('Auf Regionsmaszstab steht das Hauptstadtzeichen (Selbstheilung nach schwerem Commit)',
  regional.inst === 12, 'inst=' + regional.inst + ' (12 Zahlen = 1 Instanz)');

// Fuer das Bild: abwaehlen (der Griff verdeckt sonst das Zeichen) und nah an
// die Klickstelle heran.
await page.keyboard.press('Escape');
await page.evaluate(async () => {
  const { cam } = await import('/src/editor/camera.js');
  const S = window.__terraDebug.S;
  const el = S.elements.filter((e) => e.variant === 'zeichen').pop();
  if (el) { cam.tFocus.x = el.points[0].x; cam.tFocus.z = el.points[0].z; }
  cam.tDist = 95;
});
await page.waitForTimeout(2000);
await page.screenshot({ path: ZIEL + '/02-hauptstadt-regionsmassstab.png', timeout: 180000 });

// Undo nimmt das Element, Redo bringt es MITSAMT Instanz zurueck.
const undoRedo = await page.evaluate(async () => {
  const H = await import('/src/editor/history.js');
  const S = window.__terraDebug.S;
  H.undo();
  const weg = S.elements.filter((e) => e.variant === 'zeichen').length;
  H.redo();
  return { weg };
});
await page.waitForTimeout(1500);
const nachRedo = await page.evaluate(() => {
  const S = window.__terraDebug.S;
  const el = S.elements.filter((e) => e.variant === 'zeichen').pop();
  return { da: !!el, inst: el && el.inst.sig_hauptstadt ? el.inst.sig_hauptstadt.length : 0 };
});
melde('Undo nimmt das Zeichen, Redo bringt es samt Instanz zurueck',
  undoRedo.weg === 0 && nachRedo.da && nachRedo.inst === 12, JSON.stringify({ undoRedo, nachRedo }));

// Reglerweg: die Art im Panel auf „Seeweg" stellen -> Bandstueck statt Quad.
// Nach dem Redo ist nichts mehr ausgewaehlt (restore leert die Auswahl) —
// das Element zuerst wieder anwaehlen, dann zeigt das Panel SEINE Regler.
const seeweg = await page.evaluate(async () => {
  const S = window.__terraDebug.S;
  const sel1 = await import('/src/editor/selection.js');
  const el = S.elements.filter((e) => e.variant === 'zeichen').pop();
  if (!el) return { ok: false, grund: 'kein Element' };
  sel1.select(el);
  const zeile = [...document.querySelectorAll('#panel .row')]
    .find((r) => { const s = r.querySelector('label span'); return s && s.textContent.trim() === 'Zeichen'; });
  const sel = zeile && zeile.querySelector('select');
  if (!sel) return { ok: false, grund: 'kein Zeichen-Select (Element womoeglich nicht ausgewaehlt)' };
  sel.value = 'sig_seeweg';
  sel.dispatchEvent(new Event('change'));
  return {
    ok: el.params.art === 'sig_seeweg',
    quadInst: el.inst.sig_hauptstadt ? el.inst.sig_hauptstadt.length : 0,
    bandMeshes: el.group ? el.group.children.length : 0
  };
});
melde('Art-Wechsel im Panel: Seeweg wird ein Bandstueck, das Quad ist weg',
  seeweg.ok === true && seeweg.quadInst === 0 && seeweg.bandMeshes === 1, JSON.stringify(seeweg));
await page.waitForTimeout(1200);
await page.screenshot({ path: ZIEL + '/03-seeweg-band.png', timeout: 180000 });

// Zurueck auf Ortsmaszstab: BEIDE Bauarten verschwinden unter der Uebergabe.
await page.evaluate(async () => {
  const S = window.__terraDebug.S;
  const D = await import('/src/core/dirty.js');
  S.einheitMeter = 1;
  D.commit(null, true);
});
await page.waitForTimeout(1500);
const untenrum = await page.evaluate(() => {
  const S = window.__terraDebug.S;
  const el = S.elements.filter((e) => e.variant === 'zeichen').pop();
  const instGesamt = Object.keys(el.inst).reduce((s, k) => s + el.inst[k].length, 0);
  return { instGesamt, meshes: el.group ? el.group.children.length : 0 };
});
melde('Zurueck auf Ortsmaszstab: das handgesetzte Zeichen verschwindet unter der Uebergabe',
  untenrum.instGesamt === 0 && untenrum.meshes === 0, JSON.stringify(untenrum));

melde('keine Seitenfehler am Ende', fehler.length === 0, fehler.slice(0, 3).join(' | '));

/* --- Auswertung --------------------------------------------------------- */
const warnungen = konsole.filter((k) => k.startsWith('[warning]') || k.startsWith('[error]'));
console.log('\nWarnungen/Fehler in der Konsole:', warnungen.length);
warnungen.slice(0, 12).forEach((w) => console.log('  ' + w));
const fehlgeschlagen = schritte.filter((s) => !s.ok);
console.log('\n=== ' + (schritte.length - fehlgeschlagen.length) + '/' + schritte.length + ' Schritte grün ===');
if (fehler.length) fehler.slice(0, 10).forEach((f) => console.log(f));
await browser.close();
process.exit(fehlgeschlagen.length ? 1 : 0);
