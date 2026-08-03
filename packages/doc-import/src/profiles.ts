/**
 * Typ-Profile: welcher `PageType` aus einer Überschrift wird.
 *
 * Dieselbe Zeile bedeutet je nach Dokument etwas anderes. „Szene 1: Feuer im
 * Dock" ist in einem Kampagnenbuch eine Begegnung; im Weltkanon wäre dieselbe
 * Überschrift Hintergrundtext. Deshalb wählt der Import ein Profil, und das
 * Profil entscheidet.
 *
 * Die Regeln sind bewusst schlicht und in Dokumentreihenfolge geprüft — die
 * erste passende gewinnt. Wer eine Überschrift daneben findet, ändert sie in
 * der Vorschau; es ist keine Wissenschaft, sondern eine gute Vorbelegung.
 *
 * Was hier ausdrücklich **nicht** passiert: raten, ob „Windhafen, die Boomstadt"
 * ein Ort ist. Dafür gibt es die optionale KI-Entitätsextraktion, die den Text
 * liest, statt die Überschrift zu mustern.
 */

import type { PageType } from "@uwe/database/server";
import { resolvePageTypeLabel } from "@uwe/database/page-type-detect";
import type { DocProfile, DocumentNode } from "./types";

interface TitleRule {
  pattern: RegExp;
  type: PageType;
}

/** Regeln, die in jedem Profil gelten — Handouts und Werteblöcke sind überall dasselbe. */
const COMMON_RULES: TitleRule[] = [
  { pattern: /\bhandouts?\b/i, type: "handout" },
  { pattern: /wertebl(o|ö)ck|statblock|bestiarium/i, type: "monster" },
];

/**
 * Achtung Komposita: `\bgilde\b` findet „Handelsgilde" nicht, weil vor der Silbe
 * keine Wortgrenze steht. Deutsche Überschriften kleben Wörter zusammen, also
 * steht die führende Wortgrenze nur dort, wo sie einen Fehltreffer verhindert
 * (`\borden\b`, sonst würde „Norden" zur Fraktion).
 */
const DUNGEON_RULES: TitleRule[] = [
  ...COMMON_RULES,
  { pattern: /\b(ebene|level|stockwerk|etage)\s*\d/i, type: "dungeon_level" },
  { pattern: /\bdach\b|rooftop/i, type: "dungeon_level" },
  { pattern: /\br(ä|ae)ume?\b|\brooms?\b|kammern?\b|\bsaal\b/i, type: "room" },
  { pattern: /begegnung|encounter/i, type: "encounter" },
  { pattern: /r(ä|ae)tsel|puzzle/i, type: "puzzle" },
  { pattern: /\bfallen?\b|\btraps?\b/i, type: "trap" },
  { pattern: /\bbeute\b|\bloot\b|sch(a|ä)tze?\b/i, type: "loot" },
  { pattern: /geheimnis|\bsecret\b/i, type: "secret" },
  { pattern: /zug(ä|ae)nge?\b|plattform|anfahrt/i, type: "location" },
];

const CAMPAIGN_RULES: TitleRule[] = [
  ...COMMON_RULES,
  { pattern: /^\s*szene\b|^\s*scene\b/i, type: "encounter" },
  { pattern: /begegnung|encounter/i, type: "encounter" },
  { pattern: /quests?\b|auftr(ä|ae)ge?\b/i, type: "quest" },
  { pattern: /fraktion|gilde|kult\b|\borden\b|\bbund\b/i, type: "faction" },
  { pattern: /magische\s+gegenst(ä|ae)nde|sch(a|ä)tze\b/i, type: "item" },
  { pattern: /\bregeln?\b|hausregeln|anh(ä|ae)nge?\b|tabellen?\b/i, type: "rule" },
  { pattern: /\bdungeon\b/i, type: "dungeon" },
];

const PROFILE_RULES: Record<DocProfile, TitleRule[]> = {
  dungeon: DUNGEON_RULES,
  campaign_book: CAMPAIGN_RULES,
  canon: [],
  plain: COMMON_RULES,
};

/** Der Typ, den ein Profil vergibt, wenn keine Regel greift. */
const PROFILE_FALLBACK: Record<DocProfile, PageType> = {
  dungeon: "lore",
  campaign_book: "lore",
  canon: "lore",
  plain: "lore",
};

export interface ResolveNodeTypeContext {
  profile: DocProfile;
  /** Die Wurzel eines Dungeon-Dokuments ist der Dungeon selbst. */
  isRoot: boolean;
  /** Ausdrücklicher Typ aus dem Frontmatter, falls das Dokument einen trägt. */
  declaredType?: string;
}

/**
 * Bestimmt den Seitentyp eines Knotens.
 *
 * Reihenfolge: ausdrückliche Angabe → Rolle aus dem semantischen Umbau →
 * Wurzelregel → Titelmuster → Profil-Vorgabe.
 *
 * Der `typeHint` steht so weit vorn, weil er aus mehr Wissen kommt als ein
 * Titelmuster: Er kennt die Stellung des Abschnitts im Dokument (Eintrag einer
 * Werteblockliste, Raum unter einer Ebene) und, wenn der Maschinenraum-Host antwortet,
 * das Urteil der lokalen KI.
 */
export function resolveNodePageType(
  node: Pick<DocumentNode, "title"> & Partial<Pick<DocumentNode, "typeHint">>,
  ctx: ResolveNodeTypeContext,
): PageType {
  if (ctx.declaredType) {
    const declared = resolvePageTypeLabel(ctx.declaredType);
    if (declared) return declared;
  }

  if (node.typeHint) return node.typeHint;

  if (ctx.isRoot && ctx.profile === "dungeon") return "dungeon";

  for (const rule of PROFILE_RULES[ctx.profile]) {
    if (rule.pattern.test(node.title)) return rule.type;
  }

  return PROFILE_FALLBACK[ctx.profile];
}

/**
 * Der Kanon-Status, den ein Profil vorgibt, wenn weder Frontmatter noch Marker
 * etwas sagen. Ein Weltkanon ist per Definition Kanon; ein frisch importiertes
 * Kampagnenbuch ist erst einmal ein Entwurf.
 */
export function profileDefaultStatus(profile: DocProfile): "canon" | "draft" {
  return profile === "canon" ? "canon" : "draft";
}

export const DOC_PROFILES: readonly DocProfile[] = [
  "campaign_book",
  "dungeon",
  "canon",
  "plain",
] as const;

export const DOC_PROFILE_LABELS: Record<DocProfile, string> = {
  campaign_book: "Kampagnenbuch",
  dungeon: "Dungeon",
  canon: "Weltkanon",
  plain: "Einfaches Dokument",
};

export const DOC_PROFILE_HINTS: Record<DocProfile, string> = {
  campaign_book: "Akte, Kapitel, Szenen. Szenen werden Begegnungen, Anhänge werden Regeln.",
  dungeon: "Die Wurzel wird der Dungeon, Ebenen werden Ebenen, Räume werden Räume.",
  canon: "Alles wird Hintergrund und gilt als Kanon, sofern kein ◇-Marker widerspricht.",
  plain: "Keine Sonderregeln — alles wird Hintergrund, sofern nichts anderes dasteht.",
};
