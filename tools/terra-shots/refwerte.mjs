#!/usr/bin/env node
/**
 * `node tools/terra-shots/refwerte.mjs <bilder...>` — dieselben Kennzahlen wie
 * bildwerte.mjs, aber fuer die JPG-Referenzen (.terra-refs). Node kann kein
 * JPEG, deshalb dekodiert ein kopfloses Chromium ueber Canvas — dieselbe
 * Playwright-Installation, die der Aufnahmelauf ohnehin braucht.
 *
 * Zweck: die Referenzwerte selbst nachmessen, statt sie aus einem Bericht zu
 * uebernehmen. Insbesondere das Vorzeichen von `warm` — es entscheidet, in
 * welche Richtung die Warm/Kalt-Trennung ueberhaupt gehen muss.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const hier = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function ladePlaywright() {
  for (const k of [
    () => require("playwright"), () => require("@playwright/test"),
    () => require(path.join(hier, "..", "..", "node_modules", "playwright")),
    () => require("C:/git/UWE/node_modules/@playwright/test")
  ]) { try { return k(); } catch { /* naechster */ } }
  throw new Error("Playwright nicht gefunden");
}

const dateien = [];
for (const a of process.argv.slice(2)) {
  const s = fs.statSync(a);
  if (s.isDirectory()) {
    for (const f of fs.readdirSync(a).sort())
      if (/\.(jpe?g|png)$/i.test(f)) dateien.push(path.join(a, f));
  } else dateien.push(a);
}

const { chromium } = ladePlaywright();
const browser = await chromium.launch();
const seite = await browser.newPage();
await seite.setContent("<html><body></body></html>");

const z = (v, k = 3) => v.toFixed(k).padStart(k + 3);
console.log("datei".padEnd(24) + "  p05    p50    p95    tief%  hell%  sat    warm");
for (const d of dateien) {
  const b64 = fs.readFileSync(d).toString("base64");
  const art = d.toLowerCase().endsWith(".png") ? "png" : "jpeg";
  const w = await seite.evaluate(async ({ b64, art }) => {
    const bild = new Image();
    await new Promise((ok, fehler) => {
      bild.onload = ok; bild.onerror = fehler;
      bild.src = "data:image/" + art + ";base64," + b64;
    });
    const c = document.createElement("canvas");
    c.width = bild.naturalWidth; c.height = bild.naturalHeight;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(bild, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    const n = c.width * c.height, hist = new Float64Array(1001);
    let satS = 0, lBR = 0, lN = 0, tBR = 0, tN = 0, tief = 0, hell = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 4, r = px[o] / 255, gr = px[o + 1] / 255, bl = px[o + 2] / 255;
      const l = 0.2126 * r + 0.7152 * gr + 0.0722 * bl;
      hist[Math.round(l * 1000)]++;
      const mx = Math.max(r, gr, bl), mn = Math.min(r, gr, bl);
      satS += mx > 0 ? (mx - mn) / mx : 0;
      if (l < 0.20) tief++;
      if (l > 0.85) hell++;
      if (l > 0.62) { lBR += bl - r; lN++; } else if (l < 0.30) { tBR += bl - r; tN++; }
    }
    const perz = (q) => { let s = 0; for (let k = 0; k <= 1000; k++) { s += hist[k]; if (s >= n * q) return k / 1000; } return 1; };
    return { p05: perz(0.05), p50: perz(0.5), p95: perz(0.95),
      tief: tief / n * 100, hell: hell / n * 100, sat: satS / n,
      warm: (lN ? lBR / lN : 0) - (tN ? tBR / tN : 0) };
  }, { b64, art });
  console.log(path.basename(d).padEnd(24) + "  " + z(w.p05) + "  " + z(w.p50) + "  " + z(w.p95) +
    "  " + w.tief.toFixed(1).padStart(5) + "  " + w.hell.toFixed(1).padStart(5) +
    "  " + z(w.sat) + "  " + (w.warm >= 0 ? "+" : "") + w.warm.toFixed(3));
}
await browser.close();
