/**
 * Der KI-Feinschliff auf der Gliederung.
 *
 * Die Regeln in `roles.ts` erkennen, was sich am Titel erkennen lässt: „EBENE 3",
 * „Begegnung: Die Genesenen", „Handouts". Was sie nicht erkennen können, ist ein
 * Name ohne Amtsbezeichnung — „Windhafen, die Boomstadt" ist ein Ort, „Tibbik
 * Moosfunke" eine Person, und beides steht dem Titel nicht an. Dafür ist die
 * lokale KI da: Sie liest die Gliederung samt Anreißern und sagt für jeden
 * Abschnitt, worum es geht.
 *
 * **Rein bleibt rein.** Dieses Modul baut nur die Anfrage und liest die Antwort.
 * Wer die KI tatsächlich ruft, sitzt in `@uwe/doc-import/ai` — dort, wo der
 * AI-Router und damit der Maschinenraum-Zwang hingehört. Damit bleibt die Zuordnung ohne
 * Host testbar, und ein stummer Maschinenraum kostet den Import nichts als einen Hinweis.
 *
 * **Der Vertrag ist eng.** Die KI darf eine Rolle *ändern*, nicht die Gliederung
 * erfinden: Sie bekommt Pfade, die es gibt, und ihre Antwort wird gegen genau
 * diese Pfade geprüft. Alles, was daneben liegt, fällt weg.
 */

import type { SectionRole } from "../types";
import type { OutlineEntry } from "./outline";

export type { OutlineEntry };

/** Rollen, die die KI vergeben darf. Gliederungsrollen bleiben den Regeln. */
export const AI_ASSIGNABLE_ROLES: readonly SectionRole[] = [
  "level",
  "room",
  "npc",
  "location",
  "faction",
  "item",
  "quest",
  "encounter",
  "trap",
  "puzzle",
  "loot",
  "secret",
  "handout",
  "rule",
  "section",
  "detail",
] as const;

const ASSIGNABLE = new Set<string>(AI_ASSIGNABLE_ROLES);

export interface OutlinePromptOptions {
  /** Wofür das Dokument gehalten wird — Kampagnenbuch, Dungeon, Weltkanon. */
  profileLabel: string;
  documentTitle: string;
  /** Name der Zielwelt, damit das Modell weiß, worin es einordnet. */
  worldName?: string;
  /**
   * Namen, die es in der Welt schon gibt und die in diesem Dokument vorkommen.
   * Genau die Kenntnis, an der die Titelmuster scheitern: „Windhafen" ist ein
   * Ort, und das steht dem Wort nicht an — aber es steht in der Datenbank.
   */
  knownEntities?: Array<{ title: string; type: string }>;
}

/**
 * Baut die Anfrage an die lokale KI.
 *
 * Bewusst ein einziger Durchgang über die Gliederung statt einer Anfrage pro
 * Abschnitt: Die Rollen hängen voneinander ab („alles unter Teil F sind
 * Werteblöcke"), und die serielle GPU-Lane verträgt keine 200 Einzelanfragen.
 */
export function buildOutlinePrompt(entries: OutlineEntry[], options: OutlinePromptOptions): string {
  const lines = entries.map((entry, index) =>
    `${index + 1}. [${entry.role}] ${entry.path}${entry.excerpt ? ` — ${entry.excerpt}` : ""}`,
  );

  // Höchstens so viele Namen; darüber wird die Anfrage länger als das Dokument.
  const known = (options.knownEntities ?? []).slice(0, 150);
  const worldSection = known.length
    ? [
        options.worldName
          ? `Diese Namen gibt es in der Welt „${options.worldName}" bereits und kommen im Dokument vor:`
          : "Diese Namen gibt es in der Zielwelt bereits und kommen im Dokument vor:",
        ...known.map((entity) => `- ${entity.title} (${entity.type})`),
        "Nutze sie zum Einordnen. Sie sind kein Auftrag, jeden davon irgendwo unterzubringen.",
        "",
      ]
    : [];

  return [
    `Du ordnest die Abschnitte eines Dokuments ein: „${options.documentTitle}"${options.worldName ? ` in der Welt „${options.worldName}"` : ""} (${options.profileLabel}).`,
    "Für jeden Abschnitt sagst du, wofür er steht — damit daraus sinnvolle Wiki-Seiten werden statt einer Seite pro Überschrift.",
    "",
    "Erlaubte Rollen:",
    "- level: eine Ebene/ein Stockwerk eines Dungeons",
    "- room: ein einzelner Raum innerhalb einer Ebene",
    "- npc: eine benannte Person oder Kreatur, die auftritt",
    "- location: ein Ort, Schauplatz oder Zugang",
    "- faction: eine Gruppe, Gilde, Fraktion",
    "- item: ein Gegenstand oder Artefakt",
    "- quest: ein Auftrag oder Handlungsstrang",
    "- encounter: eine Szene, Begegnung oder ein Kampf",
    "- trap, puzzle, loot, secret: Falle, Rätsel, Beute, Geheimnis",
    "- handout: ein Text zum Aushändigen an die Gruppe",
    "- rule: Regeln, Tabellen, Anhänge",
    "- section: eigenständiger Fließtext ohne konkreten Gegenstand",
    "- detail: Beiwerk, das in den Abschnitt darüber gehört und keine eigene Seite verdient",
    "",
    "Regeln:",
    "- Vergib nur für Abschnitte aus der Liste eine Rolle. Erfinde keine Pfade.",
    "- Lass Abschnitte weg, deren vorhandene Rolle (in eckigen Klammern) bereits stimmt.",
    "- Im Zweifel section. Erfinde keine Inhalte.",
    "",
    "Antworte NUR als JSON-Array:",
    '[{"nr":3,"rolle":"npc"}]',
    "",
    ...worldSection,
    "Abschnitte:",
    ...lines,
  ].join("\n");
}

/**
 * Liest die Antwort und macht daraus eine Pfad→Rolle-Karte.
 *
 * Nimmt die Nummer aus der Liste, nicht den Pfad: Ein Modell schreibt Pfade
 * gern um („Teil C > Ebene 1"), Nummern nicht. Alles, was nicht auf einen
 * bekannten Eintrag zeigt, fällt still weg.
 */
export function parseOutlineHints(
  text: string,
  entries: OutlineEntry[],
): Map<string, SectionRole> {
  const hints = new Map<string, SectionRole>();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return hints;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return hints;
  }

  if (!Array.isArray(parsed)) return hints;

  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;

    const index = Number.parseInt(String(record.nr ?? record.index ?? ""), 10);
    const role = String(record.rolle ?? record.role ?? "").trim().toLowerCase();
    if (!Number.isInteger(index) || !ASSIGNABLE.has(role)) continue;

    const entry = entries[index - 1];
    if (!entry) continue;

    hints.set(entry.path, role as SectionRole);
  }

  return hints;
}
