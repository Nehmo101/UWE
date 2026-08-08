import pw from 'file:///C:/git/UWE/node_modules/.pnpm/playwright@1.61.0/node_modules/playwright/index.js';
const { chromium } = pw;
import { mkdirSync } from 'node:fs';
const ZIEL = 'C:/Users/lasse/AppData/Local/Temp/claude/C--Users-lasse/499e1b74-f718-4923-9320-275b6a5c0e6c/scratchpad/shots-baum';
mkdirSync(ZIEL, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const fehler = [];
page.on('pageerror', e => fehler.push(String(e)));
const schritte = [];
function melde(n, ok, z) { schritte.push(ok); console.log((ok?'OK  ':'FEHL')+'  '+n+(z===undefined?'':'  — '+z)); }

await page.goto('http://localhost:8123/index.html?schau=demo', { waitUntil: 'load', timeout: 90000 });
const start = await page.waitForFunction(() => window.__terraOk === true, { timeout: 90000 }).then(()=>true).catch(()=>false);
melde('Editor startet', start);
if (!start) { fehler.slice(0,5).forEach(f=>console.log(f)); await browser.close(); process.exit(1); }
await page.waitForTimeout(4000);
melde('kein Seitenfehler beim Start', fehler.length === 0, fehler.slice(0,2).join(' | '));

// Werkzeugleiste: gibt es "Ausschnitt"?
const werkzeuge = await page.evaluate(() =>
  [...document.querySelectorAll('#rail .tool')].map(t => t.textContent.replace(/\s+/g,' ').trim()));
melde('Werkzeug „Ausschnitt" in der Leiste', werkzeuge.some(w => /Ausschnitt/i.test(w)), werkzeuge.length + ' Werkzeuge');

// Kindkarte ueber den internen Weg anlegen (kein Zeichnen noetig).
await page.evaluate(async () => {
  const S = window.__terraDebug.S;
  const vorher = { elemente: S.elements.length, hoehe: null };
  const t = await import('/src/world/terrain.js');
  vorher.hoehe = t.heightAt(-20, -20);
  return vorher;
});
await page.evaluate(() => {
  // Das Panel der ganzen Karte oeffnen, damit der Kartenabschnitt gebaut wird.
  const a = [...document.querySelectorAll('#rail .tool')].find(e => /Auswahl/i.test(e.textContent));
  if (a) a.click();
});
await page.waitForTimeout(600);

// Ausschnitt-Werkzeug waehlen und ein Polygon zeichnen
await page.evaluate(() => {
  const t = [...document.querySelectorAll('#rail .tool')].find(e => /Ausschnitt/i.test(e.textContent));
  if (t) t.click();
});
await page.waitForTimeout(400);
page.once('dialog', async d => { await d.accept('Nordmark'); });
await page.evaluate(() => { window.prompt = () => 'Nordmark'; });
await page.mouse.click(380, 300); await page.waitForTimeout(200);
await page.mouse.click(620, 300); await page.waitForTimeout(200);
await page.mouse.click(620, 470); await page.waitForTimeout(200);
await page.mouse.click(380, 470); await page.waitForTimeout(200);
await page.mouse.dblclick(380, 470);
await page.waitForTimeout(5000);

const nach = await page.evaluate(() => {
  const S = window.__terraDebug.S;
  return {
    baum: !!S.baum,
    karten: S.baum ? S.baum.karten.length : 0,
    aktiv: S.aktiveKarte,
    einheit: S.einheitMeter,
    titel: S.baum && S.baum.index[S.aktiveKarte] ? S.baum.index[S.aktiveKarte].karte.titel : null,
    eltern: S.baum && S.baum.index[S.aktiveKarte] ? S.baum.index[S.aktiveKarte].elternId : null
  };
});
melde('Kindkarte angelegt', nach.karten === 2, JSON.stringify(nach));
melde('aktiv ist die Kindkarte', nach.eltern !== null && nach.eltern !== undefined, 'Eltern: ' + nach.eltern);
melde('Massstab ist feiner geworden', nach.einheit > 0 && nach.einheit < 1, nach.einheit + ' m/Zelle');
melde('kein Seitenfehler nach dem Anlegen', fehler.length === 0, fehler.slice(0,2).join(' | '));
await page.screenshot({ path: ZIEL + '/01-kindkarte.png', timeout: 180000 });

// Panel: Brotkrume da?
await page.evaluate(() => {
  const a = [...document.querySelectorAll('#rail .tool')].find(e => /Auswahl/i.test(e.textContent));
  if (a) a.click();
});
await page.waitForTimeout(600);
const krume = await page.evaluate(() => {
  const k = document.querySelector('#panel .krume');
  return { da: !!k, text: k ? k.textContent.trim() : '',
    ueber: [...document.querySelectorAll('#panel .ph')].map(e=>e.textContent.trim()) };
});
melde('Brotkrume im Panel', krume.da, krume.text);
melde('Abschnitt „Karten"', krume.ueber.includes('Karten'), krume.ueber.join(' / '));

// Zurueck zur Wurzel springen
const zurueck = await page.evaluate(async () => {
  const l = document.querySelector('#panel .krumeLink');
  if (!l) return null;
  l.click();
  await new Promise(r => setTimeout(r, 3000));
  const S = window.__terraDebug.S;
  return { aktiv: S.aktiveKarte, einheit: S.einheitMeter,
    eltern: S.baum.index[S.aktiveKarte].elternId };
});
melde('Sprung zurueck zur Wurzel', zurueck && zurueck.eltern === null, JSON.stringify(zurueck));
melde('Massstab wieder grob', zurueck && zurueck.einheit === 1, zurueck ? zurueck.einheit : '-');
melde('kein Seitenfehler nach dem Wechsel', fehler.length === 0, fehler.slice(0,2).join(' | '));
await page.screenshot({ path: ZIEL + '/02-wurzel.png', timeout: 180000 });

// Speichern-Lade-Zyklus ueber den Baum
const zyklus = await page.evaluate(async () => {
  const S = window.__terraDebug.S;
  const kb = await import('/src/world/kartenbaum.js');
  const text = JSON.stringify(kb.schreibeBaumDatei(S.baum));
  const wieder = kb.leseBaumDatei(JSON.parse(text));
  return { laenge: text.length, karten: wieder.baum.karten.length,
    version: JSON.parse(text).version, warnungen: wieder.warnungen.length };
});
melde('Baum ueberlebt Schreib-Lese-Zyklus', zyklus.karten === 2, JSON.stringify(zyklus));
melde('Datei traegt Format v5', zyklus.version === 5, 'version ' + zyklus.version);

const n = schritte.filter(Boolean).length;
console.log('\n=== ' + n + '/' + schritte.length + ' Schritte grün ===');
if (fehler.length) { console.log('\n--- Seitenfehler ---'); fehler.slice(0,8).forEach(f=>console.log(f)); }
await browser.close();
process.exit(n === schritte.length ? 0 : 1);
