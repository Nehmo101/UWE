#!/usr/bin/env node
/**
 * Kopiert den Karteneditor Terra aus `terra/` in das `public/terra/` von
 * Studio und Portal.
 *
 * WARUM KOPIEREN UND NICHT ZWEIMAL EINCHECKEN
 *
 * Terra ist statisches HTML/JS ohne Bundler. Es muss aber GLEICH-ORIGIN
 * ausgeliefert werden, und zwar in beiden Apps:
 *
 *  - Die CSP setzt `frame-src 'self'` und `frame-ancestors 'self'`
 *    (packages/auth/src/security-headers.ts). Ein Frame von einer anderen
 *    Herkunft wäre schlicht blockiert.
 *  - Die Brücke prüft `event.origin === location.origin`. Über Herkunfts-
 *    grenzen hinweg müsste sie aufgeweicht werden — genau das soll sie nicht.
 *  - Das Portal läuft je nach Aufstellung unter eigener Herkunft ODER unter
 *    einem `basePath` hinter dem Studio-Proxy (apps/studio/next.config.ts,
 *    `rewrites()` auf `PORTAL_PATH`). Der Proxy reicht nur den Portal-Pfad
 *    weiter; `/terra/*` auf der Studio-Herkunft wäre für das Portal unter
 *    eigener Herkunft nicht erreichbar. Auf den Proxy zu setzen hieße, die
 *    Auslieferung an eine optionale Betriebsart zu binden.
 *
 * Zwei EINGECHECKTE Kopien wären die Alternative — und wären der Fehler:
 * Terra ist 4 MB und wird laufend weiterentwickelt, jede Änderung läge
 * doppelt in der Historie und könnte auseinanderlaufen. Deshalb dasselbe
 * Verfahren wie bei den Szenenbildern (scripts/copy-scenes.mjs): EINE Quelle
 * im Baum (`terra/`), die Zielordner sind Build-Artefakte und gitignored.
 * Gepflegt wird nur `terra/`.
 *
 * Aufruf: `node scripts/copy-terra.mjs` (pre-dev / pre-build in beiden Apps).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QUELLE = path.join(ROOT, "terra");

/** Zielapps. Beide brauchen den Editor unter ihrer EIGENEN Herkunft. */
const APPS = ["studio", "portal"];

/**
 * Was mitkommt. Bewusst eine Positivliste: `terra/test/` (Node-Tests,
 * Browser-Proben, Fixtures) und die README gehören nicht ins Web.
 */
const TEILE = ["index.html", "src", "vendor"];

function kopiereBaum(von, nach, zaehler) {
  const stat = fs.statSync(von);
  if (stat.isDirectory()) {
    fs.mkdirSync(nach, { recursive: true });
    for (const eintrag of fs.readdirSync(von)) {
      kopiereBaum(path.join(von, eintrag), path.join(nach, eintrag), zaehler);
    }
    return;
  }
  let ziel = null;
  try {
    ziel = fs.statSync(nach);
  } catch {
    ziel = null;
  }
  if (ziel && ziel.size === stat.size && ziel.mtimeMs >= stat.mtimeMs) {
    zaehler.gleich++;
    return;
  }
  fs.mkdirSync(path.dirname(nach), { recursive: true });
  fs.copyFileSync(von, nach);
  zaehler.kopiert++;
}

function main() {
  if (!fs.existsSync(QUELLE)) {
    console.error(`[copy-terra] Quelle fehlt: ${QUELLE}`);
    process.exit(1);
  }
  const fehlend = TEILE.filter((teil) => !fs.existsSync(path.join(QUELLE, teil)));
  if (fehlend.length > 0) {
    // Ein fehlendes Stück heißt: der Frame bleibt schwarz. Lieber hart
    // abbrechen als still einen halben Editor ausliefern.
    console.error(`[copy-terra] Fehlende Quellteile: ${fehlend.join(", ")}`);
    process.exit(1);
  }

  const zaehler = { kopiert: 0, gleich: 0 };
  for (const app of APPS) {
    const ziel = path.join(ROOT, "apps", app, "public", "terra");
    for (const teil of TEILE) {
      kopiereBaum(path.join(QUELLE, teil), path.join(ziel, teil), zaehler);
    }
    console.log(`[copy-terra] ${app}: terra/ -> apps/${app}/public/terra`);
  }
  console.log(`[copy-terra] ${zaehler.kopiert} kopiert, ${zaehler.gleich} unverändert.`);
}

main();
