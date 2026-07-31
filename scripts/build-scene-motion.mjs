#!/usr/bin/env node
/**
 * Macht aus den Artlist-Rohclips die auslieferbaren Hintergrundvideos.
 *
 * Quelle: `assets/scenes-motion-raw/<bereich>-<modus>-<variante>.mp4`
 * Ziel:   `assets/scenes-motion/<basis>.{mp4,webm,avif,webp}`
 *
 * ## Das Problem, das den Aufbau bestimmt
 *
 * Die Rohclips sind 5,1 Sekunden lang und **laufen nicht rund**: die Kamera
 * fährt langsam ins Bild, Anfangs- und Endbild unterscheiden sich deutlich
 * (SSIM 0,30 bei der Landing-Tagszene). Ein `loop`-Video springt an dieser
 * Naht sichtbar zurück — bei einem Hintergrund, den man minutenlang ansieht,
 * ist das der auffälligste denkbare Fehler.
 *
 * Deshalb Pendelschnitt: vorwärts, dann rückwärts. Die Naht verschwindet
 * konstruktionsbedingt, weil das letzte Bild des Rückwärtsteils das erste des
 * Vorwärtsteils ist (SSIM danach 0,95). Nebenbei verdoppelt sich die Länge,
 * was ohnehin gewollt war — fünf Sekunden sind als Hintergrundschleife kurz.
 *
 * Die doppelten Bilder an beiden Enden des Rückwärtsteils werden abgeschnitten;
 * ohne das stockt die Bewegung an der Wende und beim Rücksprung je um ein Bild.
 *
 * ## Bewusst ohne Zwischenbildberechnung
 *
 * `minterpolate` stünde bereit, um beim Verlangsamen echte Zwischenbilder zu
 * rechnen. Hier ist es falsch: die Motive bestehen aus fein gezeichneten
 * Wurzelsträngen, und bewegungskompensierte Interpolation verwischt genau
 * solche dünnen, sich kreuzenden Linien. Bei 1,6-facher Verlangsamung bleiben
 * 20 echte Bilder je Sekunde übrig — für driftende Wolken und eine kaum
 * merkliche Kamerafahrt ist das flüssig, und jedes Bild ist gemalt statt
 * gerechnet.
 *
 * ## Auflösung
 *
 * Die Rohclips sind 1280 × 720 bzw. 720 × 1280. Das Asset-Register nannte
 * einmal 1920 × 1080 als Ziel; hochskaliert würde daraus keine echte
 * Zeichnung, nur weichere Kanten und doppelte Bytes. Die Quellauflösung bleibt
 * deshalb unangetastet — hinter dem Verdunkelungs-Veil ist sie reichlich.
 *
 * Aufruf:
 *   node scripts/build-scene-motion.mjs                    # alles Vorhandene
 *   node scripts/build-scene-motion.mjs --only=landing,portal
 *   node scripts/build-scene-motion.mjs --force            # auch Aktuelles neu
 *
 * Idempotent: fertige Dateien werden übersprungen, solange die Quelle nicht
 * neuer ist.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packages", "assets", "package.json"),
);
const sharp = require("sharp");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = path.join(ROOT, "assets", "scenes-motion-raw");
const OUT_DIR = path.join(ROOT, "assets", "scenes-motion");

/** Verlangsamung und Bildrate — siehe Kopfkommentar. */
const SLOWDOWN = 1.6;
const FPS = 20;

/**
 * VP9-Qualität. Das Register nannte einmal 36; damit war das WebM nur
 * unwesentlich kleiner als das MP4 und lohnte den zweiten Download nicht. Bei
 * 44 liegt es rund zwei Drittel darunter, und die feinen Wurzelstränge bleiben
 * erhalten (SSIM 0,96 gegen die H.264-Fassung, nachgemessen an der
 * Landing-Tagszene).
 */
const VP9_CRF = 44;

/** AVIF-Poster: 55 lag knapp über dem Budget, 50 darunter — ohne sichtbaren Unterschied. */
const AVIF_QUALITY = 50;

/**
 * Obergrenzen aus `docs/design/scene-motion-assets.md`. Sie sind kein
 * Abbruchgrund, sondern eine Meldung: wird eine Datei deutlich größer, steckt
 * meist zu viel Bewegung im Clip — und das ist ein inhaltlicher Fehler, keiner
 * der Kompression.
 */
const BUDGET_BYTES = {
  "desktop.mp4": 1.8e6,
  "desktop.webm": 1.1e6,
  "mobil.mp4": 1.2e6,
  "mobil.webm": 0.8e6,
  avif: 90e3,
  webp: 140e3,
};

const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.slice("--only=".length).split(",").map((s) => s.trim()) : null;

function ffprobe(file, entries) {
  return execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", entries, "-of", "csv=p=0", file],
    { encoding: "utf8" },
  ).trim();
}

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: ["ignore", "ignore", "inherit"] });
}

/**
 * Der Pendelschnitt als Filtergraph.
 *
 * `split` verzweigt den verlangsamten Strom; der zweite Zweig läuft rückwärts
 * und verliert vorne wie hinten ein Bild — vorne das an der Wende doppelte,
 * hinten das beim Rücksprung doppelte. `concat` setzt beide zusammen.
 */
function pingPongFilter(slowFrames) {
  const reversedFrames = Math.max(1, slowFrames - 2);
  return [
    `[0:v]setpts=${SLOWDOWN}*PTS,fps=${FPS},split[a][b]`,
    `[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r0]`,
    `[r0]trim=end_frame=${reversedFrames},setpts=PTS-STARTPTS[r]`,
    `[a][r]concat=n=2:v=1[out]`,
  ].join(";");
}

function budgetFor(base, ext) {
  if (ext === "avif" || ext === "webp") return BUDGET_BYTES[ext];
  const variant = base.endsWith("-mobil") ? "mobil" : "desktop";
  return BUDGET_BYTES[`${variant}.${ext}`];
}

function report(file) {
  const base = path.basename(file, path.extname(file));
  const ext = path.extname(file).slice(1);
  const bytes = fs.statSync(file).size;
  const budget = budgetFor(base, ext);
  const kb = (bytes / 1024).toFixed(0);
  const over = budget && bytes > budget ? `  ÜBER BUDGET (${(budget / 1024).toFixed(0)} KB)` : "";
  return `    ${path.basename(file).padEnd(30)} ${kb.padStart(6)} KB${over}`;
}

function isFresh(source, targets) {
  if (force) return false;
  const sourceTime = fs.statSync(source).mtimeMs;
  return targets.every((t) => fs.existsSync(t) && fs.statSync(t).mtimeMs >= sourceTime);
}

async function buildOne(rawFile) {
  const base = path.basename(rawFile, ".mp4");
  const out = (ext) => path.join(OUT_DIR, `${base}.${ext}`);
  const targets = ["mp4", "webm", "avif", "webp"].map(out);

  if (isFresh(rawFile, targets)) {
    console.log(`  ${base}: aktuell, übersprungen`);
    return [];
  }

  const rawFrames = Number(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-count_frames", "-select_streams", "v:0",
       "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", rawFile],
      { encoding: "utf8" },
    ).trim(),
  );
  // Wie viele Bilder der verlangsamte Vorwärtsteil hat — `reverse` braucht die
  // Zahl, um hinten genau ein Bild abzuschneiden.
  const slowFrames = Math.round((rawFrames / Number(ffprobe(rawFile, "stream=r_frame_rate").split("/")[0])) * SLOWDOWN * FPS);
  const filter = pingPongFilter(slowFrames);

  console.log(`  ${base}: ${rawFrames} Rohbilder → Pendelschnitt`);

  ffmpeg(["-i", rawFile, "-an", "-filter_complex", filter, "-map", "[out]",
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "27",
    "-movflags", "+faststart", out("mp4")]);

  ffmpeg(["-i", rawFile, "-an", "-filter_complex", filter, "-map", "[out]",
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", String(VP9_CRF), "-row-mt", "1", out("webm")]);

  // Das Poster ist das erste Bild des fertigen Clips, nicht des Rohclips:
  // sonst passte es nach dem Verlangsamen nicht mehr exakt auf den Start und
  // der Übergang Poster → Video wäre ein sichtbarer Ruck.
  const posterPng = path.join(OUT_DIR, `${base}.poster.png`);
  ffmpeg(["-i", out("mp4"), "-frames:v", "1", "-update", "1", posterPng]);
  await sharp(posterPng).avif({ quality: AVIF_QUALITY }).toFile(out("avif"));
  await sharp(posterPng).webp({ quality: 72 }).toFile(out("webp"));
  fs.rmSync(posterPng);

  return targets;
}

async function main() {
  if (!fs.existsSync(RAW_DIR)) {
    console.error(`Kein Rohclip-Ordner: ${RAW_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const raw = fs
    .readdirSync(RAW_DIR)
    .filter((f) => f.endsWith(".mp4"))
    .filter((f) => !only || only.some((area) => f.startsWith(`${area}-`)))
    .sort();

  if (raw.length === 0) {
    console.error(`Keine passenden Rohclips in ${RAW_DIR}.`);
    process.exit(1);
  }

  console.log(`[scene-motion] ${raw.length} Rohclip(s)\n`);
  const written = [];
  for (const file of raw) {
    written.push(...(await buildOne(path.join(RAW_DIR, file))));
  }

  if (written.length === 0) {
    console.log("\nNichts zu tun.");
    return;
  }

  console.log("\n[scene-motion] Ergebnis:");
  let overBudget = 0;
  for (const file of written) {
    const line = report(file);
    if (line.includes("ÜBER BUDGET")) overBudget += 1;
    console.log(line);
  }
  const total = written.reduce((sum, f) => sum + fs.statSync(f).size, 0);
  console.log(`\n  Summe: ${(total / 1024 / 1024).toFixed(1)} MB`);
  if (overBudget > 0) {
    console.log(`  ${overBudget} Datei(en) über Budget — siehe scene-motion-assets.md.`);
  }
  console.log("\n  Nächster Schritt: available-Schalter in sceneMotion.ts, dann copy-scenes.mjs.");
}

await main();
