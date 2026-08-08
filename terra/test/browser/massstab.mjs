import pw from 'file:///C:/git/UWE/node_modules/.pnpm/playwright@1.61.0/node_modules/playwright/index.js';
const { chromium } = pw;
import { mkdirSync } from 'node:fs';
const ZIEL='C:/Users/lasse/AppData/Local/Temp/claude/C--Users-lasse/499e1b74-f718-4923-9320-275b6a5c0e6c/scratchpad/shots-mst';
mkdirSync(ZIEL,{recursive:true});
const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1100,height:700} });
const fehler=[]; page.on('pageerror',e=>fehler.push(String(e)));
const S=[]; function melde(n,ok,z){S.push(ok);console.log((ok?'OK  ':'FEHL')+'  '+n+(z===undefined?'':'  — '+z));}
await page.goto('http://localhost:8123/index.html?schau=demo',{waitUntil:'load',timeout:90000});
await page.waitForFunction(()=>window.__terraOk===true,{timeout:90000});
await page.waitForTimeout(4000);
melde('Editor startet ohne Fehler', fehler.length===0, fehler.slice(0,2).join(' | '));

// Eine Welt wuerfeln, dann den Maszstab hochdrehen und neu aufbauen.
const r = await page.evaluate(async () => {
  const St = await import('/src/core/store.js');
  const d = await import('/src/core/dirty.js');
  const p = await import('/src/core/pools.js');
  const w = await import('/src/generators/welt.js');
  const Sx = St.S;
  const zaehle = () => {
    let koerper = 0, zeichen = 0;
    for (const n of Object.keys(p.POOLS)) {
      const c = p.POOLS[n].count || 0;
      if (p.POOLS[n].karte) zeichen += c; else koerper += c;
    }
    return { koerper, zeichen };
  };
  const liste = w.erzeugeWelt(Sx.worldSeed, {});
  St.hydrate(liste);
  Sx.einheitMeter = 1;
  d.rebuildAll(); p.flushPack();
  const ort = zaehle();
  const kennzahlen = Sx.elements.filter(e => e.variant === 'viertel').map(e => e.kennzahl);

  Sx.einheitMeter = 250;          // Regionsmaszstab
  d.rebuildAll(); p.flushPack();
  const region = zaehle();

  Sx.einheitMeter = 2000;         // Kontinentmaszstab
  d.rebuildAll(); p.flushPack();
  const kontinent = zaehle();

  // Welche Zeichen sind es?
  const welche = {};
  for (const n of Object.keys(p.POOLS)) if (p.POOLS[n].karte && p.POOLS[n].count) welche[n] = p.POOLS[n].count;
  return { ort, region, kontinent, kennzahlen, welche, elemente: Sx.elements.length };
});
melde('Ortsmaszstab: Koerper, keine Zeichen', r.ort.koerper > 500 && r.ort.zeichen === 0, JSON.stringify(r.ort));
melde('Kennzahl je Siedlung gesetzt', r.kennzahlen.length > 0 && r.kennzahlen.every(k => k > 0),
  'Baukoerper: ' + r.kennzahlen.join(', '));
melde('Regionsmaszstab: Zeichen statt Koerper', r.region.zeichen > 0 && r.region.koerper === 0, JSON.stringify(r.region));
melde('Kontinentmaszstab: weiter Zeichen', r.kontinent.zeichen > 0, JSON.stringify(r.kontinent));
melde('mehrere verschiedene Zeichen', Object.keys(r.welche).length > 1, JSON.stringify(r.welche));
melde('kein Seitenfehler', fehler.length===0, fehler.slice(0,3).join(' | '));
await page.waitForTimeout(4000);
await page.screenshot({ path: ZIEL+'/01-kontinent.png', timeout: 180000 });
const n=S.filter(Boolean).length;
console.log('\n=== '+n+'/'+S.length+' Schritte grün ===');
if(fehler.length){fehler.slice(0,6).forEach(f=>console.log(f));}
await browser.close(); process.exit(n===S.length?0:1);
