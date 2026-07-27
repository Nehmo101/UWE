/* Ersatz fuer world/atmosphere.js. Das Original mischt Presets in Lichter,
   Nebel, Himmel, Wasser und Postprocessing — alles Rendering. Fuer die
   Formatpruefung zaehlt nur, dass Tageszeit und Wetter TOLERANT gesetzt und
   unveraendert zurueckgelesen werden: eine unbekannte Lage faellt auf den
   Standard zurueck, statt einen Formatfehler zu werfen (so steht es in io.js
   und so soll es bleiben). Die Namenslisten sind die der Auswahlfelder in
   terra/index.html. */
export const PRESETS = { morgen: {}, mittag: {}, abend: {}, nebel: {}, nacht: {} };
export const WETTER = { klar: {}, bewoelkt: {}, regen: {}, schneefall: {}, sturm: {} };

let tod = 'mittag';
let wetter = 'klar';
export const aufrufe = { setTod: 0, setWetter: 0 };

export function setTod(name) {
  aufrufe.setTod++;
  if (PRESETS[name]) tod = name;
}
export function getTodName() { return tod; }
export function setWetter(name) {
  aufrufe.setWetter++;
  wetter = WETTER[name] ? name : 'klar';
}
export function getWetterName() { return wetter; }
export function getWolkenTempo() { return 1; }
export function applyTod() {}
export function tickAtmosphere() {}
export function initAtmosphere() {}
export function updateBirds() {}
export function updateRauch() {}
export function setRauchQuellen() {}
export function boeeWert() { return 0; }
export const sun = null, hemi = null, rimLight = null, birdMesh = null;
export const fogMittel = 0;
export const BIRD_FLOCKS = 0, BIRD_PER = 0;
