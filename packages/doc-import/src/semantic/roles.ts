/**
 * Wofür ein Abschnitt steht — die Rollenerkennung.
 *
 * Der alte Import kannte genau eine Frage: „Wie tief steht diese Überschrift?"
 * Daraus wurde `Überschrift = Seite`, und ein Kampagnenbuch zerfiel in 176
 * Fragmente, von denen 140 aus zwei Sätzen bestanden. Dieses Modul stellt die
 * andere Frage: **Wovon handelt dieser Abschnitt?**
 *
 * Die Antwort ist eine {@link SectionRole}, und erst sie entscheidet über das
 * Schicksal des Abschnitts:
 *
 * - **Gegenstandsrollen** (`level`, `room`, `npc`, `encounter`, `handout` …)
 *   werden eigene Seiten. Ein Raum ist eine Sache, über die man am Spieltisch
 *   nachschlägt.
 * - **Listenrollen** (`room_list`, `statblock_list`, `handout_list`, `npc_list`)
 *   werden nicht selbst zum Gegenstand, sondern lösen sich in ihre Einträge auf.
 *   „Die Räume" ist keine Seite; die vier Räume darin sind vier Seiten.
 * - **Textrollen** (`section`, `detail`) werden gar keine Seite, sondern Rumpf
 *   der nächsten Seite darüber. „Was man hier lernt" gehört auf die Ebene, auf
 *   der man es lernt.
 *
 * Die Muster sind deutsch und bewusst schlicht: erste passende Regel gewinnt.
 * Sie sind eine Vorbelegung, keine Wahrheit — deshalb steht der Typ jeder Seite
 * in der Vorschau und lässt sich dort korrigieren, bevor geschrieben wird. Wenn
 * der Maschinenraum-Host antwortet, korrigiert die KI schon vorher (siehe `ai-hints.ts`).
 */

import type { DocProfile, DocumentNode, SectionRole } from "../types";
import { isPartHeading, splitHeadingLabel } from "./headings";
import { matchKnownEntity, type KnownEntityMatch } from "./world-context";

export { isPartHeading, splitHeadingLabel, tidyHeadingText } from "./headings";

interface RoleRule {
  pattern: RegExp;
  role: SectionRole;
}

/**
 * Ebenen eines Dungeons — inklusive Dach und Keller, die keine Nummer tragen.
 *
 * Die Ebenenangabe muss **vorn** stehen oder hinter einem Gedankenstrich: sonst
 * würde „Startbedingungen (abhängig von Ebene 6)" zur Ebene, und im Cockpit
 * stünde ein Kampfhinweis zwischen den Stockwerken.
 */
const LEVEL_HEAD = "(?:^|[—–|]\\s*)(?:die |der |das )?";

const LEVEL_RULES: RoleRule[] = [
  { pattern: new RegExp(`${LEVEL_HEAD}(ebene|etage|stockwerk|geschoss|level|floor)\\s*[0-9ivxlc]+\\b`, "i"), role: "level" },
  { pattern: /^(das\s+)?dach\b|^dachterrasse|^rooftop|^(die\s+)?turmspitze\b/i, role: "level" },
  { pattern: /^(der\s+|die\s+|das\s+)?(keller|kellergeschoss|katakomben|untergeschoss)\b/i, role: "level" },
  { pattern: /^(das\s+)?erdgeschoss\b/i, role: "level" },
];

/**
 * Der Außenbereich vor dem eigentlichen Bau.
 *
 * Er trägt keine Ebenennummer, ist aber am Spieltisch genau das: die Ebene, auf
 * der die Gruppe ankommt. Ohne diese Regel steht die Anfahrt neben dem Dungeon
 * statt darin, und das Cockpit fängt erst im ersten Stock an.
 *
 * Achtung Komposita: vor `plattform` steht **keine** Wortgrenze, sonst fände
 * die Regel „Die Wurzelplattform" nicht — deutsche Überschriften kleben
 * Wörter zusammen.
 */
const APPROACH_PATTERN =
  /(plattform|anfahrt|vorplatz|au(ß|ss)enbereich|au(ß|ss)engel(ä|ae)nde|\bumgebung|\bankunft|\banmarsch|zugangsebene|\bhof\b)/i;

/**
 * Quest-Verzeichnisse und redaktionelle Quest-Anleitungen sind selbst keine
 * Quests. Die allgemeine Quest-Regel weiter unten darf sie deshalb nicht
 * einfangen; sonst erscheinen Katalog und Anleitung neben den spielbaren
 * Aufträgen im Kampagnen-Cockpit.
 */
const QUEST_CONTAINER_PATTERN = /^(questkatalog\b|nebenquests?\s+(?:von|des|der|in|im)\b)/i;
const QUEST_GUIDANCE_PATTERN =
  /^(kleine quests? f(ü|ue)hren\b|am tisch\b.*\bquests?\b|regeln f(ü|ue)r\b.*\bquests?\b|auf einen blick\b.*\bquests?\b)/i;

const ENTITY_RULES: RoleRule[] = [
  { pattern: /^(die\s+|der\s+|das\s+)?r(ä|ae)ume\b|^r(ä|ae)umlichkeiten\b|^raum(übersicht|liste)/i, role: "room_list" },
  { pattern: /^(die\s+)?(kammern|s(ä|ae)le|hallen)\b/i, role: "room_list" },
  { pattern: /wertebl(o|ö)ck|statblock|bestiarium|monsterwerte|kreaturen(werte)?\b/i, role: "statblock_list" },
  { pattern: /^handouts?\b|^spielerhandouts?\b|^ausgaben\b/i, role: "handout_list" },
  { pattern: /^(wichtige\s+)?(nsc|nscs|npc|npcs|personen|figuren|dramatis\s+personae|mitwirkende)\b/i, role: "npc_list" },
  { pattern: /^\s*szene\b|^\s*scene\b|begegnung|encounter|^der\s+kampf\b|^\s*kampf:/i, role: "encounter" },
  { pattern: /r(ä|ae)tsel|puzzle/i, role: "puzzle" },
  { pattern: /\bfallen?\b|\btraps?\b/i, role: "trap" },
  { pattern: /\bbeute\b|\bloot\b|sch(a|ä)tze?\b|belohnung(en)?\b/i, role: "loot" },
  { pattern: /geheimnis(se)?\b|\bsecrets?\b/i, role: "secret" },
  { pattern: /^\s*(raum|room)\s*[0-9a-z]{1,3}\b/i, role: "room" },
  { pattern: /\b(saal|kammer|halle|zelle|krypta|gew(ö|oe)lbe|foyer|korridor|treppenhaus)\b/i, role: "room" },
  { pattern: /quests?\b|auftr(ä|ae)ge?\b|missionen\b/i, role: "quest" },
  { pattern: /fraktion(en)?\b|gilde|kult\b|\borden\b|\bbund\b|zirkel\b/i, role: "faction" },
  { pattern: /magische\s+gegenst(ä|ae)nde|artefakte?\b|^gegenst(ä|ae)nde\b/i, role: "item" },
  { pattern: /\bregeln?\b|hausregeln|^tabellen?\b|^anh(ä|ae)nge?\b/i, role: "rule" },
  { pattern: /^(der\s+)?zugang\b|zug(ä|ae)nge\b|^orte\b|^schaupl(ä|ae)tze\b|^die\s+stadt\b|^umgebung\b/i, role: "location" },
];

/**
 * Amtsbezeichnungen, hinter denen ein Name steht.
 *
 * Sehr enge Liste, und das ist Absicht: Aus „Der Kantor" einen NSC zu machen ist
 * richtig, aus „Der Turm" wäre es falsch. Wer allein am Namen erkannt werden
 * will, braucht die KI — die Regel rät hier nicht.
 */
const NPC_TITLE =
  /(?:^|:\s*)(der\s+|die\s+|das\s+)?(magister|magistra|magier|magierin|inquisitor|inquisitorin|hauptmann|kapit(ä|ae)n|meister|meisterin|bruder|schwester|pater|lord|lady|k(ö|oe)nig|k(ö|oe)nigin|f(ü|ue)rst|f(ü|ue)rstin|graf|gr(ä|ae)fin|baron|baronin|doktor|professor|erzmagier|priester|priesterin|general|kommandant|kantor|spindelwart|w(ä|ae)chter|verwalter|wirt|schmied)\b/i;

/** Beiwerk: richtig, wichtig — aber keine Sache, die eine eigene Seite verdient. */
const DETAIL_RULES: RegExp[] = [
  /^was\s+(man|hier|die\s+gruppe)\b/i,
  /^auf\s+einen\s+blick$/i,
  /^leitmotiv\b/i,
  /^ansage\b/i,
  /^(kurz)?(übersicht|zusammenfassung)$/i,
  /^hinweise?$/i,
  /^startbedingungen\b/i,
  /^phase\s*\d/i,
  /^der\s+tod$/i,
  /^mechanik:/i,
  /^vorlesen\b/i,
  /^(die\s+)?grundwahrheit\b/i,
  /^sporenquelle\b/i,
  /^erfahrung\b|^stufenaufstieg\b/i,
];

export interface ClassifyContext {
  profile: DocProfile;
  /** Rolle des Elternknotens — entscheidet, ob ein Eintrag Raum oder Abschnitt ist. */
  parentRole: SectionRole | null;
  /** Wurzelknoten des Dokuments. */
  isRoot: boolean;
  /**
   * Namen, die es in der Zielwelt schon gibt. Trägt eine Überschrift einen
   * davon, ist die Frage „wovon handelt das" bereits beantwortet — die Welt
   * weiß es besser als jedes Titelmuster.
   */
  knownEntities?: Map<string, KnownEntityMatch>;
}

/**
 * Bestimmt die Rolle eines Abschnitts.
 *
 * Reihenfolge: Wurzel → Kontext des Elternteils → Ebenen → Gegenstandsmuster →
 * Beiwerk → Gliederungsteil → einfacher Abschnitt. Der Kontext steht so weit
 * vorn, weil dieselbe Überschrift verschiedene Dinge bedeutet: „Der Ring" unter
 * „Die Räume" ist ein Raum, „Der Ring" unter „Magische Gegenstände" ist ein
 * Gegenstand.
 */
export function classifySection(node: DocumentNode, ctx: ClassifyContext): SectionRole {
  if (ctx.isRoot) return ctx.profile === "dungeon" ? "dungeon" : "volume";

  const { text } = splitHeadingLabel(node.title);

  // Einträge einer Liste erben deren Gegenstand.
  if (ctx.parentRole === "room_list") return "room";
  if (ctx.parentRole === "statblock_list") return "statblock";
  if (ctx.parentRole === "handout_list") return "handout";
  if (ctx.parentRole === "npc_list") return "npc";

  // Kennt die Welt den Namen, gilt ihr Urteil. Zwei Dinge wiegen aber schwerer,
  // beide aus dem Dokument selbst:
  //
  // - Die **Stellung**: Ein Eintrag unter „Werteblöcke" ist ein Werteblock,
  //   auch wenn es die Person in der Welt schon gibt (Regel oben).
  // - Die **Gliederung**: „KAPITEL 2 — WINDHAFEN" ist ein Kapitel über
  //   Windhafen, nicht die Stadt. Als Ort eingeordnet verlöre es seine Rolle
  //   als Klammer, löste sich auf, und seine Szenen hingen im Nichts — während
  //   die Stadt, die es schon gibt, eine zweite Seite bekäme.
  if (!isPartHeading(node.title)) {
    const known = matchKnownEntity(text, ctx.knownEntities);
    if (known) return known.role;
  }

  if (ctx.profile === "dungeon") {
    for (const rule of LEVEL_RULES) {
      if (rule.pattern.test(text)) return rule.role;
    }
    // Nur direkt unter dem Dungeon: sonst würde jede „Umgebung" zur Ebene.
    if (ctx.parentRole === "dungeon" && APPROACH_PATTERN.test(text)) return "level";
  }

  if (QUEST_CONTAINER_PATTERN.test(text)) return "part";
  if (QUEST_GUIDANCE_PATTERN.test(text)) return "detail";

  for (const rule of ENTITY_RULES) {
    if (rule.pattern.test(text)) {
      // Räume gibt es nur im Dungeon; im Kampagnenbuch ist ein „Saal" ein Ort.
      if (rule.role === "room" && ctx.profile !== "dungeon") return "location";
      return rule.role;
    }
  }

  if (NPC_TITLE.test(text)) return "npc";

  for (const pattern of DETAIL_RULES) {
    if (pattern.test(text)) return "detail";
  }

  if (isPartHeading(node.title)) return "part";

  return "section";
}

/** Rollen, aus denen eine eigene Wiki-Seite wird. */
const PAGE_ROLES = new Set<SectionRole>([
  "volume",
  "dungeon",
  "part",
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
  "statblock",
  "statblock_values",
  "rule",
  "room_list",
  "handout_list",
  "statblock_list",
  "npc_list",
]);

/** Rollen, die sich in ihre Einträge auflösen, statt selbst Gegenstand zu sein. */
const LIST_ROLES = new Set<SectionRole>([
  "room_list",
  "handout_list",
  "statblock_list",
  "npc_list",
]);

export function isPageRole(role: SectionRole): boolean {
  return PAGE_ROLES.has(role);
}

export function isListRole(role: SectionRole): boolean {
  return LIST_ROLES.has(role);
}

/**
 * Rollen, die einen Gegenstand bezeichnen — Kandidaten für die Verlinkung.
 *
 * `statblock_values` gehört nicht dazu: „Werteblock: Nepurga" ist eine
 * Fundstelle, kein Ding, über das jemand im Fließtext schreibt.
 */
export function isEntityRole(role: SectionRole): boolean {
  return (
    isPageRole(role) &&
    !isListRole(role) &&
    role !== "part" &&
    role !== "volume" &&
    role !== "statblock_values"
  );
}

/** Deutsche Bezeichner für die Vorschau — „8 Ebenen, 23 Räume, 11 Werteblöcke". */
export const SECTION_ROLE_LABELS: Record<SectionRole, { one: string; many: string }> = {
  volume: { one: "Band", many: "Bände" },
  dungeon: { one: "Dungeon", many: "Dungeons" },
  part: { one: "Teil", many: "Teile" },
  level: { one: "Ebene", many: "Ebenen" },
  room: { one: "Raum", many: "Räume" },
  npc: { one: "NSC", many: "NSC" },
  location: { one: "Ort", many: "Orte" },
  faction: { one: "Fraktion", many: "Fraktionen" },
  item: { one: "Gegenstand", many: "Gegenstände" },
  quest: { one: "Auftrag", many: "Aufträge" },
  encounter: { one: "Begegnung", many: "Begegnungen" },
  trap: { one: "Falle", many: "Fallen" },
  puzzle: { one: "Rätsel", many: "Rätsel" },
  loot: { one: "Beute", many: "Beute" },
  secret: { one: "Geheimnis", many: "Geheimnisse" },
  handout: { one: "Handout", many: "Handouts" },
  statblock: { one: "Werteblock", many: "Werteblöcke" },
  statblock_values: { one: "Werte-Unterseite", many: "Werte-Unterseiten" },
  rule: { one: "Regelteil", many: "Regelteile" },
  room_list: { one: "Raumliste", many: "Raumlisten" },
  handout_list: { one: "Handout-Teil", many: "Handout-Teile" },
  statblock_list: { one: "Werteblock-Teil", many: "Werteblock-Teile" },
  npc_list: { one: "NSC-Teil", many: "NSC-Teile" },
  section: { one: "Abschnitt", many: "Abschnitte" },
  detail: { one: "Beiwerk", many: "Beiwerk" },
};

/**
 * Fasst die Struktur in einem Satz zusammen: „8 Ebenen · 23 Räume · 11 Werteblöcke".
 *
 * Reine Gliederungsrollen bleiben draußen — dass ein Band ein Band ist, sagt
 * niemandem etwas. Gezeigt wird, was am Spieltisch zählt.
 */
export function describeStructure(byRole: Partial<Record<SectionRole, number>>): string {
  const counted = (role: SectionRole) => isEntityRole(role) && role !== "dungeon";

  return Object.entries(byRole)
    .filter(([role, count]) => (count ?? 0) > 0 && counted(role as SectionRole))
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([role, count]) => {
      const labels = SECTION_ROLE_LABELS[role as SectionRole];
      return `${count} ${count === 1 ? labels.one : labels.many}`;
    })
    .join(" · ");
}
