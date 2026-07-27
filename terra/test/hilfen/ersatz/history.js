/* Ersatz fuer editor/history.js.
   Der echte Undo-Stapel sichert Elemente UND das komplette Hoehenfeld; er
   gehoert nicht zu den fuenf Testebenen, wird aber von io.js aufgerufen. Hier
   werden die Aufrufe nur gezaehlt — genau das braucht die Atomaritaetspruefung
   (Ebene 2): ein gescheitertes Laden darf keinen Undo-Punkt hinterlassen. */
export const aufrufe = { pushUndo: 0, verwerfeHistorie: 0, restore: 0 };
export function snapshot() { return { elemente: [], hoehen: null }; }
export function pushUndo() { aufrufe.pushUndo++; }
export function restore() { aufrufe.restore++; }
export function undo() {}
export function redo() {}
export function verwerfeHistorie() { aufrufe.verwerfeHistorie++; }
