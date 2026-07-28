/* ==========================================================================
   Hilfsprogramm, das in einem EIGENEN Prozess laeuft (aufgerufen aus
   01-determinismus.test.mjs). Es baut die Beispielkarte auf und gibt drei
   Hashes als JSON aus.

   Warum ein eigener Prozess: die 272 Pool-Geometrien entstehen EINMAL beim
   Modulstart von generators/geometry.js. Innerhalb eines Prozesses laesst sich
   dieser Schritt nicht wiederholen (Modul-Cache) — ein Determinismusfehler in
   den Bauteilen waere in einem Ein-Prozess-Test unsichtbar. Zwei Laeufe
   desselben Programms decken ihn auf.

   Aufruf:  node hilfen/gesamthash.mjs [seed] [biom]
   ========================================================================== */
import { testWelt, beispielKarte, hashKarte, hashPools } from './karte.mjs';

const seed = process.argv[2] !== undefined ? Number(process.argv[2]) : 1337;
const biom = process.argv[3] || 'wiese';

const welt = await testWelt({ seed, biom });
beispielKarte(welt);
welt.alleNeu();

const S = welt.m.store.S;
let instanzen = 0;
for (const el of S.elements) instanzen += el.total;

process.stdout.write(JSON.stringify({
  karte: hashKarte(S),
  pools: hashPools(welt.m.pools.POOLS),
  elemente: S.elements.length,
  instanzen
}));
