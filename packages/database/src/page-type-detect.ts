import type { PageType } from "./generated/prisma/client";

/**
 * Seitentyp aus Titel, Inhalt und Tags ableiten.
 *
 * Importierte Texte (z. B. aus KnoteForge) tragen ihren Typ oft als Marker im
 * Fließtext oder Titel: „Kategorie: NPC", „Typ: Ort", „Category: Faction".
 * Bei der Konvertierung soll daraus der echte PageType werden, damit die
 * Seite in der richtigen Kategorie landet und im Graph korrekt eingefärbt
 * wird.
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

// Markdown-Zierzeichen um Marker/Wert (z. B. „**Kategorie:** NPC") werden vor
// dem Scan entfernt — sonst verhindern sie den Boundary- bzw. Werttreffer.
const MARKDOWN_DECORATION_PATTERN = /[*_~`]/g;

// „Kategorie: NPC", „Typ: Ort", „Category: Faction" — auch inline (nicht nur am
// Zeilenanfang), da importierte Blobs häufig alles in einer Zeile führen. Der
// vorangestellte Boundary verhindert Treffer wie „Prototyp:". „=" zusätzlich
// zu „:"/„：" als Trenner, „(" und „>" zusätzlich als Boundary (Klammern,
// Zitatzeilen).
const MARKER_PATTERN =
  /(?:^|[\s.;,•\-–—(>])(?:kategorie|typ|type|category|art)\s*[:：=]\s*([\p{L}][\p{L}\- ]*)/giu;

/** Label (Markerwert oder Tag) auf einen bekannten PageType auflösen. */
function resolveLabel(label: string): PageType | null {
  const normalized = label.trim().toLocaleLowerCase("de");
  if (!normalized) return null;

  // Mehrwortige Labels wie „dungeon-ebene" tauchen je nach Quelle mit
  // Leerzeichen statt Bindestrich auf („Dungeon Ebene") — beide Formen sollen
  // treffen.
  const direct = LABEL_TO_TYPE[normalized] ?? LABEL_TO_TYPE[normalized.replace(/\s+/g, "-")];
  if (direct) return direct;

  const firstWord = normalized.split(/\s+/)[0];
  return LABEL_TO_TYPE[firstWord] ?? null;
}

/** Ersten erkannten Marker in einem Text suchen (Titel oder Inhalt). */
function scanForMarker(text: string): PageType | null {
  if (!text) return null;
  const cleaned = text.replace(MARKDOWN_DECORATION_PATTERN, "");

  MARKER_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MARKER_PATTERN.exec(cleaned)) !== null) {
    const resolved = resolveLabel(match[1]);
    if (resolved) return resolved;
  }
  return null;
}

export interface PageTypeDetectionContext {
  content: string;
  /** Seitentitel — Importe tragen den Typ mitunter direkt im Titel statt im Fließtext. */
  title?: string | null;
  /** Bestehende Tags — ein Tag, der exakt einem bekannten Typ-Label entspricht, zählt als Treffer. */
  tags?: string[] | null;
}

/**
 * Erkennt den Seitentyp aus Titel, Inhalt und Tags. Priorität: Titel-Marker >
 * Inhalts-Marker > exakter Tag-Treffer — je gezielter das Signal, desto höher
 * die Priorität. Gibt `null` zurück, wenn nichts Eindeutiges gefunden wird.
 */
export function detectPageType(context: PageTypeDetectionContext): PageType | null {
  const fromTitle = scanForMarker(context.title ?? "");
  if (fromTitle) return fromTitle;

  const fromContent = scanForMarker(context.content);
  if (fromContent) return fromContent;

  for (const tag of context.tags ?? []) {
    const resolved = resolveLabel(tag);
    if (resolved) return resolved;
  }

  return null;
}

/**
 * Erkennt den Seitentyp anhand eines Typ-/Kategorie-Markers im Inhalt.
 * Rückwärtskompatibler Alias von {@link detectPageType} ohne Titel/Tags.
 */
export function detectPageTypeFromContent(content: string): PageType | null {
  return detectPageType({ content });
}
