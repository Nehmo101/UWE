/* ==========================================================================
   Loader-Haken fuer `node --test terra/test`.

   Zwei Aufgaben:

   1) AUFLOESEN (resolve)
      - 'three' und 'three/addons/*' zeigen auf die Ersatzmodule dieses
        Ordners. terra laedt Three ueber eine Import-Map vom CDN; Node kennt
        weder Import-Map noch node_modules unterhalb von terra/, der Bezeichner
        waere sonst schlicht unaufloesbar.
      - Einzelne terra-Module werden gegen schlanke Ersatzmodule getauscht
        (ERSATZ unten). Getauscht wird ausschliesslich, was Browser-Technik
        braucht (Canvas, WebGL) oder was reine Bedienoberflaeche ist — nie ein
        Modul, dessen Verhalten geprueft wird.

   2) LADEN (load)
      Manche Zusagen stecken in modul-INTERNEN Funktionen (io.js prueft und
      uebernimmt Karten, exportiert davon aber nur initIO). Statt den
      Produktivcode um Testexporte zu erweitern, haengt dieser Haken beim Laden
      eine zusaetzliche Exportzeile an — die Datei auf der Platte bleibt
      unangetastet. Fehlt eine der genannten Funktionen, schlaegt das Laden
      laut fehl statt still ein halbes Testfenster zu liefern.
   ========================================================================== */
import { statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* Node meldet fuer jede .js-Datei unter terra/src eine Warnung
   (MODULE_TYPELESS_PACKAGE_JSON): es gibt dort keine package.json mit
   "type": "module", Node parst die Datei also zweimal. Das ist so gewollt —
   terra laeuft im Browser ueber <script type="module"> und soll keine
   package.json bekommen, nur damit Node zufrieden ist. Diese eine Warnung
   wird deshalb hier (im Loader-Faden, wo sie entsteht) unterdrueckt; alle
   anderen bleiben sichtbar. */
const echteWarnung = process.emitWarning;
process.emitWarning = function (warnung, ...rest) {
  const code = (rest[0] && rest[0].code) || rest[1];
  if (code === 'MODULE_TYPELESS_PACKAGE_JSON') return;
  if (String(warnung).includes('MODULE_TYPELESS_PACKAGE_JSON')) return;
  return echteWarnung.call(process, warnung, ...rest);
};

const HIER = new URL('./', import.meta.url).href;
const ADDON_URL = HIER + 'addons-stub.mjs';

/* Normalfall: der eigene Three-Ersatz. Liegt eine ECHTE Three-Datei bereit
   (Umgebungsvariable TERRA_THREE oder terra/test/.three/three.module.js,
   siehe three-quelle.mjs), wird stattdessen die benutzt — dann laufen alle
   fuenf Ebenen gegen die gepinnte Fassung selbst. Der Ersatz ist gegen sie
   geprueft; beide Wege muessen dieselben Ergebnisse liefern. */
const THREE_URL = (() => {
  const kandidaten = [];
  if (process.env.TERRA_THREE) kandidaten.push(process.env.TERRA_THREE);
  kandidaten.push(fileURLToPath(new URL('../.three/three.module.js', import.meta.url)));
  for (const k of kandidaten) {
    try { if (statSync(k).isFile()) return pathToFileURL(k).href; } catch { /* nicht da */ }
  }
  return HIER + 'three-stub.mjs';
})();

/* terra-Modulpfad (unter src/) -> Ersatzdatei in hilfen/ersatz/ */
const ERSATZ = {
  'render/textures.js': 'textures.js',      // Canvas-Texturfabrik
  'render/pipeline.js': 'pipeline.js',      // WebGL-Renderer und Postprocessing
  'editor/camera.js': 'camera.js',          // Kamerazustand + Raycasting
  'editor/selection.js': 'selection.js',    // Griffe, Marker-Overlay
  'editor/history.js': 'history.js',        // Undo-Stapel (protokolliert Aufrufe)
  'editor/tools.js': 'tools.js',            // Werkzeugzustand (wird PARALLEL bearbeitet)
  'ui/panels.js': 'panels.js',              // Bedienoberflaeche (wird PARALLEL bearbeitet)
  'world/atmosphere.js': 'atmosphere.js',   // Tageszeit/Wetter, haengt an pipeline+sky
  'world/water.js': 'water.js'              // Wasserebene, haengt an camera+pipeline
};

/* Modulpfad -> Namen, die zusaetzlich exportiert werden sollen (Testfenster). */
const TESTFENSTER = {
  'editor/io.js': ['validiereKarte', 'validiereKarteObjekt', 'uebernehmeKarte', 'kartenDaten', 'pruefeElemente',
    'berechneHoehenDelta', 'wendeHoehenDeltaAn', 'setzeKartenGroesse']
};

function terraPfad(url) {
  const i = url.indexOf('/terra/src/');
  return i < 0 ? null : url.slice(i + '/terra/src/'.length);
}

export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: THREE_URL, shortCircuit: true };
  if (spec.startsWith('three/addons/')) return { url: ADDON_URL, shortCircuit: true };
  const ergebnis = await next(spec, ctx);
  const rel = terraPfad(ergebnis.url);
  if (rel && ERSATZ[rel]) {
    return { url: HIER + 'ersatz/' + ERSATZ[rel], format: 'module', shortCircuit: true };
  }
  return ergebnis;
}

export async function load(url, ctx, next) {
  const rel = terraPfad(url);
  const namen = rel && TESTFENSTER[rel];
  if (!namen) return next(url, ctx);
  const geladen = await next(url, ctx);
  let quelle = String(geladen.source);
  for (const n of namen) {
    // Nur Deklarationen auf oberster Ebene sind exportierbar — fehlt eine,
    // ist der Testabzug veraltet und soll das sagen.
    const gefunden = new RegExp('^(function|var|let|const|class)\\s+' + n + '\\b', 'm').test(quelle);
    if (!gefunden) {
      throw new Error('Testfenster: „' + n + '" existiert in ' + rel + ' nicht (mehr).');
    }
  }
  quelle += '\nexport { ' + namen.join(', ') + ' };\n';
  return { format: 'module', source: quelle, shortCircuit: true };
}
