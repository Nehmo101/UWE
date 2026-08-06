#!/usr/bin/env node
/**
 * `node tools/terra-shots/duell.mjs` — Blindvergleich.
 *
 * Legt eine terra-Aufnahme und ein Referenzbild (Anno 117 oder ein Standbild
 * aus der offenen Ghibli-Galerie) als „A" und „B" nebeneinander in EIN Bild.
 * Welche Seite welche ist, entscheidet ein Wurf und steht ausschliesslich in
 * der Schluesseldatei — das Montagebild selbst traegt keinen Hinweis.
 *
 * Der Kritiker sieht nur die Montage und nennt eine Seite. Erst der Aufrufer
 * loest ueber den Schluessel auf, ob damit terra oder die Referenz gewonnen
 * hat. Ohne diese Trennung waere das Urteil wertlos: wer weiss, welches Bild
 * das eigene ist, findet es besser.
 *
 *   node tools/terra-shots/duell.mjs --terra a.png --ref b.jpg \
 *     --out duell.png --schluessel duell.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const hier = path.dirname(fileURLToPath(import.meta.url));
const repoWurzel = path.resolve(hier, "..", "..");
const require = createRequire(import.meta.url);

function ladePlaywright() {
  for (const k of [
    () => require("playwright"),
    () => require("@playwright/test"),
    () => require(path.join(repoWurzel, "node_modules", "playwright")),
    () => require("C:/git/UWE/node_modules/@playwright/test")
  ]) { try { return k(); } catch { /* weiter */ } }
  throw new Error("Playwright nicht gefunden.");
}

/**
 * Loest die passende Referenz zu einer Aufnahme auf. Ohne diese Zuordnung
 * landet schnell ein roemischer Marktplatz gegen eine Landschaftsweite im
 * Vergleich — der Blindvergleich misst dann Motivwahl statt Bildqualitaet.
 * `quelle` waehlt "anno" (technische Messlatte) oder "ghibli" (Malwirkung).
 */
export function referenzFuer(shotId, quelle = "anno", nummer = 0) {
  const katalogDatei = path.join(repoWurzel, ".terra-refs", "katalog.json");
  if (!fs.existsSync(katalogDatei)) return null;
  const katalog = JSON.parse(fs.readFileSync(katalogDatei, "utf8"));
  const treffer = katalog.empfehlung && katalog.empfehlung[shotId];
  if (!treffer || !treffer[quelle] || !treffer[quelle].length) return null;
  const liste = treffer[quelle];
  return path.join(repoWurzel, ".terra-refs", liste[nummer % liste.length]);
}

function args(argv) {
  const a = { terra: null, ref: null, out: "duell.png", schluessel: null, wurf: null, breite: 1500 };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i], v = argv[i + 1];
    if (k === "--terra" && v) { a.terra = path.resolve(v); i += 1; }
    else if (k === "--ref" && v) { a.ref = path.resolve(v); i += 1; }
    else if (k === "--shot" && v) { a.shot = v; i += 1; }
    else if (k === "--quelle" && v) { a.quelle = v; i += 1; }
    else if (k === "--out" && v) { a.out = path.resolve(v); i += 1; }
    else if (k === "--schluessel" && v) { a.schluessel = path.resolve(v); i += 1; }
    else if (k === "--wurf" && v) { a.wurf = Number(v); i += 1; }
    else if (k === "--breite" && v) { a.breite = Number(v); i += 1; }
  }
  return a;
}

function datenUri(datei) {
  const typ = path.extname(datei).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
  return `data:${typ};base64,${fs.readFileSync(datei).toString("base64")}`;
}

export async function duell({ terra, ref, out, schluessel, wurf, breite = 1500 }) {
  if (!fs.existsSync(terra)) throw new Error(`terra-Aufnahme fehlt: ${terra}`);
  if (!fs.existsSync(ref)) throw new Error(`Referenz fehlt: ${ref}`);
  const links = (Number.isFinite(wurf) ? wurf : Math.floor(Math.random() * 2)) % 2 === 0
    ? "terra" : "referenz";
  const seiten = links === "terra"
    ? [{ marke: "A", quelle: terra, was: "terra" }, { marke: "B", quelle: ref, was: "referenz" }]
    : [{ marke: "A", quelle: ref, was: "referenz" }, { marke: "B", quelle: terra, was: "terra" }];

  const { chromium } = ladePlaywright();
  const browser = await chromium.launch({ args: ["--force-color-profile=srgb", "--hide-scrollbars"] });
  const seite = await browser.newPage({
    viewport: { width: breite * 2 + 24, height: Math.round(breite * 9 / 16) + 52 },
    deviceScaleFactor: 1
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#111;display:flex;gap:8px;padding:8px;font:600 22px system-ui,sans-serif}
    figure{flex:1;display:flex;flex-direction:column;gap:6px}
    .bild{width:100%;aspect-ratio:16/9;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .bild img{max-width:100%;max-height:100%;object-fit:contain;display:block}
    figcaption{color:#eee;text-align:center;letter-spacing:.35em}
  </style></head><body>
    ${seiten.map((s) => `<figure><div class="bild"><img src="${datenUri(s.quelle)}"></div><figcaption>${s.marke}</figcaption></figure>`).join("")}
  </body></html>`;
  await seite.setContent(html, { waitUntil: "load" });
  await seite.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await seite.screenshot({ path: out, type: "png" });
  await browser.close();

  const key = {
    montage: out,
    A: seiten[0].was, B: seiten[1].was,
    terra: path.basename(terra), referenz: path.basename(ref),
    terraSeite: seiten.find((s) => s.was === "terra").marke
  };
  if (schluessel) {
    fs.mkdirSync(path.dirname(schluessel), { recursive: true });
    fs.writeFileSync(schluessel, JSON.stringify(key, null, 2));
  }
  return key;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = args(process.argv.slice(2));
  if (!a.ref && a.shot) a.ref = referenzFuer(a.shot, a.quelle || "anno");
  if (!a.terra || !a.ref) {
    console.error("Fehlt: --terra <png> und entweder --ref <bild> oder --shot <id> [--quelle anno|ghibli]\n" +
      "  [--out <png>] [--schluessel <json>] [--wurf 0|1]");
    process.exit(2);
  }
  duell(a).then((k) => {
    console.log(`Montage: ${k.montage}`);
    if (a.schluessel) console.log(`Schluessel: ${a.schluessel} (terra = ${k.terraSeite})`);
    else console.log(`terra steht auf Seite ${k.terraSeite}`);
  }).catch((e) => { console.error(e.message); process.exit(1); });
}
