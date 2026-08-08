/* ==========================================================================
   Browserprüfung — die Brücke im echten Rahmen (J1)

   `node --test terra/test` prüft die Brücke gegen ein selbstgebautes Fenster.
   Das ist schnell und deckt die Regeln ab, aber nicht die NAHT: ob io.js seine
   Wege wirklich anmeldet, ob der Bereitschaftsgruß beim Elternteil ankommt, ob
   eine hereingereichte Karte den ganzen Ladeweg durchläuft und ob eine echte
   Bedienung eine Änderungsmeldung auslöst.

   Aufbau: eine Elternseite auf DERSELBEN Herkunft wie Terra (sonst greift der
   origin-Vergleich). Sie wird nicht in den Baum gelegt, sondern von Playwright
   auf die Herkunft des Servers eingeblendet — eine Datei unter terra/ wäre
   Testwerkzeug am falschen Ort.

   Voraussetzung: statischer Server auf terra/, Port 8123 (siehe README.md).
   Aufruf:  node test/browser/bruecke.mjs      (Exitcode 0 = alles grün)
   ========================================================================== */
import pw from 'file:///C:/git/UWE/node_modules/.pnpm/playwright@1.61.0/node_modules/playwright/index.js';
const { chromium } = pw;

const BASIS = 'http://localhost:8123';
const ELTERN_URL = BASIS + '/__brueckenprobe.html';

/* Die Elternseite: hält den Frame und schreibt jede Nachricht mit. Sie ist
   bewusst so knapp wie die echten Komponenten — sie prüft Herkunft UND
   Absender und sendet an location.origin, nie an "*". */
function elternSeite(query) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Brueckenprobe</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style></head><body>
<iframe id="rahmen" src="/index.html${query}"></iframe>
<script>
window.__probe = { empfangen: [], gesendet: [] };
var rahmen = document.getElementById('rahmen');
window.addEventListener('message', function (ev) {
  if (ev.origin !== window.location.origin) return;
  if (ev.source !== rahmen.contentWindow) return;
  window.__probe.empfangen.push(ev.data);
});
window.__sende = function (nachricht) {
  window.__probe.gesendet.push(nachricht);
  rahmen.contentWindow.postMessage(nachricht, window.location.origin);
};
</script></body></html>`;
}

const schritte = [];
function melde(name, ok, zusatz) {
  schritte.push(ok);
  console.log((ok ? 'OK  ' : 'FEHL') + '  ' + name + (zusatz === undefined ? '' : '  — ' + zusatz));
}

/** Eine v5-Datei mit zwei Karten — so sieht ein echter Kartenbaum aus. */
function baumDatei() {
  const wurzel = {
    id: 'k0', elternId: null, titel: 'Probewurzel', einheitMeter: 1, hoehenQuelle: 'eigen',
    format: 'terra', version: 4, seed: 4711, tageszeit: 'mittag', raster: false,
    kartenGroesse: 256, biom: 'schnee', elemente: [], hoehenDelta: [], seedZaehler: 0,
  };
  return { format: 'terra', version: 5, wurzel: 'k0', karten: [wurzel] };
}

async function baueSeite(browser, query) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(String(e)));
  await page.route('**/__brueckenprobe.html', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: elternSeite(query) }),
  );
  await page.goto(ELTERN_URL, { waitUntil: 'load', timeout: 90000 });
  return { page, fehler };
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

/* ---------------------------------------------------------------- Bearbeiten */
{
  const { page, fehler } = await baueSeite(browser, '?schau=demo');
  const rahmen = page.frameLocator('#rahmen');
  void rahmen;

  const gestartet = await page
    .waitForFunction(() => {
      const f = document.getElementById('rahmen');
      return f && f.contentWindow && f.contentWindow.__terraOk === true;
    }, { timeout: 90000 })
    .then(() => true).catch(() => false);
  melde('Terra startet im Rahmen', gestartet);
  if (!gestartet) { fehler.slice(0, 5).forEach((f) => console.log(f)); await browser.close(); process.exit(1); }

  const bereit = await page
    .waitForFunction(() => window.__probe.empfangen.some((n) => n && n.typ === 'terra-bereit'), { timeout: 30000 })
    .then(() => true).catch(() => false);
  melde('terra-bereit kommt beim Elternteil an', bereit);

  const gruss = await page.evaluate(() => window.__probe.empfangen.find((n) => n.typ === 'terra-bereit'));
  melde('Gruss nennt Protokoll und Modus', bereit && gruss.protokoll === 1 && gruss.modus === 'bearbeiten',
    JSON.stringify(gruss));

  // Karte hineinreichen und pruefen, dass der GANZE Ladeweg gelaufen ist.
  await page.evaluate((daten) => window.__sende({ typ: 'karte-laden', daten: daten, version: 12 }), baumDatei());
  await page.waitForTimeout(3000);

  const drin = await page.evaluate(() => {
    const w = document.getElementById('rahmen').contentWindow;
    const S = w.__terraDebug && w.__terraDebug.S;
    return S ? { seed: S.worldSeed, biom: S.biom, baum: !!S.baum, aktiv: S.aktiveKarte,
      titel: S.baum ? S.baum.index[S.aktiveKarte].karte.titel : null } : null;
  });
  melde('die Karte ist wirklich uebernommen (Seed, Biom, Baum)',
    !!drin && drin.seed === 4711 && drin.biom === 'schnee' && drin.baum && drin.titel === 'Probewurzel',
    JSON.stringify(drin));

  melde('das Laden allein meldet nichts zurueck',
    await page.evaluate(() => !window.__probe.empfangen.some((n) => n.typ === 'karte-geaendert')));

  // Eine echte Bedienung: Seed umsetzen ueber die Leiste im Rahmen.
  await page.evaluate(() => {
    const w = document.getElementById('rahmen').contentWindow;
    const d = w.document;
    d.getElementById('seed').value = '90210';
    d.getElementById('seedApply').click();
    // Der Zeitgeber der Bruecke haengt an einem Bedienreiz am Fenster.
    w.dispatchEvent(new w.Event('pointerup', { bubbles: true }));
  });
  const gemeldet = await page
    .waitForFunction(() => window.__probe.empfangen.some((n) => n && n.typ === 'karte-geaendert'), { timeout: 20000 })
    .then(() => true).catch(() => false);
  melde('eine Bedienung loest entprellt karte-geaendert aus', gemeldet);

  const nachricht = await page.evaluate(() =>
    window.__probe.empfangen.filter((n) => n.typ === 'karte-geaendert').slice(-1)[0]);
  melde('die Meldung traegt Version und Kartenbaum',
    gemeldet && nachricht.version === 12 && nachricht.daten && nachricht.daten.version === 5
      && Array.isArray(nachricht.daten.karten) && nachricht.daten.karten[0].seed === 90210,
    gemeldet ? 'version=' + nachricht.version + ' seed=' + nachricht.daten.karten[0].seed : '—');

  // Bestaetigung heben lassen und erneut aendern.
  await page.evaluate(() => window.__sende({ typ: 'stand-bestaetigt', version: 13 }));
  await page.evaluate(() => {
    const w = document.getElementById('rahmen').contentWindow;
    w.document.getElementById('seed').value = '4242';
    w.document.getElementById('seedApply').click();
    w.dispatchEvent(new w.Event('pointerup', { bubbles: true }));
  });
  const zweite = await page
    .waitForFunction(() => window.__probe.empfangen.filter((n) => n.typ === 'karte-geaendert').length >= 2,
      { timeout: 20000 }).then(() => true).catch(() => false);
  const letzte = await page.evaluate(() =>
    window.__probe.empfangen.filter((n) => n.typ === 'karte-geaendert').slice(-1)[0]);
  melde('stand-bestaetigt hebt die Version der naechsten Meldung', zweite && letzte.version === 13,
    zweite ? 'version=' + letzte.version : '—');

  // Eine kaputte Karte darf den Editor NICHT anfassen.
  await page.evaluate(() => window.__sende({ typ: 'karte-laden', daten: { unfug: true }, version: 99 }));
  await page.waitForTimeout(1200);
  const stand = await page.evaluate(() => {
    const w = document.getElementById('rahmen').contentWindow;
    return { seed: w.__terraDebug.S.worldSeed,
      fehler: window.__probe.empfangen.filter((n) => n.typ === 'terra-fehler').length };
  });
  melde('eine unlesbare Karte meldet terra-fehler und laesst den Stand stehen',
    stand.fehler === 1 && stand.seed === 4242, JSON.stringify(stand));

  melde('kein Seitenfehler im ganzen Durchlauf', fehler.length === 0, fehler.slice(0, 2).join(' | '));
  await page.close();
}

/* -------------------------------------------------------------------- Lesen */
{
  const { page, fehler } = await baueSeite(browser, '?schau=demo&modus=lesen');
  const gestartet = await page
    .waitForFunction(() => {
      const f = document.getElementById('rahmen');
      return f && f.contentWindow && f.contentWindow.__terraOk === true;
    }, { timeout: 90000 })
    .then(() => true).catch(() => false);
  melde('Terra startet im Lesemodus', gestartet);
  if (gestartet) {
    await page.waitForFunction(() => window.__probe.empfangen.some((n) => n && n.typ === 'terra-bereit'),
      { timeout: 30000 }).catch(() => {});
    const gruss = await page.evaluate(() => window.__probe.empfangen.find((n) => n.typ === 'terra-bereit'));
    melde('der Gruss nennt den Lesemodus', !!gruss && gruss.modus === 'lesen', JSON.stringify(gruss));

    const sicht = await page.evaluate(() => {
      const d = document.getElementById('rahmen').contentWindow.document;
      const s = (id) => {
        const el = d.getElementById(id);
        return el ? d.defaultView.getComputedStyle(el).display : 'fehlt';
      };
      return { rail: s('rail'), panel: s('panel'), bar: s('bar'), body: d.body.getAttribute('data-terra-modus') };
    });
    melde('Rail, Panel und Leiste sind ausgeblendet',
      sicht.rail === 'none' && sicht.panel === 'none' && sicht.bar === 'none', JSON.stringify(sicht));
    melde('<body> traegt das Merkmal data-terra-modus="lesen"', sicht.body === 'lesen');

    await page.evaluate((daten) => window.__sende({ typ: 'karte-laden', daten: daten, version: 5 }), baumDatei());
    await page.waitForTimeout(2500);
    const drin = await page.evaluate(() => document.getElementById('rahmen').contentWindow.__terraDebug.S.worldSeed);
    melde('die Karte kommt auch im Lesemodus herein', drin === 4711, 'seed=' + drin);

    await page.evaluate(() => {
      const w = document.getElementById('rahmen').contentWindow;
      w.document.getElementById('seed').value = '1';
      w.document.getElementById('seedApply').click();
      w.dispatchEvent(new w.Event('pointerup', { bubbles: true }));
    });
    await page.waitForTimeout(3000);
    melde('aus dem Lesemodus geht NIE eine Aenderung hinaus',
      await page.evaluate(() => !window.__probe.empfangen.some((n) => n.typ === 'karte-geaendert')));
    melde('kein Seitenfehler im Lesemodus', fehler.length === 0, fehler.slice(0, 2).join(' | '));
  }
  await page.close();
}

/* --------------------------------------------------------- Ohne Rahmen ---- */
/* Die wichtigste Zusage: Terra allein aufgerufen verhaelt sich wie vorher.
   Kein Rahmen heisst keine Bruecke — kein Zuhoerer, kein Zeitgeber, nichts
   ausgeblendet. Das ist der Doppelklick-Fall, nur ueber einen Server. */
{
  const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(String(e)));
  await page.goto(BASIS + '/index.html?schau=demo', { waitUntil: 'load', timeout: 90000 });
  const gestartet = await page.waitForFunction(() => window.__terraOk === true, { timeout: 90000 })
    .then(() => true).catch(() => false);
  melde('Terra startet auch ohne Rahmen', gestartet);
  if (gestartet) {
    await page.waitForTimeout(2500);
    const sicht = await page.evaluate(() => ({
      rail: getComputedStyle(document.getElementById('rail')).display,
      bar: getComputedStyle(document.getElementById('bar')).display,
      merkmal: document.body.getAttribute('data-terra-modus'),
      eigenerRahmen: window.parent === window,
    }));
    melde('Leiste und Rail bleiben sichtbar, kein Lesemodus-Merkmal',
      sicht.eigenerRahmen && sicht.rail !== 'none' && sicht.bar !== 'none' && sicht.merkmal === null,
      JSON.stringify(sicht));
    melde('kein Seitenfehler ohne Rahmen', fehler.length === 0, fehler.slice(0, 2).join(' | '));
  }
  await page.close();
}

await browser.close();
const fehlgeschlagen = schritte.filter((s) => !s).length;
console.log('\n' + (schritte.length - fehlgeschlagen) + '/' + schritte.length + ' Schritte gruen');
process.exit(fehlgeschlagen === 0 ? 0 : 1);
