/* Ersatz fuer editor/history.js.
   Der echte Undo-Stapel sichert Elemente UND das komplette Hoehenfeld; er
   gehoert nicht zu den fuenf Testebenen, wird aber von io.js aufgerufen. Hier
   werden die Aufrufe nur gezaehlt — genau das braucht die Atomaritaetspruefung
   (Ebene 2): ein gescheitertes Laden darf keinen Undo-Punkt hinterlassen. */
export const aufrufe = { pushUndo: 0, verwerfeHistorie: 0, restore: 0,
  parken: 0, holen: 0, geparkteVerworfen: 0, letztesGeparkt: null, letztesGeholt: null };
export function snapshot() { return { elemente: [], hoehen: null }; }
export function pushUndo() { aufrufe.pushUndo++; }
export function restore() { aufrufe.restore++; }
export function undo() {}
export function redo() {}
export function verwerfeHistorie() { aufrufe.verwerfeHistorie++; return 0; }

/* Runde H — ein Stapel je Karte. editor/io.js parkt den Stapel der Karte, die
   es verlaesst, und holt ihn beim Zurueckkehren wieder. Der Ersatz zaehlt die
   Aufrufe und merkt sich die Kennungen: die Reihenfolge (parken VOR
   uebernehmeKarte, holen DANACH) ist eine Zusage, die sich ohne Undo-Stapel
   pruefen laesst. */
export function historieKarteParken(id) { aufrufe.parken++; aufrufe.letztesGeparkt = id; return 0; }
export function historieKarteHolen(id) { aufrufe.holen++; aufrufe.letztesGeholt = id; return 0; }
export function verwerfeGeparkteHistorien() { aufrufe.geparkteVerworfen++; return 0; }
export function geparkteHistorien() { return 0; }
export function schritteInHistorie() { return 0; }
