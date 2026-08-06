#!/usr/bin/env node
/**
 * `node tools/terra-shots/shoot.mjs` — Aufnahmelauf fuer die visuelle Abnahme.
 *
 * Startet einen statischen Server auf `terra/`, oeffnet die Seite in einem
 * kopflosen Chromium und legt fuer jede Aufnahme aus `shots.mjs` ein PNG plus
 * eine Messzeile ab. Der Lauf ist zeitdeterministisch: `performance.now()` und
 * der Zeitstempel von `requestAnimationFrame` kommen aus einer virtuellen Uhr,
 * die je Bild genau 1/60 s weiterlaeuft. Zwei Laeufe derselben Fassung liefern
 * damit dasselbe Bild — Unterschiede zwischen Vorher und Nachher stammen aus
 * der Aenderung, nicht aus der Maschinenlast.
 *
 *   node tools/terra-shots/shoot.mjs --out .terra-shots/vorher
 *   node tools/terra-shots/shoot.mjs --shots wasser,licht --out .terra-shots/nachher
 *
 * Optionen:
 *   --out DIR      Zielordner (Standard .terra-shots/lauf)
 *   --shots LISTE  Ids oder Bereiche, kommagetrennt (Standard alle)
 *   --root DIR     terra-Ordner (Standard <repo>/terra)
 *   --breite/--hoehe  Aufloesung (Standard 1600x900)
 *   --bilder N     Bilder bis zur Aufnahme (Standard 150 = 2,5 virtuelle s)
 *   --messen       zusaetzlich echte Bildzeiten messen (langsamer)
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { shotsFuer } from "./shots.mjs";

const hier = path.dirname(fileURLToPath(import.meta.url));
const repoWurzel = path.resolve(hier, "..", "..");
const require = createRequire(import.meta.url);

/* Playwright liegt im pnpm-Baum des Hauptcheckouts; ein Arbeitsbaum ohne
   eigenes node_modules borgt es sich von dort. Beide Wege werden probiert,
   damit der Lauf in Worktrees genauso funktioniert wie im Hauptbaum. */
function ladePlaywright() {
  const kandidaten = [
    () => require("playwright"),
    () => require("@playwright/test"),
    () => require(path.join(repoWurzel, "node_modules", "playwright")),
    () => require("C:/git/UWE/node_modules/@playwright/test")
  ];
  for (const k of kandidaten) {
    try { return k(); } catch { /* naechster Versuch */ }
  }
  throw new Error("Playwright nicht gefunden — `pnpm install` im Hauptcheckout?");
}

function args(argv) {
  const a = {
    out: ".terra-shots/lauf", shots: "alle", root: path.join(repoWurzel, "terra"),
    breite: 1600, hoehe: 900, bilder: 150, messen: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i], v = argv[i + 1];
    if (k === "--out" && v) { a.out = v; i += 1; }
    else if (k === "--shots" && v) { a.shots = v; i += 1; }
    else if (k === "--root" && v) { a.root = path.resolve(v); i += 1; }
    else if (k === "--breite" && v) { a.breite = Number(v); i += 1; }
    else if (k === "--hoehe" && v) { a.hoehe = Number(v); i += 1; }
    else if (k === "--bilder" && v) { a.bilder = Number(v); i += 1; }
    else if (k === "--messen") { a.messen = true; }
  }
  return a;
}

const TYPEN = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webp": "image/webp",
  ".png": "image/png", ".jpg": "image/jpeg", ".glb": "model/gltf-binary",
  ".svg": "image/svg+xml", ".wasm": "application/wasm"
};

function serve(wurzel) {
  return new Promise((fertig) => {
    const server = http.createServer((req, res) => {
      const pfad = decodeURIComponent(new URL(req.url, "http://x").pathname);
      let datei = path.join(wurzel, pfad === "/" ? "index.html" : pfad);
      if (!path.resolve(datei).startsWith(path.resolve(wurzel))) {
        res.writeHead(403).end(); return;
      }
      if (!fs.existsSync(datei) || fs.statSync(datei).isDirectory()) {
        const mitIndex = path.join(datei, "index.html");
        if (fs.existsSync(mitIndex)) datei = mitIndex;
        else { res.writeHead(404).end("nicht gefunden"); return; }
      }
      res.writeHead(200, {
        "content-type": TYPEN[path.extname(datei)] || "application/octet-stream",
        "cache-control": "no-store"
      });
      fs.createReadStream(datei).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => fertig({ server, port: server.address().port }));
  });
}

/* Virtuelle Uhr: laeuft VOR allen Seitenskripten und ersetzt die Zeitquellen
   der Renderschleife. Ohne sie haengt jedes Partikel, jede Wolke und jeder
   Windzug an der Tageslaune der Maschine — ein Vorher/Nachher-Vergleich waere
   dann Rauschen. */
const UHR = () => {
  /* Sperrt den adaptiven Leistungsregler (siehe terra/src/main.js): eine
     Aufnahme soll immer in derselben Aufloesung entstehen. */
  window.__terraAufnahme = true;
  let t = 0;
  const schritt = 1000 / 60;
  const echtesRaf = window.requestAnimationFrame.bind(window);
  let bilder = 0;
  performance.now = () => t;
  window.requestAnimationFrame = (cb) => echtesRaf(() => cb(t));
  (function takt() { t += schritt; bilder += 1; echtesRaf(takt); })();
  window.__uhr = { jetzt: () => t, bilder: () => bilder };
};

async function warteBilder(page, n) {
  await page.evaluate(async (ziel) => {
    await new Promise((fertig) => {
      let i = 0;
      (function tick() {
        if (i >= ziel) return fertig();
        i += 1;
        requestAnimationFrame(tick);
      })();
    });
  }, n);
}

async function main() {
  const a = args(process.argv.slice(2));
  const shots = shotsFuer(a.shots);
  if (!shots.length) { console.error(`Keine Aufnahme passt zu "${a.shots}".`); process.exit(2); }

  const ausgabe = path.resolve(a.out);
  fs.mkdirSync(ausgabe, { recursive: true });

  const { chromium } = ladePlaywright();
  const { server, port } = await serve(a.root);
  const basis = `http://127.0.0.1:${port}/`;

  /* `--use-angle=d3d11` ist der Unterschied zwischen Software- und echter
     GPU-Darstellung: ohne das Flag faellt kopfloses Chromium auf SwiftShader
     zurueck (nachgewiesen ueber WEBGL_debug_renderer_info) und braucht fuer
     eine volle Terra-Szene Minuten statt Sekunden je Aufnahme. Damit ist auch
     die offene Frage aus terra/README.md beantwortet: die frueheren 3-4 fps
     lagen an der Umgebung, nicht an der Szene. */
  const browser = await chromium.launch({
    args: [
      "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu-rasterization",
      "--enable-zero-copy", "--disable-lcd-text",
      "--force-color-profile=srgb", "--hide-scrollbars"
    ]
  });
  const backend = await (async () => {
    const p = await browser.newPage();
    const r = await p.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      const d = gl && gl.getExtension("WEBGL_debug_renderer_info");
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "unbekannt";
    });
    await p.close();
    return r;
  })();
  if (/SwiftShader|llvmpipe/i.test(backend)) {
    console.warn(`  ! Software-Darstellung (${backend}) — Bildzeiten sind KEIN Leistungssignal.`);
  } else {
    console.log(`  GPU: ${backend}`);
  }

  const bericht = [];
  for (const shot of shots) {
    const seite = await browser.newPage({
      viewport: { width: a.breite, height: a.hoehe }, deviceScaleFactor: 1
    });
    const fehler = [];
    seite.on("pageerror", (e) => fehler.push(String(e.message || e)));
    seite.on("console", (m) => { if (m.type() === "error") fehler.push(m.text()); });
    await seite.addInitScript(UHR);

    const eintrag = { id: shot.id, bereich: shot.bereich, titel: shot.titel, frage: shot.frage };
    try {
      await seite.goto(basis + (shot.url || ""), { waitUntil: "load", timeout: 60000 });
      await seite.waitForFunction("window.__terraOk === true", null, { timeout: 90000 });
      await warteBilder(seite, 10);

      if (shot.biom) {
        await seite.selectOption("#biomSel", shot.biom);
        await warteBilder(seite, 30);
      }
      if (shot.tod) {
        await seite.click(`button.tod[data-t="${shot.tod}"]`);
        await warteBilder(seite, 10);
      }
      if (shot.wetter) {
        await seite.selectOption("#wetterSel", shot.wetter);
        await warteBilder(seite, 20);
      }
      if (shot.rahmen) {
        await seite.evaluate(new Function(shot.rahmen));
      }
      if (!shot.bedienung) {
        await seite.addStyleTag({ content: "#ui,#hint,#stats,#toast{display:none !important}" });
      }
      if (shot.warteMs) await seite.waitForTimeout(shot.warteMs);
      await warteBilder(seite, a.bilder);

      const info = await seite.evaluate(() => {
        const d = window.__terraShot || window.__terraDebug;
        const r = d && d.getRenderInfo ? d.getRenderInfo() : null;
        return { render: r, bilder: window.__uhr ? window.__uhr.bilder() : null };
      });
      eintrag.render = info.render;

      if (a.messen) {
        /* Zwei Messungen, weil eine allein in die Irre fuehrt.
           - `ruhend`: stehende Kamera. Nutzen begrenzt, denn die Schattenkarte
             steht auf autoUpdate=false und wird ohne Bewegung NICHT neu
             gezeichnet — ein ganzer Szenendurchgang faellt weg.
           - `bewegt`: die Kamera dreht je Bild ein Stueck weiter. Das ist der
             ehrliche Fall, weil er die Schattenkarte und das Nachladen von
             Detailstufen mitbezahlt.
           Beide Werte sind nach oben durch die Bildwiederholrate begrenzt:
           requestAnimationFrame liefert nie schneller als ~16,7 ms. Ein
           Median von 17 heisst deshalb "bei oder unter 16,7", nicht "genau
           17" — deswegen steht `gedeckelt` daneben. */
        const messe = async (bewegen) => seite.evaluate(async (mitBewegung) => {
          const zeiten = [];
          await new Promise((fertig) => {
            let i = 0, vor = Date.now();
            (function tick() {
              if (mitBewegung && window.__terraShot) {
                const c = window.__terraShot.cam;
                c.tYaw = c.yaw = c.yaw + 0.004;
              }
              const jetzt = Date.now();
              if (i > 0) zeiten.push(jetzt - vor);
              vor = jetzt; i += 1;
              if (i > 90) return fertig();
              requestAnimationFrame(tick);
            })();
          });
          zeiten.sort((x, y) => x - y);
          return {
            median: zeiten[Math.floor(zeiten.length / 2)],
            p95: zeiten[Math.floor(zeiten.length * 0.95)]
          };
        }, bewegen);

        const ruhend = await messe(false);
        const bewegt = await messe(true);
        eintrag.bildzeitMs = {
          ...bewegt,
          ruhendMedian: ruhend.median,
          gedeckelt: bewegt.median <= 17
        };
      }

      const ziel = path.join(ausgabe, `${shot.id}.png`);
      await seite.screenshot({ path: ziel, type: "png" });
      eintrag.datei = path.relative(process.cwd(), ziel);
      eintrag.ok = true;
      console.log(`  ✓ ${shot.id.padEnd(20)} ${eintrag.render ? `${eintrag.render.calls} calls, ${eintrag.render.triangles} tris` : ""}`);
    } catch (e) {
      eintrag.ok = false;
      eintrag.fehler = String(e.message || e);
      console.log(`  ✗ ${shot.id.padEnd(20)} ${eintrag.fehler.split("\n")[0]}`);
    }
    if (fehler.length) eintrag.seitenfehler = [...new Set(fehler)].slice(0, 8);
    bericht.push(eintrag);
    await seite.close();
  }

  await browser.close();
  server.close();

  fs.writeFileSync(path.join(ausgabe, "bericht.json"),
    JSON.stringify({ wurzel: a.root, backend, breite: a.breite, hoehe: a.hoehe, shots: bericht }, null, 2));
  const kaputt = bericht.filter((b) => !b.ok);
  console.log(`\n${bericht.length - kaputt.length}/${bericht.length} Aufnahmen in ${path.relative(process.cwd(), ausgabe)}`);
  if (kaputt.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
