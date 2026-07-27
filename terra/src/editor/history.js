// Undo/Redo ueber Schnappschuesse von Elementliste und Terrainhoehen.
import { S, serializeElements, hydrate } from '../core/store.js';
import { base } from '../world/terrain.js';
import { rebuildAll } from '../core/dirty.js';
import { rebuildHandles } from './selection.js';
import { ed } from './tools.js';
import { buildPanel, toast } from '../ui/panels.js';

var undoStack = [], redoStack = [];

// Copy-on-Write fuer die Hoehen: base wird in-place mutiert, deshalb duerfen
// Schnappschuesse NIE base selbst referenzieren. Stattdessen haelt das Modul
// genau eine "letzte Terrainkopie"; Schnappschuesse ohne Terrainaenderung
// teilen sich diese Kopie als Referenz, nur bei Terrainaenderung entsteht per
// base.slice() eine neue. Die Kopien selbst werden nach Erzeugung nie mehr
// beschrieben (nur per base.set(...) ausgelesen) — Teilen ist daher sicher.
// Initialkopie beim Modulstart: der erste Schnappschuss braucht immer eine
// gueltige Referenz (ihr Inhalt heilt sich ueber terrainGeaendert selbst,
// falls genBase erst nach dem Import laeuft).
var letzteTerrainKopie = base.slice();

function terrainGeaendert() {
  for (var i = 0; i < base.length; i++) {
    if (base[i] !== letzteTerrainKopie[i]) return true;
  }
  return false;
}

/**
 * mitTerrain === true erzwingt eine frische Hoehenkopie (Aufrufer, die base
 * gleich aendern, z. B. Laden/Seed in io.js). Zusaetzlich erkennt der
 * Abgleich mit der letzten Kopie Aenderungen von Aufrufern, die kein
 * Argument uebergeben (der Terrain-Pinsel in pointer.js mutiert base nach
 * seinem pushUndo(); der naechste Schnappschuss muss den neuen Stand sichern).
 */
function snapshot(mitTerrain) {
  if (mitTerrain === true || terrainGeaendert()) letzteTerrainKopie = base.slice();
  return { el: JSON.stringify(serializeElements()), h: letzteTerrainKopie };
}

function pushUndo(mitTerrain) {
  undoStack.push(snapshot(mitTerrain));
  if (undoStack.length > 40) undoStack.shift();
  redoStack.length = 0;
}

function restore(s) {
  base.set(s.h);
  // Nach dem Wiederherstellen entspricht base exakt s.h — die geteilte Kopie
  // darauf umhaengen, damit terrainGeaendert() nicht faelschlich anschlaegt
  // und der naechste Schnappschuss keine unnoetige Vollkopie zieht.
  letzteTerrainKopie = s.h;
  hydrate(JSON.parse(s.el));
  ed.selected = null;
  ed.draw = null;
  rebuildAll();
  rebuildHandles();
  buildPanel();
}

function undo() {
  if (!undoStack.length) { toast("Nichts zum Rückgängigmachen"); return; }
  redoStack.push(snapshot());
  restore(undoStack.pop());
  toast("Rückgängig");
}

function redo() {
  if (!redoStack.length) { toast("Nichts zum Wiederholen"); return; }
  undoStack.push(snapshot());
  restore(redoStack.pop());
  toast("Wiederholt");
}


/** Historie verwerfen — noetig beim Wechsel der Kartengroesse (H1e): die
 *  gespeicherten Hoehenfelder passen danach nicht mehr zur Feldgroesse, ein
 *  Undo darueber hinweg wuerde ein inhaltlich fremdes Terrain herstellen. */
function verwerfeHistorie() {
  undoStack.length = 0;
  redoStack.length = 0;
  letzteTerrainKopie = base.slice();
}

export { snapshot, pushUndo, restore, undo, redo, verwerfeHistorie };
