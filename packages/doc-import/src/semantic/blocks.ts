/**
 * Gegenstände aus dem Rumpf herauslösen.
 *
 * Ein Werteblock ist keine Überschrift. Er sieht so aus:
 *
 *     **F.2 Bannläufer** (3 in C.1.3) — *Mittelgroßer Konstrukt, ordnungsgemäß*
 *     **RK** 17 · **TP** 68 · **Tempo** 9 m
 *     **Multiattacke:** 2× Amtsgriff +7
 *
 *     **F.3 Wortmotten** (Schwarm) — *Schwarm winziger Bestien*
 *
 * Ein überschriftenbasierter Import macht daraus **eine** Seite „TEIL F —
 * WERTEBLÖCKE" mit elf Monstern darin. Am Spieltisch will man aber Nepurga
 * aufschlagen, nicht Teil F.
 *
 * Dasselbe gilt für Räume, die als Aufzählung stehen:
 *
 *     - **Der Ring:** Das Foyer läuft als Kreisgang um den Hohlkern.
 *     - **Die Wachstube (Ost):** Waffenständer, ein kaltes Kohlebecken.
 *
 * **Warum das nicht überall passiert.** Beide Muster kommen in gewöhnlichem
 * Fließtext ebenfalls vor — `**RK** 17` beginnt genauso mit Fettschrift wie
 * `**F.2 Bannläufer**`. Deshalb wird hier nichts erraten: Das Herauslösen läuft
 * ausschließlich in Abschnitten, deren Rolle es ausdrücklich vorsieht
 * (`statblock_list`, `handout_list`, `npc_list`, `room_list`), und der
 * Nummernblock am Anfang ist Pflicht. Ohne beides bleibt der Rumpf, wie er ist.
 */

import { collapseBlanks, isBlank, readDelimited, trimEndWhere, trimStartWhere } from "./scan";

const FENCE = /^(?:```|~~~)/;

/**
 * Die Gliederungsnummer am Anfang eines fetten Etiketts: `F.2 Bannläufer`.
 *
 * Angesetzt wird sie nur auf den bereits herausgelösten Fettschrift-Inhalt, nie
 * auf die ganze Zeile — der Ausdruck ist am Anfang verankert und läuft damit
 * einmal, nicht an jeder Position neu.
 */
const ENUMERATOR = /^([A-Za-zÄÖÜ]{0,2}\.?[ ]?\d+(?:\.\d+){0,2})(?=$|[^\d])/;

/** Trennzeichen zwischen Nummer und Namen: `F.2 — Bannläufer`. */
const SEPARATORS = new Set(["—", "–", "-", ":", "."]);

/** Aufzählungszeichen, hinter denen ein fettes Stichwort stehen darf. */
const BULLETS = new Set(["-", "*", "+"]);

export interface ExtractedBlock {
  /** Gliederungsnummer, unter der das Dokument auf den Block verweist. */
  label: string | null;
  title: string;
  /** Markdown des Blocks ohne die Titelzeile. */
  body: string;
}

export interface ExtractBlocksResult {
  /** Was vor dem ersten Block stand — bleibt Rumpf des Abschnitts. */
  lead: string;
  blocks: ExtractedBlock[];
}

function stripSeparator(value: string): string {
  const trimmed = trimStartWhere(value, isBlank);
  const rest = SEPARATORS.has(trimmed[0]) ? trimmed.slice(1) : trimmed;
  return trimStartWhere(rest, isBlank);
}

export function trimBlank(lines: string[]): string {
  const copy = [...lines];
  while (copy.length > 0 && !copy[0].trim()) copy.shift();
  while (copy.length > 0 && !copy[copy.length - 1].trim()) copy.pop();
  return copy.join("\n");
}

const TITLE_TAIL = new Set([".", ",", ";", ":"]);

/** Satzpunkt am Ende eines Handout-Titels weg: `Die Kanzleimappe.` → `Die Kanzleimappe`. */
function tidyTitle(value: string): string {
  return trimEndWhere(collapseBlanks(value), (char) => TITLE_TAIL.has(char)).trim();
}

/**
 * Liest eine Etikettzeile: `**F.2 Bannläufer** (3 in C.1.3) — …`.
 *
 * Von Hand statt per Muster. Ein Ausdruck wie `^\*\*\s*(…)\s*\*\*` lässt die
 * beiden `\s*` und die Gruppe dazwischen um dieselben Leerzeichen streiten;
 * fehlt der Abschluss, probiert die Maschine jede Aufteilung durch. Hier wird
 * einmal nach dem schließenden `**` gesucht — findet sich keines, ist Schluss.
 */
function readLabelledBold(line: string): { label: string; title: string; rest: string } | null {
  const bold = readDelimited(line, "**", "**");
  if (!bold) return null;

  const inner = trimStartWhere(bold.inner, isBlank);
  const enumerated = ENUMERATOR.exec(inner);
  if (!enumerated) return null;

  return {
    label: enumerated[1].replace(/ /g, ""),
    title: tidyTitle(stripSeparator(inner.slice(enumerated[1].length))),
    rest: bold.rest.trim(),
  };
}

/**
 * Liest eine Aufzählung mit fettem Stichwort: `- **Der Ring:** Das Foyer …`.
 *
 * Derselbe Grund für dieselbe Handarbeit wie oben.
 */
function readDefinitionBullet(line: string): { title: string; rest: string } | null {
  const withoutIndent = trimStartWhere(line, isBlank);
  if (!BULLETS.has(withoutIndent[0])) return null;

  const afterBullet = trimStartWhere(withoutIndent.slice(1), isBlank);
  if (afterBullet.length === withoutIndent.length - 1) return null; // kein Leerraum dahinter

  const bold = readDelimited(afterBullet, "**", "**");
  if (!bold) return null;

  const title = tidyTitle(bold.inner);
  return title ? { title, rest: stripSeparator(bold.rest) } : null;
}

/**
 * Löst nummerierte Fettschrift-Blöcke heraus.
 *
 * Ein neuer Block beginnt nur an einer Zeile, die mit `**` anfängt **und** eine
 * Gliederungsnummer trägt. `**RK** 17 · **TP** 68` mitten im Werteblock hat
 * keine, bleibt also beim laufenden Block — genau darauf kommt es an.
 */
export function extractLabelledBlocks(markdown: string): ExtractBlocksResult {
  const lines = markdown.split("\n");
  const lead: string[] = [];
  const blocks: ExtractedBlock[] = [];
  let current: { label: string | null; title: string; lines: string[] } | null = null;
  let inFence = false;

  for (const line of lines) {
    if (FENCE.test(line.trim())) inFence = !inFence;

    const match = inFence ? null : readLabelledBold(line);

    if (match) {
      if (current) blocks.push(finish(current));

      // `**F.2**` ohne Namen dahinter ist kein Gegenstand, sondern Auszeichnung.
      if (!match.title) {
        current = null;
        lead.push(line);
        continue;
      }

      current = { label: match.label, title: match.title, lines: match.rest ? [match.rest] : [] };
      continue;
    }

    if (current) current.lines.push(line);
    else lead.push(line);
  }

  if (current) blocks.push(finish(current));

  return { lead: trimBlank(lead), blocks };
}

function finish(open: { label: string | null; title: string; lines: string[] }): ExtractedBlock {
  return { label: open.label, title: open.title, body: trimBlank(open.lines) };
}

/**
 * Löst Aufzählungen mit fettem Stichwort heraus — die Räume einer Ebene.
 *
 * Fortsetzungszeilen (eingerückte Unterpunkte, Absätze) gehören zum letzten
 * Eintrag. Zeilen vor dem ersten Aufzählungspunkt bleiben Rumpf: die Einleitung
 * „Vier Nischen, alle mit Statuen" gehört zur Ebene, nicht zum ersten Raum.
 */
export function extractDefinitionBullets(markdown: string): ExtractBlocksResult {
  const lines = markdown.split("\n");
  const lead: string[] = [];
  const blocks: ExtractedBlock[] = [];
  let current: { title: string; lines: string[] } | null = null;
  let inFence = false;

  for (const line of lines) {
    if (FENCE.test(line.trim())) inFence = !inFence;

    const match = inFence ? null : readDefinitionBullet(line);

    if (match) {
      if (current) blocks.push({ label: null, title: current.title, body: trimBlank(current.lines) });
      current = { title: match.title, lines: match.rest ? [match.rest] : [] };
      continue;
    }

    // Eine gewöhnliche Aufzählung beendet den Block — sie gehört als
    // Unterpunkt dazu, wenn sie eingerückt ist, sonst ist die Liste vorbei.
    if (current) current.lines.push(line);
    else lead.push(line);
  }

  if (current) blocks.push({ label: null, title: current.title, body: trimBlank(current.lines) });

  return { lead: trimBlank(lead), blocks };
}

/**
 * Zeilen, mit denen ein 5e-Werteblock anfängt.
 *
 * Geprüft wird nur der **Zeilenanfang**, und das ist der ganze Trick: „Kein
 * Kampfblock. Ein 130-jähriger Mensch im Tiefschlaf, TP 9, hilflos." erwähnt
 * Trefferpunkte, ist aber Beschreibung. „**RK** 17 · **TP** 68" fängt damit an
 * und ist Regelwerk.
 */
const STATBLOCK_LINE =
  /^[*_]{0,2}(RK|AC|TP|HP|Tempo|R(ü|ue)stungsklasse|Trefferpunkte|STR|GES|KON|INT|WEI|CHA|Rettungsw(ü|ue)rfe|Fertigkeiten|Immun|Widerstand|Zustandsimmun|Multiattacke|Legend(ä|ae)re|Zauberwirken|Aktionen|Reaktionen|Sinne|Sprachen|Herausforderung)\b/i;

export interface SplitStatblock {
  /** Was die Kreatur ist — Typ, Auftreten, Verhalten. Bleibt auf der Hauptseite. */
  description: string;
  /** Die Regelwerte. Leer, wenn der Block gar keine trägt. */
  values: string;
}

/**
 * Trennt Beschreibung von Regelwerten.
 *
 * Ein Werteblock im Buch ist beides in einem: eine Zeile darüber, wer das ist,
 * darunter die Zahlen. Im Wiki sind das zwei verschiedene Dinge — das eine
 * schlägt man nach, wenn man wissen will, wem man begegnet, das andere, wenn
 * gewürfelt wird.
 *
 * Findet sich keine Wertezeile, bleibt alles Beschreibung. Lieber eine Seite
 * ohne Werteblock als ein Werteblock ohne Werte.
 */
export function splitStatblockBody(body: string): SplitStatblock {
  const lines = body.split("\n");
  const start = lines.findIndex((line) => STATBLOCK_LINE.test(line.trim()));

  if (start < 0) return { description: trimBlank(lines), values: "" };

  return {
    description: trimBlank(lines.slice(0, start)),
    values: trimBlank(lines.slice(start)),
  };
}

/**
 * Legt Text in einen DM-Bereich.
 *
 * Die Marke `:::dm` schneidet der Server aus jedem Lesepfad heraus, bevor
 * Inhalt einen Leser erreicht, der kein Studio-Häkchen trägt. Sie ist reiner
 * Text und braucht hier keine Abhängigkeit — der Import schreibt sie hin, das
 * Lesen wertet sie aus.
 */
export function wrapDmSection(title: string, body: string): string {
  // Leerzeilen sind Absicht: `marked` macht daraus eigene Absätze, und die
  // Marke landet als `<p>:::dm …</p>` im HTML — genau die Form, die der Parser
  // aus dem Rich-Text-Editor kennt. Ohne sie klebte die Marke mit den Werten in
  // einem einzigen Absatz zusammen.
  return [`:::dm ${title}`, "", body.trim(), "", ":::"].join("\n");
}

/**
 * Werteblock oder Person?
 *
 * Die ausdrückliche Ansage des Autors gewinnt: „kein Kampfblock", „Kein Kampf.
 * Er kämpft nie." — dann ist es eine Person, auch wenn Rüstungsklasse und
 * Trefferpunkte dabeistehen (Tibbik Moosfunke hat beides und kämpft trotzdem
 * nie). Sonst entscheiden die 5e-Marker.
 */
export function looksLikeCombatStatblock(body: string): boolean {
  if (/kein(en)?\s+(kampf|kampfblock|statblock|werteblock)/i.test(body)) return false;

  return /\bRK\b|\bAC\b|\bTP\b|\bHP\b|\bR(ü|ue)stungsklasse\b|\bTrefferpunkte\b|\bSG\s*\d|\bstandardwerte\b|\d\s*W\s*\d|multiattacke/i.test(
    body,
  );
}
