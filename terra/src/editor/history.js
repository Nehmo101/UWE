// Undo/Redo ueber Schnappschuesse von Elementliste und Terrainhoehen.
import { serializeElements, hydrate } from '../core/store.js';
import { base } from '../world/terrain.js';
import { rebuildAll } from '../core/dirty.js';
import { rebuildHandles } from './selection.js';
import { ed } from './tools.js';
import { buildPanel, toast } from '../ui/panels.js';

var undoStack = [], redoStack = [];
function snapshot() { return { el: JSON.stringify(serializeElements()), h: base.slice() }; }

function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 40) undoStack.shift();
  redoStack.length = 0;
}

function restore(s) {
  base.set(s.h);
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


export { snapshot, pushUndo, restore, undo, redo };
