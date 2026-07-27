/* ==========================================================================
   Zugang zur GEPINNTEN Three-Fassung (0.185.1, siehe Import-Map in
   terra/index.html).

   Die Shader-Anker duerfen NICHT gegen den Three-Ersatz dieses Ordners
   geprueft werden — der ist selbst geschrieben und wuerde genau den Fehler
   verstecken, den die Pruefung finden soll. Es gibt deshalb zwei Quellen:

     1. Eine echte Three-Datei, falls vorhanden. Gesucht wird sie
        - unter dem Pfad in der Umgebungsvariablen TERRA_THREE
        - in terra/test/.three/three.module.js
        Beide sind ABSICHTLICH nicht Teil des Projekts: terra hat keinen
        Build-Schritt und soll keine 2 MB Fremdcode im Baum tragen. Wer die
        staerkere Pruefung will, legt die Datei einmal dorthin:
            mkdir terra/test/.three
            curl -o terra/test/.three/three.module.js \
              https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js
            curl -o terra/test/.three/three.core.js \
              https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.core.js
        (three.module.js importiert three.core.js aus demselben Ordner.)

     2. Sonst die mitgelieferte Ankerliste
        fixtures/three-0.185.1-anker.json. Sie wurde aus genau dieser Datei
        erzeugt und enthaelt die 142 Chunk-Namen, die Include-Listen der
        benutzten Programme und die Textanker innerhalb zweier Chunks.

   Liegt die echte Datei vor, prueft der Test beides gegeneinander — die
   Ankerliste kann dann nicht unbemerkt veralten.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { TEST } from './laden.mjs';

export const ANKERLISTE = JSON.parse(
  fs.readFileSync(path.join(TEST, 'fixtures', 'three-0.185.1-anker.json'), 'utf8'));

function quelleSuchen() {
  const kandidaten = [];
  if (process.env.TERRA_THREE) kandidaten.push(process.env.TERRA_THREE);
  /* J1 — seit die Content-Security-Policy von UWE keinen fremden Host mehr
     erlaubt, liegt three MIT im Baum (terra/vendor/three/, siehe
     terra/vendor/HERKUNFT.md). Damit ist die STARKE Pruefung nicht mehr die
     Ausnahme, die man sich von Hand einrichtet, sondern der Regelfall: jeder
     Lauf prueft die Shader-Anker gegen die echte Quelle statt gegen eine
     mitgelieferte Liste, die unbemerkt veralten koennte.

     Die beiden alten Wege bleiben davor stehen — wer eine ANDERE Fassung
     gegenpruefen will, setzt weiterhin TERRA_THREE oder legt eine Datei nach
     terra/test/.three/. */
  kandidaten.push(path.join(TEST, '.three', 'three.module.js'));
  kandidaten.push(path.join(TEST, '..', 'vendor', 'three', 'three.module.js'));
  for (const k of kandidaten) {
    try { if (fs.statSync(k).isFile()) return k; } catch { /* nicht da */ }
  }
  return null;
}

/** Include-Namen eines Shader-Quelltextes, sortiert und ohne Doppelte. */
export function includesVon(quelltext) {
  const treffer = quelltext.match(/#include <([a-z_0-9]+)>/g) || [];
  return [...new Set(treffer.map((m) => m.slice(10, -1)))].sort();
}

/**
 * Laedt die echte Three-Fassung, wenn sie erreichbar ist.
 * @returns {Promise<null|{pfad:string, revision:string, chunks:string[],
 *   programme:object, ShaderChunk:object}>}
 */
export async function echteThreeQuelle() {
  const pfad = quelleSuchen();
  if (!pfad) return null;
  const T = await import(pathToFileURL(pfad).href);
  const programme = {};
  for (const k of Object.keys(ANKERLISTE.programme)) {
    if (!T.ShaderLib[k]) continue;
    programme[k] = {
      vertex: includesVon(T.ShaderLib[k].vertexShader),
      fragment: includesVon(T.ShaderLib[k].fragmentShader)
    };
  }
  return {
    pfad,
    revision: T.REVISION,
    chunks: Object.keys(T.ShaderChunk).sort(),
    programme,
    ShaderChunk: T.ShaderChunk
  };
}
