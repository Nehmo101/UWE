#!/usr/bin/env node
/**
 * Beruhigt die Bestands-Szenenbilder für den Einsatz als UI-Hintergrund.
 *
 * Das Problem, das dieses Skript löst: die 33 Bilder in `assets/scenes/` sind
 * handwerklich gute Illustrationen, aber es sind detailreiche Städtepanoramen
 * mit hartem Kontrast. Als Bild an der Wand funktionieren sie; als Fläche
 * hinter Text kämpfen sie mit dem Inhalt. Die Verlaufsmasken in
 * `painted-scene.css` versuchen das aufzufangen und schaffen es nicht, weil
 * das Problem im Bild selbst steckt und nicht in der Maske darüber.
 *
 * Was hier passiert — vier Schritte, alle bewusst zurückhaltend:
 *
 *   1. **Kontrast und Sättigung leicht zurück.** Nicht zu einem Graubild,
 *      sondern so weit, dass kein Bildbereich mehr um Aufmerksamkeit
 *      konkurriert. Ein Hintergrund darf schön sein, aber nicht laut.
 *   2. **Vertikaler Weichzeichner-Verlauf.** Der untere Bildbereich — dort, wo
 *      Karten, Tabellen und Fließtext sitzen — wird zunehmend unscharf. Oben
 *      bleibt die Landschaft scharf, unten wird sie Atmosphäre. Das ist
 *      dieselbe Tiefenschärfe, die ein gemalter Filmhintergrund benutzt.
 *   3. **Helligkeit angleichen.** Sehr helle Himmel und sehr dunkle Nachtbilder
 *      werden zur Mitte gezogen, damit die Deckkraft der Content-Flächen für
 *      alle Motive gleich gut funktioniert.
 *   4. **Format wechseln.** PNG raus, AVIF und WebP rein. Die Vorlage bleibt
 *      unangetastet; geschrieben wird nach `assets/scenes-graded/`.
 *
 * Aufruf: `node scripts/regrade-scenes.mjs [--force]`
 *
 * Das Skript ist idempotent: bereits erzeugte Dateien werden übersprungen,
 * solange die Quelle nicht neuer ist. `--force` erzeugt alles neu.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `sharp` ist eine Abhängigkeit von `@uwe/assets` und `@uwe/studio`, nicht der
 * Wurzel — ein blankes `import "sharp"` findet es in einem pnpm-Workspace
 * deshalb nicht. Über die `require`-Auflösung von `@uwe/assets` landet man
 * zuverlässig bei derselben Fassung, die auch die Anwendung benutzt.
 */
const require = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packages", "assets", "package.json"),
);
const sharp = require("sharp");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "assets", "scenes");
const TARGET = path.join(ROOT, "assets", "scenes-graded");

const FORCE = process.argv.includes("--force");

/**
 * Wie stark der untere Bildbereich weichgezeichnet wird und ab welcher Höhe.
 * `START` ist der Anteil der Bildhöhe, ab dem die Unschärfe einsetzt — darüber
 * bleibt das Bild unangetastet.
 */
const BLUR_START = 0.46;
const BLUR_SIGMA = 14;
/** In wie vielen Stufen der Verlauf gebaut wird. Mehr = weicher, langsamer. */
const BLUR_STEPS = 6;

const AVIF = { quality: 52, effort: 6 };
const WEBP = { quality: 74, effort: 5 };

/**
 * Der Alpha-Verlauf als SVG — zuverlässiger und schneller als der Umweg über
 * `composite`/`dest-in` mit erzeugten Flächen.
 */
function fadeMask(width, height) {
  return Buffer.from(
    `<svg width="${width}" height="${height}">
       <defs>
         <linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0%" stop-color="#fff" stop-opacity="0"/>
           <stop offset="18%" stop-color="#fff" stop-opacity="1"/>
         </linearGradient>
       </defs>
       <rect width="${width}" height="${height}" fill="url(#f)"/>
     </svg>`,
  );
}

async function blurredBand(input, width, height, top, sigma) {
  const bandHeight = height - top;
  const blurred = await sharp(input)
    .extract({ left: 0, top, width, height: bandHeight })
    .blur(sigma)
    .ensureAlpha()
    .composite([{ input: fadeMask(width, bandHeight), blend: "dest-in" }])
    .png()
    .toBuffer();
  return { input: blurred, top, left: 0 };
}

async function regrade(relative) {
  const from = path.join(SOURCE, relative);
  const base = relative.replace(/\.png$/i, "");
  const outAvif = path.join(TARGET, `${base}.avif`);
  const outWebp = path.join(TARGET, `${base}.webp`);

  if (!FORCE && fs.existsSync(outAvif) && fs.existsSync(outWebp)) {
    const src = fs.statSync(from).mtimeMs;
    if (fs.statSync(outAvif).mtimeMs >= src) return { skipped: true };
  }

  const image = sharp(from);
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error(`Keine Maße: ${relative}`);

  // Schritt 1 + 3: Kontrast, Sättigung und Helligkeit zur Mitte ziehen.
  const toned = await sharp(from)
    .modulate({ saturation: 0.82, brightness: 1.0 })
    .linear(0.88, 14) // Kontrast leicht flacher, Schwarzpunkt angehoben
    .png()
    .toBuffer();

  // Schritt 2: der Tiefenschärfe-Verlauf nach unten.
  const startY = Math.round(height * BLUR_START);
  const span = height - startY;
  const bands = [];
  for (let step = 0; step < BLUR_STEPS; step += 1) {
    const top = startY + Math.round((span * step) / BLUR_STEPS);
    if (height - top < 4) continue;
    const ratio = (step + 1) / BLUR_STEPS;
    bands.push(await blurredBand(toned, width, height, top, Math.max(0.3, BLUR_SIGMA * ratio * ratio)));
  }

  const graded = await sharp(toned).composite(bands).png().toBuffer();

  fs.mkdirSync(path.dirname(outAvif), { recursive: true });
  await sharp(graded).avif(AVIF).toFile(outAvif);
  await sharp(graded).webp(WEBP).toFile(outWebp);

  return {
    skipped: false,
    before: fs.statSync(from).size,
    avif: fs.statSync(outAvif).size,
    webp: fs.statSync(outWebp).size,
  };
}

function collectPngs(dir, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...collectPngs(path.join(dir, entry.name), rel));
    else if (entry.isFile() && /\.png$/i.test(entry.name)) out.push(rel);
  }
  return out;
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`[regrade-scenes] Quelle fehlt: ${SOURCE}`);
    process.exit(1);
  }

  const files = collectPngs(SOURCE).sort();
  let before = 0;
  let avif = 0;
  let webp = 0;
  let done = 0;
  let skipped = 0;

  for (const file of files) {
    const result = await regrade(file);
    if (result.skipped) {
      skipped += 1;
      continue;
    }
    done += 1;
    before += result.before;
    avif += result.avif;
    webp += result.webp;
    process.stdout.write(`\r[regrade-scenes] ${done}/${files.length - skipped} …`);
  }

  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  process.stdout.write("\r");
  console.log(`[regrade-scenes] ${done} neu, ${skipped} unverändert.`);
  if (done > 0) {
    console.log(
      `[regrade-scenes] PNG ${mb(before)} MB -> AVIF ${mb(avif)} MB / WebP ${mb(webp)} MB`,
    );
  }
}

await main();
