#!/usr/bin/env node
/**
 * Golden-Dump — Referenzwerte aus Terras ECHTEM RNG.
 *
 * WARUM DIESE DATEI EXISTIERT
 *
 * Seit Format v3 steht in einer Kartendatei nur das Delta gegen das
 * deterministisch aus dem Seed erzeugte Terrain (terra/src/editor/io.js:115).
 * Die Basis wird nachgerechnet. Ein zweiter Renderer, der dasselbe Format
 * lesen soll, muss Terras Zufallskern deshalb BIT-GENAU reproduzieren —
 * sonst landet das Delta auf einer anderen Basis und die Karte ist still
 * falsch. Nicht kaputt, nicht leer: falsch. Das ist die schlimmste Sorte.
 *
 * Dieses Skript importiert `terra/src/core/rng.js` DIREKT — keine Kopie, kein
 * Nachbau. Was hier herauskommt, ist per Konstruktion die Wahrheit, gegen die
 * sich die GDScript-Portierung messen lassen muss. Läuft die Portierung
 * auseinander, ist es ein Fehler der Portierung, nie des Dumps.
 *
 * WAS ABGEDECKT WIRD (und warum genau das)
 *
 *   hashi    Negative Koordinaten und Seeds. `Math.imul` ist eine 32-Bit-
 *            SIGNED-Multiplikation, `>>>` eine LOGISCHE Verschiebung —
 *            GDScript rechnet mit 64 Bit und kennt beides nicht von selbst.
 *            Der Vorzeichenwechsel ist die wahrscheinlichste Fehlerquelle,
 *            deshalb liegt der Schwerpunkt dort.
 *   vnoise   Gebrochene UND negative Koordinaten: `Math.floor(-0.5)` ist -1,
 *            eine Abschneidung nach null wäre 0. Klassischer Portierfehler.
 *   fractal  Alle Oktavzahlen, die Terra benutzt. Prüft zusätzlich die
 *            Seed-Fortschaltung `(s + i * 1013) | 0` samt Überlauf.
 *   rngOf    mulberry32-Strom. Zustandsbehaftet — ein einziger Schritt daneben
 *            und ab da stimmt nichts mehr.
 *
 * Aufruf: node terra-godot/werkzeug/golden-dump.mjs > terra-godot/test/golden.json
 */
import { hashi, vnoise, fractal, rngOf, sstep, clamp, lerp } from "../../terra/src/core/rng.js";

/**
 * Ein Double als exaktes IEEE-754-Bitmuster (16 Hex-Zeichen, little endian).
 *
 * WARUM NICHT EINFACH DIE ZAHL
 *
 * Der erste Anlauf verglich die Dezimaldarstellung aus dem JSON — und meldete
 * 199 Abweichungen bei einer groessten Abweichung von 1,1e-16. Das ist exakt
 * ein ULP: nicht der Zufallskern lag daneben, sondern Godots JSON-Leser gibt
 * das letzte Bit nicht zurueck. Der Test mass den Parser statt die Portierung.
 *
 * Das Bitmuster umgeht die Textdarstellung vollstaendig. Godot liest es ueber
 * `PackedByteArray.decode_double()` zurueck — Byte fuer Byte dasselbe Double,
 * das Node erzeugt hat. Erst damit prueft dieser Test wirklich, was er behauptet
 * zu pruefen: bitweise Gleichheit.
 */
function bits(wert) {
  const puffer = Buffer.allocUnsafe(8);
  puffer.writeDoubleLE(wert);
  return puffer.toString("hex");
}

/**
 * Stützstellen für hashi. Bewusst um die Vorzeichengrenze herum verdichtet
 * und mit Werten jenseits von 2^31, damit der Überlauf mitgeprüft wird.
 */
const HASHI_KOORD = [
  0, 1, 2, 3, 7, 15, 16, 31, 32, 63, 64, 127, 128, 255, 256, 511, 512, 1023,
  -1, -2, -3, -7, -15, -16, -31, -32, -63, -64, -127, -128, -255, -256, -1023,
  65535, 65536, 1048575, 1048576, -65535, -65536, -1048576,
  2147483646, 2147483647, -2147483647, -2147483648,
];
const HASHI_SEEDS = [0, 1, 2, 1337, 4711, 777, 12345, -1, -1337, 0x7fffffff, -0x80000000];

/** Gebrochene Koordinaten inklusive der negativen Seite und exakter Ganzzahlen. */
const VNOISE_KOORD = [
  0, 0.5, 0.25, 0.125, 0.9999999, 1, 1.5, 2.75, 7.3125, 63.4, 127.875, 1023.5,
  -0.0001, -0.5, -0.25, -1, -1.5, -2.75, -7.3125, -63.4, -127.875, -1023.5,
];
const VNOISE_SEEDS = [0, 1, 1337, 4711, -1, -1337];

const FRACTAL_OKT = [1, 2, 3, 4, 5, 6, 8];

/** Wie viele Werte je Strom. mulberry32 driftet erst nach vielen Schritten. */
const RNG_SCHRITTE = 64;
const RNG_SEEDS = [0, 1, 1337, 4711, 777, 0xffffffff, 2147483648];

function baueHashi() {
  const werte = [];
  for (const s of HASHI_SEEDS) {
    for (const x of HASHI_KOORD) {
      // y bewusst gegen x verschoben, damit x und y nicht symmetrisch sind:
      // ein vertauschtes Argumentpaar in der Portierung fiele sonst nicht auf.
      const y = (x * 7 + 13) | 0;
      const v = hashi(x, y, s);
      werte.push({ x, y, s, v, b: bits(v) });
    }
  }
  return werte;
}

function baueVnoise() {
  const werte = [];
  for (const s of VNOISE_SEEDS) {
    for (const x of VNOISE_KOORD) {
      for (const z of [0, 0.5, -0.5, 3.25, -3.25]) {
        const v = vnoise(x, z, s);
        werte.push({ x, z, s, v, b: bits(v) });
      }
    }
  }
  return werte;
}

function baueFractal() {
  const werte = [];
  for (const okt of FRACTAL_OKT) {
    for (const s of [0, 1337, 4711, -1337]) {
      for (const x of [0, 0.5, 7.3125, -7.3125, 63.4, -1023.5]) {
        for (const z of [0, -0.5, 3.25]) {
          const v = fractal(x, z, s, okt);
          werte.push({ x, z, s, okt, v, b: bits(v) });
        }
      }
    }
  }
  return werte;
}

function baueRng() {
  const stroeme = [];
  for (const seed of RNG_SEEDS) {
    const rng = rngOf(seed);
    const werte = [];
    for (let i = 0; i < RNG_SCHRITTE; i++) { const v = rng(); werte.push({ v, b: bits(v) }); }
    stroeme.push({ seed, werte });
  }
  return stroeme;
}

function baueHilfen() {
  const werte = [];
  for (const [e0, e1, x] of [
    [0, 1, 0.5], [0, 1, -1], [0, 1, 2], [1, 0, 0.25], [-1, 1, 0], [5, 5, 5],
    [0.2, 0.8, 0.5], [-3, 7, 1.5],
  ]) {
    const v = sstep(e0, e1, x);
    werte.push({ art: "sstep", a: e0, e1, x, v, b: bits(v) });
  }
  for (const [v, a, b] of [[0.5, 0, 1], [-1, 0, 1], [2, 0, 1], [5, -3, 7]]) {
    const r = clamp(v, a, b);
    werte.push({ art: "clamp", a, e1: b, x: v, v: r, b: bits(r) });
  }
  for (const [a, b, t] of [[0, 1, 0.5], [-3, 7, 0.25], [1, 1, 0.9]]) {
    const r = lerp(a, b, t);
    werte.push({ art: "lerp", a, e1: b, x: t, v: r, b: bits(r) });
  }
  return werte;
}

const dump = {
  _zweck:
    "Referenzwerte aus terra/src/core/rng.js. Erzeugt von " +
    "terra-godot/werkzeug/golden-dump.mjs. Nicht von Hand bearbeiten — " +
    "neu erzeugen, wenn sich rng.js aendert (dann ist aber auch die " +
    "Portierung neu zu pruefen).",
  quelle: "terra/src/core/rng.js",
  hashi: baueHashi(),
  vnoise: baueVnoise(),
  fractal: baueFractal(),
  rng: baueRng(),
  hilfen: baueHilfen(),
};

// Volle Genauigkeit: JSON.stringify gibt fuer Doubles die kuerzeste
// Darstellung aus, die exakt zurueckliest. Kein toFixed, das waere Verlust.
process.stdout.write(JSON.stringify(dump, null, 1));
