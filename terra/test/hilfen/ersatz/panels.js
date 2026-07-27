/* Ersatz fuer ui/panels.js — reine Bedienoberflaeche (DOM). Die Aufrufe werden
   gezaehlt, damit ein Test belegen kann, dass ein Ladevorgang das Panel
   ueberhaupt neu gebaut hat. */
export const aufrufe = { buildPanel: 0, toast: 0, updateHint: 0 };
export function el(tag) { return { tag, children: [], style: {} }; }
export function buildRail() {}
export function paramRow() { return el('div'); }
export function buildPanel() { aufrufe.buildPanel++; }
export function updateHint() { aufrufe.updateHint++; }
export function toast(text) { aufrufe.toast++; aufrufe.letzterToast = text; }
export function tickToast() {}
export function updateStats() {}
export function markerOverlayAktualisieren() {}

/* I1: die Wege in den Kartenbaum meldet editor/io.js hier an. Der Ersatz haelt
   sie fest, damit eine Pruefung sie aufrufen kann, ohne ein DOM zu brauchen. */
export let kartenWege = null;
export function setzeKartenWege(w) { kartenWege = w; }
export function setzeErosionAnzeige() {}
