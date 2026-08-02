/**
 * Was die Welt schon weiß.
 *
 * Der Import las ein Dokument bisher, als wäre es das erste in dieser Welt. Das
 * ist fast nie so: „Windhafen" ist längst ein Ort, „Xarza" längst eine Person,
 * und beides steht in der Datenbank, an die dieser Import ohnehin schreibt.
 * Diese Kenntnis kostet nichts und beantwortet genau die Fragen, an denen die
 * Titelmuster scheitern — denn einem Namen sieht man nicht an, was er ist.
 *
 * Zwei Verwendungen, und die erste ist die wichtigere:
 *
 * 1. **Deterministisch.** Trägt eine Überschrift den Namen einer vorhandenen
 *    Seite, übernimmt der Import deren Typ. Kein Raten, kein RTX-Host nötig.
 * 2. **Als Kontext für die KI.** Die im Dokument tatsächlich vorkommenden
 *    Namen gehen mit in die Anfrage, damit das Modell einordnen kann statt zu
 *    erfinden.
 *
 * Beides läuft über dieselbe Liste. Sie kommt direkt aus dem Repository — kein
 * MCP, kein HTTP: Der Import sitzt auf derselben Maschine wie die Datenbank,
 * und ein Umweg über die laufende Studio-Instanz hieße, dass der Import aus dem
 * Command Center nur funktioniert, solange Studio läuft.
 */

import { normalizeLookupKey } from "@uwe/shared-utils/slug";
import type { PageType, SectionRole } from "../types";

export interface KnownEntity {
  title: string;
  type: PageType;
  aliases?: string[];
}

/**
 * Seitentypen, deren Name im Dokument etwas bedeutet.
 *
 * Bewusst nur Gegenstände. Dass es eine Seite „Kapitel 3" oder „Regeln" gibt,
 * sagt über eine gleichnamige Überschrift nichts — es sind Allerweltsnamen, und
 * ein Treffer darauf wäre Zufall, kein Wissen.
 */
const CONTEXT_TYPES: ReadonlySet<PageType> = new Set<PageType>([
  "npc",
  "monster",
  "location",
  "region",
  "faction",
  "item",
  "dungeon",
  "quest",
]);

/** Vom vorhandenen Seitentyp zurück auf die Rolle, die der Umbau versteht. */
const TYPE_TO_ROLE: Partial<Record<PageType, SectionRole>> = {
  npc: "npc",
  monster: "npc",
  location: "location",
  region: "location",
  faction: "faction",
  item: "item",
  quest: "quest",
  dungeon: "location",
};

export interface KnownEntityMatch {
  entity: KnownEntity;
  role: SectionRole;
}

/**
 * Baut den Nachschlage-Index über die Namen der Welt.
 *
 * Erster Treffer gewinnt — dieselbe Regel wie bei der Wikilink-Auflösung, damit
 * der Import nicht anders entscheidet als die Anzeige.
 */
export function buildKnownEntityIndex(
  entities: Iterable<KnownEntity>,
): Map<string, KnownEntityMatch> {
  const index = new Map<string, KnownEntityMatch>();

  for (const entity of entities) {
    const role = TYPE_TO_ROLE[entity.type];
    if (!role || !CONTEXT_TYPES.has(entity.type)) continue;

    for (const name of [entity.title, ...(entity.aliases ?? [])]) {
      const key = normalizeLookupKey(name ?? "");
      // Zu kurze Namen sind keine Kenntnis, sondern Kollisionen in spe.
      if (key.length < 4 || index.has(key)) continue;
      index.set(key, { entity, role });
    }
  }

  return index;
}

/** Kennt die Welt diesen Titel bereits? */
export function matchKnownEntity(
  title: string,
  index: Map<string, KnownEntityMatch> | undefined,
): KnownEntityMatch | null {
  if (!index) return null;
  return index.get(normalizeLookupKey(title)) ?? null;
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}_]/u.test(char);
}

/**
 * Die Namen, die im Dokument tatsächlich vorkommen.
 *
 * Eine Welt kann tausende Seiten haben; in eine Anfrage passt das nicht, und
 * das meiste davon hätte mit dem Dokument ohnehin nichts zu tun. Geschnitten
 * wird deshalb am Text selbst: Was nicht dasteht, hilft beim Einordnen nicht.
 */
export function selectMentionedEntities(
  entities: KnownEntity[],
  documentText: string,
  limit = 200,
): KnownEntity[] {
  const haystack = documentText.toLocaleLowerCase("de");
  const found: KnownEntity[] = [];

  for (const entity of entities) {
    if (!CONTEXT_TYPES.has(entity.type)) continue;

    const names = [entity.title, ...(entity.aliases ?? [])].filter(
      (name): name is string => typeof name === "string" && name.trim().length >= 4,
    );

    const mentioned = names.some((name) => {
      const needle = name.trim().toLocaleLowerCase("de");
      let from = 0;

      while (from <= haystack.length - needle.length) {
        const at = haystack.indexOf(needle, from);
        if (at < 0) return false;
        if (!isWordChar(haystack[at - 1]) && !isWordChar(haystack[at + needle.length])) return true;
        from = at + 1;
      }

      return false;
    });

    if (mentioned) found.push(entity);
    if (found.length >= limit) break;
  }

  return found;
}
