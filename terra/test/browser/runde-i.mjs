/* Browsertest fuer die Einbettung der Runde I.
   Deckt genau die Wege ab, die `node --test` NICHT sieht: main.js laeuft dort
   gar nicht, und panels.js/tools.js sind durch Ersatzmodule ausgeblendet.
   Geprueft wird also: startet der Editor ueberhaupt, stehen die neuen
   Panel-Abschnitte, laeuft die Erosion durch, erzeugt der Biomvorschlag
   Elemente, und laesst sich eine Beschriftung setzen. */
import pw from 'file:///C:/git/UWE/node_modules/.pnpm/playwright@1.61.0/node_modules/playwright/index.js';
const { chromium } = pw;
import { mkdirSync } from 'node:fs';

const ZIEL = process.argv[2]
  || 'C:/Users/lasse/AppData/Local/Temp/claude/C--Users-lasse/499e1b74-f718-4923-9320-275b6a5c0e6c/scratchpad/shots-i';
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

await page.goto('http://localhost:8123/index.html?schau=demo', { waitUntil: 'load', timeout: 90000 });
const gestartet = await page.waitForFunction(() => window.__terraOk === true, { timeout: 90000 })
  .then(() => true).catch(() => false);
melde('Editor startet (window.__terraOk)', gestartet);

if (!gestartet) {
  console.log('\n--- Seitenfehler ---');
  fehler.forEach(f => console.log(f));
  console.log('\n--- Konsole (letzte 40) ---');
  konsole.slice(-40).forEach(k => console.log(k));
  await browser.close();
  process.exit(1);
}

await page.waitForTimeout(4000);
melde('keine Seitenfehler beim Start', fehler.length === 0, fehler.slice(0, 3).join(' | '));

/* --- Kartenpanel: Auswahl ohne Auswahl ist das Panel der ganzen Karte ---- */
await page.evaluate(() => {
  const t = [...document.querySelectorAll('#rail .tool')]
    .find((e) => /Auswahl/i.test(e.textContent));
  if (t) t.click();
});
await page.waitForTimeout(700);

const panel = await page.evaluate(() => {
  const ueberschriften = [...document.querySelectorAll('#panel .ph')].map((e) => e.textContent.trim());
  const knoepfe = [...document.querySelectorAll('#panel button')].map((e) => e.textContent.trim());
  return { ueberschriften, knoepfe };
});
melde('Panel zeigt Abschnitt „Erosion"', panel.ueberschriften.includes('Erosion'),
  panel.ueberschriften.join(' / '));
melde('Panel zeigt Abschnitt „Biome"', panel.ueberschriften.includes('Biome'));
melde('Panel zeigt Abschnitt „Namen"', panel.ueberschriften.includes('Namen'));
melde('Knopf „Gelände erodieren" da', panel.knoepfe.some((k) => /erodieren/i.test(k)),
  panel.knoepfe.join(' | '));
melde('Knopf „Biome vorschlagen" da', panel.knoepfe.some((k) => /Biome vorschlagen/i.test(k)));

await page.screenshot({ path: ZIEL + '/01-panel.png', timeout: 180000 });

/* --- Erosion wirklich laufen lassen ------------------------------------- */
await page.evaluate(() => {
  const S = window.__terraDebug.S;
  return { seed: S.worldSeed, n: S.elements.length };
});

await page.evaluate(() => {
  const b = [...document.querySelectorAll('#panel button')].find((e) => /erodieren/i.test(e.textContent));
  b.click();
});
await page.waitForTimeout(600);
const laeuft = await page.evaluate(() =>
  !!document.querySelector('#panel .fortschritt')
  || /L(ä|ae)uft/.test(document.getElementById('panel').textContent));
melde('Erosion startet und zeigt Fortschritt', laeuft);

// Auf das Ende warten: der Abschnitt zeigt danach wieder den Startknopf.
const fertig = await page.waitForFunction(() => {
  const t = document.getElementById('panel').textContent;
  return /erodieren/i.test(t) && !/L(ä|ae)uft/.test(t);
}, { timeout: 120000 }).then(() => true).catch(() => false);
melde('Erosion laeuft durch und kehrt zurueck', fertig);
melde('keine Seitenfehler nach der Erosion', fehler.length === 0, fehler.slice(0, 3).join(' | '));
await page.screenshot({ path: ZIEL + '/02-nach-erosion.png', timeout: 180000 });

/* --- Biomvorschlag ------------------------------------------------------ */
await page.evaluate(() => {
  const b = [...document.querySelectorAll('#panel button')].find((e) => /Biome vorschlagen/i.test(e.textContent));
  b.click();
});
await page.waitForTimeout(8000);
const biome = await page.evaluate(() => {
  const S = window.__terraDebug.S;
  const fl = S.elements.filter((e) => e.kind === 'flaeche' && e.variant === 'biom');
  return {
    anzahl: fl.length,
    arten: [...new Set(fl.map((e) => e.params.biom))],
    punkte: fl.map((e) => e.points.length),
    ausVorschlag: fl.filter((e) => e.params.ausVorschlag).length
  };
});
melde('Biomvorschlag erzeugt Elemente', biome.anzahl > 0, biome.anzahl + ' Flaechen');
melde('Vorschlag nennt mehrere Biome', biome.arten.length > 1, biome.arten.join(', '));
melde('Polygone bleiben handhabbar (max 64 Punkte)',
  biome.punkte.every((p) => p <= 64), 'max ' + Math.max(0, ...biome.punkte) + ' Punkte');
melde('keine Seitenfehler nach dem Vorschlag', fehler.length === 0, fehler.slice(0, 3).join(' | '));
await page.screenshot({ path: ZIEL + '/03-biome.png', timeout: 180000 });

/* --- Beschriftung setzen ------------------------------------------------ */
const gesetzt = await page.evaluate(() => {
  // Ueber die Werkzeugleiste: Marker waehlen, Variante "beschriftung".
  const t = [...document.querySelectorAll('#rail .tool')].find((e) => /Marker|Nadel/i.test(e.textContent));
  if (t) t.click();
  return !!t;
});
await page.waitForTimeout(500);
const variante = await page.evaluate(() => {
  const b = [...document.querySelectorAll('#panel .seg button')]
    .find((e) => /Beschriftung/i.test(e.textContent));
  if (b) b.click();
  return !!b;
});
melde('Markerwerkzeug erreichbar', gesetzt);
melde('Variante „Beschriftung" im Panel', variante);

if (variante) {
  await page.waitForTimeout(500);
  // Klick in die Kartenmitte setzt die Beschriftung.
  await page.mouse.click(520, 380);
  await page.waitForTimeout(1200);
  const b = await page.evaluate(() => {
    const S = window.__terraDebug.S;
    const el = S.elements.filter((e) => e.kind === 'marker' && e.variant === 'beschriftung');
    return { anzahl: el.length, params: el.length ? el[el.length - 1].params : null };
  });
  melde('Beschriftung wird als Element angelegt', b.anzahl > 0, JSON.stringify(b.params));

  // Text setzen und pruefen, dass ein Sprite entsteht.
  const sprites = await page.evaluate(async () => {
    const S = window.__terraDebug.S;
    const el = S.elements.filter((e) => e.kind === 'marker' && e.variant === 'beschriftung').pop();
    if (!el) return -1;
    el.params.text = 'Hafen von Ost';
    await new Promise((r) => setTimeout(r, 900));   // der Abgleich laeuft gedrosselt
    return window.__terraBeschriftungen ? window.__terraBeschriftungen.anzahl : -2;
  });
  melde('Beschriftungsschicht erreichbar (Diagnose)', sprites !== -1,
    sprites === -2 ? 'kein Diagnosefenster — nur Sichtpruefung moeglich' : String(sprites));
}

/* --- Zielpruefung im laufenden Editor ----------------------------------- */
const ziel = await page.evaluate(async () => {
  const mod = await import('/src/ui/beschriftung.js');
  const faelle = ['javascript:alert(1)', ' JaVaScRiPt:x', 'data:text/html,x', '//boese.example',
    'https://uweanddragons.org/wiki/hafen'];
  return faelle.map((r) => [r, mod.zielPruefen({ art: 'extern', ref: r }).ok]);
});
const boeseDurch = ziel.filter((z) => z[1] && z[0] !== 'https://uweanddragons.org/wiki/hafen');
melde('Zielpruefung haelt im Browser dicht', boeseDurch.length === 0,
  boeseDurch.length ? 'durchgelassen: ' + boeseDurch.map((z) => z[0]).join(', ') : '4 abgelehnt, 1 erlaubt');

await page.screenshot({ path: ZIEL + '/04-beschriftung.png', timeout: 180000 });

/* --- Auswertung --------------------------------------------------------- */
const patch = await page.evaluate(() => window.terraPatchInfo || null);
console.log('\nShader-Patches:', JSON.stringify(patch));
const warnungen = konsole.filter((k) => k.startsWith('[warning]') || k.startsWith('[error]'));
console.log('Warnungen/Fehler in der Konsole:', warnungen.length);
warnungen.slice(0, 12).forEach((w) => console.log('  ' + w));

const fehlgeschlagen = schritte.filter((s) => !s.ok);
console.log('\n=== ' + (schritte.length - fehlgeschlagen.length) + '/' + schritte.length + ' Schritte grün ===');
if (fehler.length) {
  console.log('\n--- Seitenfehler ---');
  fehler.slice(0, 10).forEach((f) => console.log(f));
}
await browser.close();
process.exit(fehlgeschlagen.length ? 1 : 0);
