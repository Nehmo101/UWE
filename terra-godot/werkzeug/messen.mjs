#!/usr/bin/env node
/**
 * messen.mjs — die Zahlen, für die es diesen Spike gibt.
 *
 * Beantwortet drei Fragen mit Messung statt Einschätzung:
 *
 *   1. Startet der Godot-Web-Export unter UWEs **Produktions**-CSP?
 *      Die Dev-CSP trägt `'unsafe-eval'` und würde den Befund verfälschen —
 *      Godot liefe dort und in Produktion nicht. Deshalb wird die Policy hier
 *      aus `packages/auth/src/security-headers.ts` GEHOLT, nicht nachgebaut.
 *   2. Reicht `'wasm-unsafe-eval'` als kleinste Ergänzung?
 *   3. Wie viele Bilder je Sekunde schafft er — und was schafft Terra auf
 *      DERSELBEN Maschine mit derselben Kartengröße?
 *
 * Zur Einordnung der fps: In einem Container ohne GPU-Treiber rastert der
 * Browser in Software. Absolute Bildraten sind dann wertlos. Der VERGLEICH
 * bleibt gültig — beide Seiten laufen durch denselben Rasterizer, und genau
 * das ist die Frage. Welcher Rasterizer es war, steht im Bericht.
 *
 * Aufruf (aus dem Repo-Wurzelverzeichnis):
 *   node terra-godot/werkzeug/messen.mjs
 */
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const WURZEL = path.resolve(import.meta.dirname, "..", "..");
const EXPORT = path.join(WURZEL, "terra-godot", "export");
const TERRA = path.join(WURZEL, "terra");

/** Wie lange gemessen wird, nachdem das Bild steht. */
const MESSFENSTER_MS = 6000;
/** Geduld beim Laden — ein 38-MB-WASM will kompiliert werden. */
const STARTGEDULD_MS = 90000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".pck": "application/octet-stream",
  ".png": "image/png",
  ".json": "application/json",
  ".css": "text/css; charset=utf-8",
};

/**
 * Die ECHTE Produktions-CSP aus dem Repo. Über einen Unterprozess mit tsx,
 * weil die Datei TypeScript ist — ein nachgebauter String wäre genau die
 * Sorte Kopie, die still veraltet.
 */
function produktionsCsp() {
  const skript = `import { buildContentSecurityPolicy } from ${JSON.stringify(
    path.join(WURZEL, "packages/auth/src/security-headers"),
  )};
console.log(buildContentSecurityPolicy({}, { NODE_ENV: "production" }));`;
  const tmp = path.join(WURZEL, "terra-godot", "export", ".csp.mts");
  fs.writeFileSync(tmp, skript);
  try {
    return execFileSync("node", ["--import", "tsx", tmp], { encoding: "utf8" }).trim();
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function starteServer(wurzel, csp, extraHeaders = {}) {
  const server = createServer((req, res) => {
    const rein = decodeURIComponent(req.url.split("?")[0]);
    const ziel = path.join(wurzel, rein === "/" ? "index.html" : rein);
    if (!ziel.startsWith(wurzel) || !fs.existsSync(ziel) || fs.statSync(ziel).isDirectory()) {
      res.writeHead(404).end("nicht da");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(ziel)] ?? "application/octet-stream",
      "Content-Security-Policy": csp,
      ...extraHeaders,
    });
    fs.createReadStream(ziel).pipe(res);
  });
  return new Promise((fertig) => {
    server.listen(0, "127.0.0.1", () => fertig({ server, port: server.address().port }));
  });
}

/**
 * Was der Export ueber `JavaScriptBridge.get_interface` an `window` haengt.
 *
 * Bewusst EINZELNE Eigenschaften statt eines Objekts: `get_interface` reicht
 * Werte durch, ohne einen String als JavaScript auszuwerten. Der bequemere Weg
 * `JavaScriptBridge.eval` braeuchte `'unsafe-eval'` in der CSP — die breite,
 * gefaehrliche Freigabe statt der schmalen `'wasm-unsafe-eval'`. Der
 * Unterschied ist der Grund, warum dieser Spike ueberhaupt misst.
 */
const LESEN = `({
  bereit: window.__terraGodotBereit ?? false,
  fps: window.__terraGodotFps ?? 0,
  dreiecke: window.__terraGodotDreiecke ?? 0,
  vertices: window.__terraGodotVertices ?? 0,
  aufbauMs: window.__terraGodotAufbauMs ?? 0,
  renderer: window.__terraGodotRenderer ?? "unbekannt",
})`;

/** Godot-Export laden und messen. Gibt auch zurück, WORAN es scheiterte. */
async function messeGodot(browser, port) {
  const seite = await browser.newPage();
  const meldungen = [];
  seite.on("console", (m) => {
    if (m.type() === "error") meldungen.push(m.text());
  });
  seite.on("pageerror", (f) => meldungen.push(String(f)));

  await seite.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded" });

  // Abfragen statt `waitForFunction`: der Wartehelfer wertet sein Praedikat
  // im Seitenkontext aus und faellt damit unter dieselbe CSP, die hier gerade
  // GEGENSTAND der Messung ist — er meldete "nicht gestartet", waehrend die
  // Seite laengst lief. `evaluate` geht ueber das Debug-Protokoll daran vorbei.
  let bereit = false;
  const frist = Date.now() + STARTGEDULD_MS;
  while (Date.now() < frist) {
    const stand = await seite.evaluate(LESEN).catch(() => null);
    if (stand?.bereit === true) {
      bereit = true;
      break;
    }
    await seite.waitForTimeout(2000);
  }

  if (!bereit) {
    const stand = await seite.evaluate(LESEN).catch(() => null);
    await seite.close();
    return { bereit: false, meldungen: meldungen.slice(0, 6), stand };
  }

  await seite.waitForTimeout(MESSFENSTER_MS);
  const werte = await seite.evaluate(LESEN);
  await seite.close();
  return { bereit: true, ...werte, meldungen: meldungen.slice(0, 6) };
}

/**
 * Terra messen — ohne terra/ anzufassen. Die Bildrate wird von außen über
 * `requestAnimationFrame` gezählt; das misst genau die Frequenz, mit der die
 * Seite tatsächlich neu zeichnet.
 */
async function messeTerra(browser, port) {
  const seite = await browser.newPage();
  const meldungen = [];
  seite.on("console", (m) => {
    if (m.type() === "error") meldungen.push(m.text());
  });
  seite.on("pageerror", (f) => meldungen.push(String(f)));

  await seite.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load" });

  // Terra braucht einen Moment, bis Pools und Terrain stehen.
  await seite.waitForTimeout(8000);

  const werte = await seite.evaluate(`new Promise((fertig) => {
    let bilder = 0;
    const start = performance.now();
    function tick() {
      bilder++;
      if (performance.now() - start < ${MESSFENSTER_MS}) requestAnimationFrame(tick);
      else {
        const gl = document.querySelector("canvas")?.getContext("webgl2")
                || document.querySelector("canvas")?.getContext("webgl");
        const dbg = gl && gl.getExtension("WEBGL_debug_renderer_info");
        fertig({
          fps: bilder / ((performance.now() - start) / 1000),
          renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "unbekannt",
          canvas: !!document.querySelector("canvas"),
        });
      }
    }
    requestAnimationFrame(tick);
  })`);

  await seite.close();
  return { ...werte, meldungen: meldungen.slice(0, 6) };
}

/* ------------------------------------------------------------------ Lauf */

if (!fs.existsSync(path.join(EXPORT, "index.wasm"))) {
  console.error("Kein Web-Export gefunden. Erst exportieren:");
  console.error('  <godot> --headless --path terra-godot --export-release "Web" export/index.html');
  process.exit(2);
}

const CSP_PROD = produktionsCsp();
const CSP_WASM = CSP_PROD.replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'");

console.log("Produktions-CSP aus packages/auth/src/security-headers.ts:");
console.log("  " + CSP_PROD);
console.log("");

/**
 * Der vorinstallierte Chromium. Playwrights mitgelieferte Fassungsnummer passt
 * nicht immer zu dem, was im Bild liegt — dann sucht `launch()` an einem Pfad,
 * den es nicht gibt. Ein `playwright install` waere hier der falsche Weg
 * (Download, andere Fassung, andere Zahlen). Stattdessen der Browser, der da
 * ist; er zaehlt ohnehin fuer beide Seiten der Messung gleich.
 */
const CHROMIUM = process.env.UWE_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROMIUM) ? CHROMIUM : undefined,
  // Software-Rasterizer erlauben: im Container gibt es keinen GPU-Treiber, und
  // ein Browser, der dann gar nicht zeichnet, misst nichts.
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=swiftshader"],
});
const ergebnis = {};

// --- 1. Godot unter der unveraenderten Produktions-CSP -------------------
{
  const { server, port } = await starteServer(EXPORT, CSP_PROD);
  console.log("1) Godot unter der unveraenderten Produktions-CSP …");
  ergebnis.godotProd = await messeGodot(browser, port);
  console.log(ergebnis.godotProd.bereit ? "   gestartet" : "   NICHT gestartet");
  for (const m of ergebnis.godotProd.meldungen ?? []) console.log("   ! " + m.slice(0, 160));
  server.close();
}

// --- 2. Godot mit 'wasm-unsafe-eval' ------------------------------------
{
  const { server, port } = await starteServer(EXPORT, CSP_WASM);
  console.log("");
  console.log("2) Godot mit zusaetzlichem 'wasm-unsafe-eval' …");
  ergebnis.godotWasm = await messeGodot(browser, port);
  if (ergebnis.godotWasm.bereit) {
    console.log(
      `   gestartet — ${ergebnis.godotWasm.fps.toFixed(1)} fps, ` +
        `${ergebnis.godotWasm.dreiecke} Dreiecke, Aufbau ${ergebnis.godotWasm.aufbauMs} ms`,
    );
    console.log(`   Renderer: ${ergebnis.godotWasm.renderer}`);
  } else {
    console.log("   NICHT gestartet");
    for (const m of ergebnis.godotWasm.meldungen ?? []) console.log("   ! " + m.slice(0, 160));
  }
  server.close();
}

// --- 3. Terra zum Vergleich, gleiche Maschine ---------------------------
{
  const { server, port } = await starteServer(TERRA, CSP_PROD);
  console.log("");
  console.log("3) Terra unter derselben CSP, dieselbe Maschine …");
  ergebnis.terra = await messeTerra(browser, port);
  console.log(`   ${ergebnis.terra.fps.toFixed(1)} fps, Renderer: ${ergebnis.terra.renderer}`);
  for (const m of ergebnis.terra.meldungen ?? []) console.log("   ! " + m.slice(0, 160));
  server.close();
}

await browser.close();

fs.writeFileSync(
  path.join(WURZEL, "terra-godot", "export", "messung.json"),
  JSON.stringify({ cspProd: CSP_PROD, ...ergebnis }, null, 2),
);
console.log("");
console.log("Rohwerte: terra-godot/export/messung.json");
