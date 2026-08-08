import pw from 'file:///C:/git/UWE/node_modules/.pnpm/playwright@1.61.0/node_modules/playwright/index.js';
const { chromium } = pw;
import { mkdirSync } from 'node:fs';
const ZIEL='C:/Users/lasse/AppData/Local/Temp/claude/C--Users-lasse/499e1b74-f718-4923-9320-275b6a5c0e6c/scratchpad/shots-sig';
mkdirSync(ZIEL,{recursive:true});
const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport:{width:1100,height:700} });
const fehler=[]; page.on('pageerror',e=>fehler.push(String(e)));
const S=[]; function melde(n,ok,z){S.push(ok);console.log((ok?'OK  ':'FEHL')+'  '+n+(z===undefined?'':'  — '+z));}
await page.goto('http://localhost:8123/index.html?schau=demo',{waitUntil:'load',timeout:90000});
const start = await page.waitForFunction(()=>window.__terraOk===true,{timeout:90000}).then(()=>true).catch(()=>false);
melde('Editor startet', start);
if(!start){fehler.slice(0,6).forEach(f=>console.log(f)); await browser.close(); process.exit(1);}
await page.waitForTimeout(4000);
melde('kein Seitenfehler beim Start', fehler.length===0, fehler.slice(0,2).join(' | '));

await page.evaluate(async () => {
  const P = window.__terraDebug.POOLS;
  const namen = Object.keys(P);
  const sig = namen.filter(n => P[n].karte);
  const s = await import('/src/render/signaturen.js');
  // Atlas wirklich zeichnen lassen
  let atlas = null, atlasFehler = null;
  try { const a = s.holeSignaturAtlas(); atlas = { breite: a.image ? a.image.width : -1, hoehe: a.image ? a.image.height : -1 }; }
  catch (e) { atlasFehler = String(e); }
  // Bandpruefung an mehreren Maszstaeben: gibt es fuer "wald" immer etwas?
  const luecken = [];
  for (const m of [0.5, 1, 4, 12, 60, 72, 200, 600, 900, 1600, 2500, 4000]) {
    for (const sache of s.SACHEN_NAMEN) {
      const dd = s.darstellungAn(sache, m);
      if (!dd) luecken.push(sache + '@' + m);
    }
  }
  return { pools: namen.length, sig: sig.length, atlas, atlasFehler,
    luecken: luecken.slice(0, 6), luecken_n: luecken.length,
    patch: window.terraPatchInfo ? window.terraPatchInfo.karte : -1,
    material: sig.length ? P[sig[0]].mat.type : null,
    band: sig.length ? [P[sig[0]].sichtbarAb, P[sig[0]].sichtbarBis] : null };
});
melde('49 Kartenzeichen registriert', d.sig === 49, d.sig + ' von ' + d.pools + ' Pools');
melde('Kartenzeichen haben ein flaches Material', d.material === 'MeshBasicMaterial', d.material);
melde('Kartenzeichen tragen ein Maszstabsband', d.band && d.band[0] >= 60, JSON.stringify(d.band));
melde('Atlas wird gezeichnet', d.atlas && d.atlas.breite === 1024, JSON.stringify(d.atlas) + (d.atlasFehler||''));
// Der Patch laeuft erst, wenn ein Zeichen tatsaechlich gerendert wird —
// onBeforeCompile feuert beim ersten Zeichnen, nicht beim Anlegen.
melde('Kartenpatch noch nicht gelaufen (erwartet)', d.patch === 0, 'karte=' + d.patch);
melde('keine Bandluecke in der Leiter', d.luecken_n === 0, d.luecken_n ? d.luecken.join(', ') : '12 Maszstaebe x alle Sachen');
melde('kein Seitenfehler nach dem Atlas', fehler.length===0, fehler.slice(0,2).join(' | '));

// Eine Signatur wirklich emittieren und im Bild sehen
const gezeichnet = await page.evaluate(async () => {
  const s = await import('/src/render/signaturen.js');
  const p = await import('/src/core/pools.js');
  const St = await import('/src/core/store.js');
  const Sx = St.S;
  const el = St.mkElement('objekt', 'baeume', [{x:0,z:0}], {}, 1);
  Sx.elements.push(el);
  const wahl = s.zeichenFuer('ort', 24, 200);
  const platz = s.signaturPlatzierung(wahl[0], { kante: 256, massstab: 200 });
  p.emit(el, wahl[0], 0, 20, 0, 0, platz.sx, platz.sy, platz.sz, platz.tint);
  p.markDirty(); p.flushPack();
  return { zeichen: wahl, instanzen: p.POOLS[wahl[0]].count, sy: platz.sy, tint: platz.tint,
    karteTotal: el.karteTotal, total: el.total };
});
melde('eine Dorfsignatur landet im Pool', gezeichnet.instanzen > 0, JSON.stringify(gezeichnet));
melde('Verblassung sitzt in sy', gezeichnet.sy > 0 && gezeichnet.sy <= 1, 'sy=' + gezeichnet.sy);
melde('eigener Zaehler greift', gezeichnet.karteTotal === 1 && gezeichnet.total === 0,
  'karteTotal=' + gezeichnet.karteTotal + ' total=' + gezeichnet.total);
melde('kein Seitenfehler nach dem Zeichnen', fehler.length===0, fehler.slice(0,2).join(' | '));
await page.waitForTimeout(4000);
const nachher = await page.evaluate(() => window.terraPatchInfo ? window.terraPatchInfo.karte : -1);
melde('Kartenpatch greift nach dem ersten Bild', nachher > 0, 'karte=' + nachher);
await page.screenshot({ path: ZIEL+'/01-signatur.png', timeout: 180000 });

const n=S.filter(Boolean).length;
console.log('\n=== '+n+'/'+S.length+' Schritte grün ===');
if(fehler.length){console.log('\n--- Seitenfehler ---');fehler.slice(0,8).forEach(f=>console.log(f));}
await browser.close(); process.exit(n===S.length?0:1);
