/* Ersatz fuer editor/tools.js.
   Grund: tools.js ist reiner Werkzeug-/Bedienzustand (Auswahl, Zeichnen,
   Stempel) und haengt an panels.js und selection.js. core/dirty.js braucht von
   dort nur `defaultsFor`, editor/io.js nur `ed` und `stempelUebernehmen`.

   `defaultsFor` liefert hier BEWUSST nichts: die Testelemente tragen ihre
   Parameter vollstaendig (hilfen/karte.mjs). Damit haengt kein Testergebnis am
   Parameterschema — und ein fehlender Schluessel faellt als Fehler auf, statt
   von einem Standardwert stillschweigend geheilt zu werden. */
export const ed = {
  tool: 'pfad',
  variantOf: { pfad: 'strasse', flaeche: 'wald', objekt: 'baeume', ranke: 'ranke',
    terrain: 'heben', marker: 'ort', stempel: '', wegsuche: 'strasse' },
  draw: null,
  selected: null,
  auswahl: [],
  stempelDrehung: 0,
  stempelSpiegel: false
};
export function defaultsFor() { return {}; }
export function schemaKey(kind, variant) { return kind + ':' + variant; }
export function stempelUebernehmen(liste) { return liste ? liste.length : 0; }
export function toolParams() { return []; }
export function curParams() { return {}; }
export function copyParams(p) { return Object.assign({}, p); }
export function snapPt(p) { return p; }
export function finishDraw() {}
export function cancelDraw() {}
export function setTool() {}
export function auswahlElemente() { return []; }
/* Runde H (Bedienung): handgesetzte Kartenzeichen. Im Node-Test entstehen
   keine Signatur-Instanzen (kein Atlas, keine Szene) — die Logik prueft der
   Browsertest (test/browser/runde-h-voll.mjs). */
export function genZeichenMarker() { return 0; }
export function zeichenMarkerNachziehen() { return 0; }
export function aktuellerStempel() { return null; }
export function stempelErzeugen() { return null; }
export function stempelSetzen() {}
export function stempelBibliothekLaden() {}
export function stempelBibliothekSichern() {}
export const TOOLS = [];
export const VARIANTS = {};
export const PARAMS = {};

/* I1: der Ausschnitt meldet sein Polygon ueber diesen Weg an editor/io.js.
   Im Test wird er nur angemeldet, nie ausgeloest — es gibt keinen Zeiger, der
   ein Polygon zeichnen koennte. `letzterAusschnittWeg` liegt trotzdem offen,
   damit eine Pruefung ihn von Hand rufen kann. */
export let letzterAusschnittWeg = null;
export function setzeAusschnittWeg(fn) { letzterAusschnittWeg = fn; }
export const EROSION_PARAMS = [];
export const erosionRegler = {};
export const KARTE_PARAMS = [];
export const karteParams = {};
export function aktiveSprachfamilie() { return 'neutral'; }
