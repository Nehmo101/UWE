#!/usr/bin/env node
/**
 * Kopiert die Szenenbilder aus `assets/scenes/` in das `public/scenes/` der
 * jeweiligen App.
 *
 * Warum kopieren statt dreimal committen: die CSP erlaubt nur
 * `img-src 'self'` (packages/auth/src/security-headers.ts), jede App muss ihre
 * Bilder also vom eigenen Origin ausliefern. Drei committete Kopien wären das
 * Dreifache an Git-Historie — bei jeder künftigen Bild-Charge erneut. Die
 * `public/scenes/`-Ordner sind deshalb gitignored und werden hier erzeugt.
 *
 * Welche Datei wohin gehört, entscheidet die Pool-Tabelle in
 * `packages/shared-ui/src/scene/scenePools.ts` — nicht eine zweite Liste hier.
 *
 * Aufruf: `node --import tsx scripts/copy-scenes.mjs` (pre-dev / pre-build).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  HANDOUT_PREVIEW,
  SCENE_FILE_EXTENSION,
  scenesForAreas,
} from "../packages/shared-ui/src/scene/scenePools.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "assets", "scenes");

/**
 * Welche Flächen eine App zeigt. Die Landing hat seit der Apex-Trennung eine
 * eigene App (apps/landing, uweanddragons.org). Studio führt sie weiterhin mit,
 * weil `apps/studio/app/page.tsx` ohne getrennte Hostnamen (unified-path bzw.
 * lokale Entwicklung) nach wie vor die Landing rendert.
 */
const APP_AREAS = {
  landing: ["landing"],
  studio: ["landing", "studio"],
  portal: ["portal"],
  brain: ["brain"],
};

/** Das Handout-Thumbnail zeigt nur das Portal. */
const EXTRA_FILES = {
  portal: [HANDOUT_PREVIEW.src + SCENE_FILE_EXTENSION],
};

function copyFileIfChanged(from, to) {
  const src = fs.statSync(from);
  let dst;
  try {
    dst = fs.statSync(to);
  } catch {
    dst = null;
  }
  if (dst && dst.size === src.size && dst.mtimeMs >= src.mtimeMs) {
    return false;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`[copy-scenes] Quelle fehlt: ${SOURCE}`);
    process.exit(1);
  }

  let copied = 0;
  let skipped = 0;
  const missing = [];

  for (const [app, areas] of Object.entries(APP_AREAS)) {
    const target = path.join(ROOT, "apps", app, "public", "scenes");
    const files = [...scenesForAreas(areas), ...(EXTRA_FILES[app] ?? [])];

    for (const file of files) {
      const from = path.join(SOURCE, file);
      if (!fs.existsSync(from)) {
        missing.push(`${app}: ${file}`);
        continue;
      }
      if (copyFileIfChanged(from, path.join(target, file))) copied++;
      else skipped++;
    }
    console.log(`[copy-scenes] ${app}: ${files.length} Dateien -> apps/${app}/public/scenes`);
  }

  if (missing.length > 0) {
    // Eine fehlende Datei ist ein bildloser Hintergrund im Browser und sonst
    // nichts — deshalb hart abbrechen statt still weiterlaufen.
    console.error(`[copy-scenes] Fehlende Quelldateien:\n  ${missing.join("\n  ")}`);
    process.exit(1);
  }

  console.log(`[copy-scenes] ${copied} kopiert, ${skipped} unverändert.`);
}

main();
