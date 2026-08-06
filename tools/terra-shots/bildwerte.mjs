#!/usr/bin/env node
/**
 * `node tools/terra-shots/bildwerte.mjs <ordner|datei> [...]` — Tonwertmessung.
 *
 * Liest PNG-Aufnahmen (und JPG-Referenzen ueber den PNG-Weg NICHT — dafuer gibt
 * es --jpg nicht; Referenzzahlen stehen im Befund) und gibt je Bild aus:
 *
 *   p05/p50/p95  Luminanzperzentile (Rec. 709 auf sRGB-Bytes/255)
 *   tief%        Anteil der Pixel unter Luminanz 0.20  (Ghibli/Anno: 8-25 %)
 *   hell%        Anteil der Pixel ueber Luminanz 0.85  (Referenz: 0.0-4.6 %)
 *   sat          mittlere HSV-Saettigung               (Referenz: >= 0.228)
 *   warm         (B-R) der Lichter minus (B-R) der Tiefen. NEGATIV heisst
 *                "Lichter kuehler als Schatten" — der Fehler, den der
 *                Stilvertrag ausdruecklich verbietet.
 *
 * Eigener Mini-PNG-Leser ueber node:zlib: der Aufnahmelauf schreibt 8-Bit-RGBA
 * ohne Interlace, mehr muss er nicht koennen — und terra darf keine neue
 * Abhaengigkeit bekommen, auch nicht im Werkzeugordner.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function lesePNG(datei) {
  const b = fs.readFileSync(datei);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error("kein PNG: " + datei);
  let p = 8, breite = 0, hoehe = 0, tiefe = 0, typ = 0, interlace = 0;
  const teile = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), name = b.toString("ascii", p + 4, p + 8);
    const daten = b.subarray(p + 8, p + 8 + len);
    if (name === "IHDR") {
      breite = daten.readUInt32BE(0); hoehe = daten.readUInt32BE(4);
      tiefe = daten[8]; typ = daten[9]; interlace = daten[12];
    } else if (name === "IDAT") teile.push(daten);
    else if (name === "IEND") break;
    p += 12 + len;
  }
  if (tiefe !== 8 || interlace !== 0 || (typ !== 6 && typ !== 2))
    throw new Error("nur 8-Bit RGB/RGBA ohne Interlace: " + datei);
  const kan = typ === 6 ? 4 : 3;
  const roh = zlib.inflateSync(Buffer.concat(teile));
  const zeile = breite * kan;
  const aus = Buffer.alloc(hoehe * zeile);
  let q = 0;
  for (let y = 0; y < hoehe; y++) {
    const f = roh[q++];
    const ein = roh.subarray(q, q + zeile); q += zeile;
    const z = y * zeile, zv = z - zeile;
    for (let x = 0; x < zeile; x++) {
      const a = x >= kan ? aus[z + x - kan] : 0;
      const bb = y > 0 ? aus[zv + x] : 0;
      const c = (x >= kan && y > 0) ? aus[zv + x - kan] : 0;
      let v = ein[x];
      if (f === 1) v += a;
      else if (f === 2) v += bb;
      else if (f === 3) v += (a + bb) >> 1;
      else if (f === 4) {
        const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c);
      }
      aus[z + x] = v & 255;
    }
  }
  return { breite, hoehe, kan, daten: aus };
}

function werte(datei) {
  const bild = lesePNG(datei);
  const { breite, hoehe, kan, daten } = bild;
  const n = breite * hoehe;
  const hist = new Float64Array(1001);
  let satSumme = 0;
  let lichtBR = 0, lichtN = 0, tiefBR = 0, tiefN = 0;
  let tief = 0, hell = 0;
  for (let i = 0; i < n; i++) {
    const o = i * kan;
    const r = daten[o] / 255, g = daten[o + 1] / 255, bl = daten[o + 2] / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    hist[Math.round(l * 1000)]++;
    const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
    satSumme += mx > 0 ? (mx - mn) / mx : 0;
    if (l < 0.20) tief++;
    if (l > 0.85) hell++;
    if (l > 0.62) { lichtBR += bl - r; lichtN++; }
    else if (l < 0.30) { tiefBR += bl - r; tiefN++; }
  }
  const perz = (q) => {
    let s = 0, ziel = n * q;
    for (let k = 0; k <= 1000; k++) { s += hist[k]; if (s >= ziel) return k / 1000; }
    return 1;
  };
  return {
    datei: path.basename(datei),
    p05: perz(0.05), p50: perz(0.5), p95: perz(0.95),
    tief: tief / n * 100, hell: hell / n * 100,
    sat: satSumme / n,
    warm: (lichtN ? lichtBR / lichtN : 0) - (tiefN ? tiefBR / tiefN : 0)
  };
}

const ziele = [];
for (const a of process.argv.slice(2)) {
  const s = fs.statSync(a);
  if (s.isDirectory()) {
    for (const f of fs.readdirSync(a).sort()) if (f.endsWith(".png")) ziele.push(path.join(a, f));
  } else ziele.push(a);
}
const z = (v, k = 3) => v.toFixed(k).padStart(k + 3);
console.log("datei".padEnd(24) + "  p05    p50    p95    tief%  hell%  sat    warm");
for (const t of ziele) {
  const w = werte(t);
  console.log(w.datei.padEnd(24) + "  " + z(w.p05) + "  " + z(w.p50) + "  " + z(w.p95) +
    "  " + w.tief.toFixed(1).padStart(5) + "  " + w.hell.toFixed(1).padStart(5) +
    "  " + z(w.sat) + "  " + (w.warm >= 0 ? "+" : "") + w.warm.toFixed(3));
}
