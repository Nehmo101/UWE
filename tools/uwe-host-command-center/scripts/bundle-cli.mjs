#!/usr/bin/env node
/**
 * Bündelt die Desktop-Host-CLI zu einer einzelnen CommonJS-Datei für die
 * Bundle-Installation: Dort gibt es weder das Monorepo noch tsx — das Command
 * Center startet `node host-cli.cjs <aktion>` mit der mitgelieferten
 * Node-Laufzeit (siehe bundled_host_runtime_dir in command_center.rs).
 *
 * Die CLI-Importkette ist bewusst leicht (node-Builtins + eigene Module).
 * Sollte jemand später @uwe/database o. Ä. hineinziehen, schlägt der Build hier
 * fehl bzw. das Bundle explodiert — der Größen-Check unten macht das sichtbar,
 * bevor es ein Release tut.
 *
 * Usage: node scripts/bundle-cli.mjs [--out pfad/host-cli.cjs]
 */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const HIER = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const PAKET = path.resolve(HIER, "..");

const argv = process.argv.slice(2);
const outIndex = argv.indexOf("--out");
const outfile = path.resolve(
  outIndex >= 0 ? argv[outIndex + 1] : path.join(PAKET, "dist", "host-cli.cjs"),
);

const ergebnis = await build({
  entryPoints: [path.join(PAKET, "src", "desktop-host-cli.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile,
  sourcemap: false,
  logLevel: "warning",
  // Nur echte Laufzeit-Injektionen bleiben draußen; alles Eigene wird
  // eingebacken. Node-Builtins behandelt platform:node ohnehin als extern.
  external: [],
});

if (ergebnis.errors.length > 0) process.exit(1);

const groesse = fs.statSync(outfile).size;
const MAX_BYTES = 2 * 1024 * 1024;
if (groesse > MAX_BYTES) {
  console.error(
    `host-cli.cjs ist ${(groesse / 1024 / 1024).toFixed(1)} MB — die CLI-Kette hat schwere ` +
      "Abhängigkeiten gezogen (Budget: 2 MB). Import-Kette prüfen, bevor das ins Release geht.",
  );
  process.exit(1);
}
console.log(`host-cli.cjs — ${(groesse / 1024).toFixed(0)} KB → ${outfile}`);
