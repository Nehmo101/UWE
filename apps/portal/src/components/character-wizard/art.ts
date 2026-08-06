/**
 * Gibt es gezeichnete Kunst für Völker und Klassen?
 *
 * Der Katalog nennt für jeden Eintrag einen Pfad (`Species.art`,
 * `DndClass.art`) — das ist die Absicht, nicht der Bestand. Solange unter
 * `apps/portal/public/character-creator/` nichts liegt, würde jede Kachel eine
 * Anfrage ins Leere schicken: rund vierzig 404er pro Seitenaufruf, ein kurzes
 * Aufblitzen des kaputten Bildes, und eine Netzwerkspur, die man bei jedem
 * Fehlerbericht wieder wegerklärt.
 *
 * Deshalb dieser eine Schalter. Steht er auf `false`, zeichnen die Kacheln
 * direkt ihr aus dem Schlüssel abgeleitetes Wappen — das ist ohnehin der
 * Rückfall, und es folgt dem Theme, was eine über `<img>` geladene SVG-Datei
 * nicht kann (dort ist `currentColor` das eigene Dokument, nicht die Kachel).
 *
 * Wer echte Kunst liefert, legt die Dateien ab und setzt das hier auf `true`.
 * Der `onError`-Rückfall in `TileArt` bleibt als Netz für einzelne fehlende
 * Dateien bestehen.
 */
export const CHARACTER_ART_AVAILABLE = false;

/** Der Bildpfad, wenn es Kunst gibt — sonst nichts, damit nichts geladen wird. */
export function artSource(path: string | undefined): string | undefined {
  return CHARACTER_ART_AVAILABLE ? path : undefined;
}
