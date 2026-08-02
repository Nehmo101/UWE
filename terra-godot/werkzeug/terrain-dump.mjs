#!/usr/bin/env node
/**
 * Terrain-Dump — Referenz-Basisterrain aus Terras ECHTEM Generator.
 *
 * WARUM DAS UEBER DEN RNG-DUMP HINAUS NOETIG IST
 *
 * `golden.json` beweist, dass GDScript Terras Zufallsprimitive (hashi, vnoise,
 * fractal, mulberry32) bitweise reproduziert. Das ist die Voraussetzung — aber
 * nicht die Zusage. Gebraucht wird, dass am Ende dasselbe HOEHENFELD
 * herauskommt: `genBaseIn` (terra/src/world/terrain.js:169) kombiniert die
 * Primitive mit dem Hoehenprofil des Bioms zu dem Feld, gegen das v3 sein
 * Delta rechnet. Erst dieser Vergleich prueft die Zusage selbst.
 *
 * ZWEI FEINHEITEN, DIE MAN LEICHT UEBERSIEHT
 *
 * 1. Das Zielfeld ist ein `Float32Array` (io.js:454). Gerechnet wird in
 *    Double, GESPEICHERT wird in 32 Bit. Godot muss also ebenso runden —
 *    `PackedFloat32Array` tut das von selbst, aber nur, wenn man es auch
 *    benutzt und nicht in Double weiterrechnet.
 * 2. `genBaseIn` haengt an Modulzustand (`S.biom`, `MAP`). Deshalb laeuft
 *    dieser Dump ueber DENSELBEN Loader-Haken wie Terras Tests
 *    (terra/test/hilfen/laden.mjs) — nicht ueber einen Nachbau der Umgebung.
 *
 * Aufruf: node terra-godot/werkzeug/terrain-dump.mjs > terra-godot/test/terrain.json
 */
import { ladeTerra } from "../../terra/test/hilfen/laden.mjs";

const terrain = await ladeTerra("world/terrain.js");
const store = await ladeTerra("core/store.js");

/**
 * Die Faelle. Klein gehalten (Kantenlaenge 64 statt 256), weil der Vergleich
 * die RECHENWEISE prueft, nicht den Durchsatz: geht ein Profilfeld verloren
 * oder kippt ein Vorzeichen, faellt das auf 65x65 Stuetzstellen genauso auf
 * wie auf 1025x1025 — nur liest sich die Datei noch.
 *
 * Die Biome sind bewusst nicht beliebig gewaehlt. `genBaseIn` hat vier
 * Sonderzweige, die bei Profilwert 0 KOMPLETT uebersprungen werden (grat,
 * stufe, senken, und eine vom Standard abweichende randBreite). Ein Zweig,
 * den kein Fall aktiviert, waere ungeprueft — die Portierung koennte ihn
 * schlicht vergessen haben, ohne dass ein Test rot wird. Deshalb deckt die
 * Liste jeden Zweig mindestens einmal ab:
 *
 *   wiese       Standardprofil, alle Sonderzweige aus (der haeufigste Fall)
 *   karst       grat 0.7 UND senken 7 — die einzigen Senken im Katalog
 *   kreide      stufe 9 (Terrassen, harte Kante)
 *   terrassen   stufe 2.2 (dieselbe Mechanik, weiche Kante 0.35)
 *   vulkan      grat 0.6, staerkster reiner Gratfall
 *   aschebrache randBreite 10 statt 55 — schmaler Rand, andere sstep-Kurve
 */
const FAELLE = [
  { seed: 1337, groesse: 64, biom: "wiese" },
  { seed: 4711, groesse: 64, biom: "karst" },
  { seed: 777, groesse: 64, biom: "kreide" },
  { seed: 1, groesse: 64, biom: "terrassen" },
  { seed: 0, groesse: 64, biom: "vulkan" },
  { seed: 99, groesse: 64, biom: "aschebrache" },
  // Ein groesserer Fall, damit die Randbehandlung (randBreite 55) auch dort
  // greift, wo sie nicht die halbe Karte einnimmt.
  { seed: 1337, groesse: 256, biom: "wiese" },
];

/** Alle Biome mit einem eigenen Hoehenprofil — plus die, die den Standard fahren. */
function baueProfile() {
  const out = {};
  for (const name of Object.keys(store.BIOME)) {
    out[name] = store.hoehenProfil(name);
  }
  return out;
}

function baueFaelle() {
  const out = [];
  for (const fall of FAELLE) {
    const vw = fall.groesse + 1;
    const ziel = new Float32Array(vw * vw);
    terrain.genBaseIn(ziel, fall.seed, fall.groesse, fall.biom);
    out.push({
      ...fall,
      vw,
      // Rohbytes des Float32Array als base64: exakt, kompakt und ohne den
      // Umweg ueber eine Dezimaldarstellung, an der schon der RNG-Vergleich
      // gescheitert ist (siehe golden-dump.mjs).
      f32: Buffer.from(ziel.buffer, ziel.byteOffset, ziel.byteLength).toString("base64"),
    });
  }
  return out;
}

const dump = {
  _zweck:
    "Referenz-Basisterrain aus terra/src/world/terrain.js (genBaseIn) und die " +
    "aufgeloesten Hoehenprofile aus core/store.js. Erzeugt von " +
    "terra-godot/werkzeug/terrain-dump.mjs.",
  quelle: "terra/src/world/terrain.js:169 (genBaseIn)",
  hoehenStandard: store.HOEHEN_STANDARD,
  profile: baueProfile(),
  faelle: baueFaelle(),
};

process.stdout.write(JSON.stringify(dump, null, 1));
