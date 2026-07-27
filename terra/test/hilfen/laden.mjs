/* ==========================================================================
   Einstiegspunkt jeder Testdatei.

   Verantwortlich fuer die Reihenfolge, die in ESM nicht selbstverstaendlich
   ist: der Loader-Haken muss REGISTRIERT sein, bevor das erste terra-Modul
   aufgeloest wird. Statische `import`-Anweisungen werden aber alle vor dem
   ersten Anweisungsschritt ausgefuehrt — deshalb laufen die terra-Module ueber
   `ladeTerra()` (dynamischer Import) und niemals ueber einen statischen Import
   in einer Testdatei.

   Gebrauch:
       import { ladeTerra } from './hilfen/laden.mjs';
       const store = await ladeTerra('core/store.js');
   ========================================================================== */
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import './dom-stub.mjs';

register('./haken.mjs', import.meta.url);

const HIER = path.dirname(fileURLToPath(import.meta.url));
/** Absoluter Pfad zu terra/src. */
export const SRC = path.resolve(HIER, '..', '..', 'src');
/** Absoluter Pfad zu terra/ (fuer index.html, README). */
export const TERRA = path.resolve(HIER, '..', '..');
/** Absoluter Pfad zu terra/test/. */
export const TEST = path.resolve(HIER, '..');

/** Laedt ein terra-Modul, z. B. ladeTerra('generators/geometry.js'). */
export function ladeTerra(rel) {
  return import(pathToFileURL(path.join(SRC, rel)).href);
}

/**
 * Laedt die komplette Generatorkette in EINEM Rutsch und gibt die
 * Namensraeume gebuendelt zurueck. Die Reihenfolge ist die aus main.js:
 * geometry.js registriert beim Modulstart alle Pools und muss deshalb vor der
 * ersten Erzeugung geladen sein.
 */
export async function ladeGeneratoren() {
  const rng = await ladeTerra('core/rng.js');
  const store = await ladeTerra('core/store.js');
  const pools = await ladeTerra('core/pools.js');
  const terrain = await ladeTerra('world/terrain.js');
  const geometry = await ladeTerra('generators/geometry.js');
  const paths = await ladeTerra('generators/paths.js');
  const objects = await ladeTerra('generators/objects.js');
  const areas = await ladeTerra('generators/areas.js');
  const strukturen = await ladeTerra('generators/strukturen.js');
  const vines = await ladeTerra('generators/vines.js');
  const dirty = await ladeTerra('core/dirty.js');
  return { rng, store, pools, terrain, geometry, paths, objects, areas, strukturen, vines, dirty };
}
