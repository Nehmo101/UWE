import type { PageType } from "./generated/prisma/client";

/**
 * Seitentyp aus dem Inhalt ableiten.
 *
 * Importierte Texte (z. B. aus KnoteForge) tragen ihren Typ oft als Marker im
 * Fließtext: „Kategorie: NPC", „Typ: Ort", „Category: Faction". Bei der
 * Konvertierung soll daraus der echte PageType werden, damit die Seite in der
 * richtigen Kategorie landet und im Graph korrekt eingefärbt wird.
 *
 * Rein deterministisch: ohne erkennbaren Marker wird `null` zurückgegeben —
 * es wird bewusst nicht geraten.
 */

/** Deutsche Anzeigenamen (PAGE_TYPE_LABELS) + geläufige Synonyme → PageType. */
const LABEL_TO_TYPE: Record<string, PageType> = {
  lore: "lore",
  hintergrund: "lore",
  wissenstext: "lore",
  ort: "location",
  orte: "location",
  location: "location",
  schauplatz: "location",
  region: "region",
  npc: "npc",
  nsc: "npc",
  fraktion: "faction",
  faction: "faction",
  organisation: "faction",
  gegenstand: "item",
  item: "item",
  "gegenstände": "item",
  dungeon: "dungeon",
  "dungeon-ebene": "dungeon_level",
  ebene: "dungeon_level",
  raum: "room",
  begegnung: "encounter",
  encounter: "encounter",
  falle: "trap",
  trap: "trap",
  "rätsel": "puzzle",
  raetsel: "puzzle",
  puzzle: "puzzle",
  loot: "loot",
  beute: "loot",
  geheimnis: "secret",
  secret: "secret",
  session: "session",
  sitzung: "session",
  quest: "quest",
  auftrag: "quest",
  aufgabe: "quest",
  handout: "handout",
  regel: "rule",
  rule: "rule",
  spielercharakter: "player_character",
  spieler: "player_character",
  monster: "monster",
  kreatur: "monster",
  sound: "sound",
  karte: "map",
  map: "map",
  notiz: "note",
  note: "note",
};

// „Kategorie: NPC", „Typ: Ort", „Category: Faction" — auch inline (nicht nur am
// Zeilenanfang), da importierte Blobs häufig alles in einer Zeile führen. Der
// vorangestellte Boundary verhindert Treffer wie „Prototyp:".
const MARKER_PATTERN =
  /(?:^|[\s.;,•\-–—])(?:kategorie|typ|type|category|art)\s*[:：]\s*([\p{L}][\p{L}\- ]*)/giu;

/**
 * Erkennt den Seitentyp anhand eines Typ-/Kategorie-Markers im Inhalt.
 * Gibt `null` zurück, wenn kein Marker oder kein bekannter Typ gefunden wird.
 */
export function detectPageTypeFromContent(content: string): PageType | null {
  if (!content) return null;

  MARKER_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MARKER_PATTERN.exec(content)) !== null) {
    const label = match[1].trim().toLocaleLowerCase("de");
    if (!label) continue;

    // Ganzer Ausdruck (z. B. „dungeon-ebene") vor dem ersten Wort prüfen.
    const direct = LABEL_TO_TYPE[label];
    if (direct) return direct;

    const firstWord = label.split(/\s+/)[0];
    const byWord = LABEL_TO_TYPE[firstWord];
    if (byWord) return byWord;
  }

  return null;
}
