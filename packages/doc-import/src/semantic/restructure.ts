/**
 * Vom Überschriftenbaum zum Seitenbaum.
 *
 * Der Überschriftenbaum bildet ab, wie ein Dokument **geschrieben** ist. Ein
 * Wiki bildet ab, was man am Spieltisch **nachschlägt**. Das ist nicht dasselbe,
 * und dieses Modul ist die Übersetzung dazwischen. Fünf Durchgänge, jeder mit
 * einem einzigen Auftrag und in einer eigenen Datei:
 *
 * 1. **Einordnen** (hier) — jeder Knoten bekommt eine {@link SectionRole} und
 *    seinen Titel ohne Gliederungsnummer (die wird Alias).
 * 2. **Auflösen** (`dissolve.ts`) — Listenabschnitte („Die Räume",
 *    „Werteblöcke") zerfallen in ihre Einträge; reine Klammern verschwinden.
 * 3. **Falten** (`fold.ts`) — alles, was keine Seite verdient, wird Rumpftext
 *    der Seite darüber; doppelt Beschriebenes wird zusammengeführt.
 * 4. **Ordnen** (`dungeon-order.ts`) — im Dungeon hängen Ebenen unter dem
 *    Dungeon. Immer. Genau das hat gefehlt: `EBENE 1` stand unter `TEIL C`, das
 *    Cockpit liest aber nur direkte Kinder — und zeigte deshalb nur das Dach.
 * 5. **Typisieren** (hier) — aus der Rolle wird der `PageType`.
 *
 * Ein Ergebnis, an dem sich das messen lässt: „Der Magister-Turm von Validori"
 * ergab vorher 1 Dungeon mit 1 Ebene. Danach: 8 Ebenen mit ihren Räumen, 10
 * Werteblöcke als eigene NSC-/Monsterseiten und 6 Handouts.
 */

import type { DocProfile, DocumentNode, DocumentTree, PageType, SectionRole } from "../types";
import { looksLikeCombatStatblock } from "./blocks";
import { emptyCounters, type Counters } from "./counters";
import { dissolveContainers, dissolveLists, dropEmptyShells } from "./dissolve";
import { demoteOrphanRooms, liftLevels } from "./dungeon-order";
import { foldNonPages, mergeDuplicateEntities } from "./fold";
import { nodePath, outlineExcerpt, type OutlineEntry } from "./outline";
import { classifySection, isEntityRole, splitHeadingLabel, tidyHeadingText } from "./roles";
import { matchKnownEntity, type KnownEntityMatch } from "./world-context";

export { nodePath } from "./outline";
export { shiftHeadings } from "./fold";

const ROLE_PAGE_TYPES: Record<SectionRole, PageType> = {
  volume: "lore",
  dungeon: "dungeon",
  part: "lore",
  level: "dungeon_level",
  room: "room",
  npc: "npc",
  location: "location",
  faction: "faction",
  item: "item",
  quest: "quest",
  encounter: "encounter",
  trap: "trap",
  puzzle: "puzzle",
  loot: "loot",
  secret: "secret",
  handout: "handout",
  statblock: "monster",
  statblock_values: "monster",
  rule: "rule",
  room_list: "lore",
  handout_list: "lore",
  statblock_list: "lore",
  npc_list: "lore",
  section: "lore",
  detail: "lore",
};

export interface RestructureOptions {
  profile: DocProfile;
  /**
   * Rollen, die die KI vorgegeben hat, nach Dokumentpfad. Sie schlagen die
   * Muster — aber nur dort, wo tatsächlich ein Knoten steht.
   */
  roleHints?: Map<string, SectionRole>;
  /** Namen der Zielwelt, nach Nachschlage-Schlüssel. Siehe `world-context.ts`. */
  knownEntities?: Map<string, KnownEntityMatch>;
}

export interface RestructureResult {
  tree: DocumentTree;
  /**
   * Die Gliederung vor dem Umbau, mit den Rollen der Regeln. Grundlage für den
   * KI-Feinschliff: Ihre Pfade bleiben über zwei Läufe hinweg dieselben.
   */
  outline: OutlineEntry[];
  /** Was der Umbau getan hat — wandert in die Vorschau. */
  stats: Counters & {
    pages: number;
    byRole: Partial<Record<SectionRole, number>>;
  };
}

/** Tiefe Kopie — der übergebene Baum bleibt unangetastet. */
function cloneNode(node: DocumentNode): DocumentNode {
  return { ...node, children: node.children.map(cloneNode) };
}

// ---------------------------------------------------------------------------
// 1. Einordnen
// ---------------------------------------------------------------------------

interface AnnotateContext {
  profile: DocProfile;
  parentRole: SectionRole | null;
  trail: string[];
  isRoot: boolean;
  knownEntities?: Map<string, KnownEntityMatch>;
}

/**
 * Vergibt Rollen und räumt die Titel auf — und schreibt dabei die Gliederung mit.
 *
 * Die Gliederung entsteht **hier**, vor jeder Umstellung: Sie ist der Schlüssel,
 * unter dem ein KI-Hinweis im zweiten Durchlauf wiedergefunden wird. Ein Pfad
 * aus aufgeräumten Titeln wäre dafür untauglich, weil das Aufräumen selbst vom
 * Ergebnis abhängt.
 */
function annotate(
  nodes: DocumentNode[],
  ctx: AnnotateContext,
  hints: Map<string, SectionRole> | undefined,
  outline: OutlineEntry[],
): void {
  for (const node of nodes) {
    const { label, text } = splitHeadingLabel(node.title);
    const trail = [...ctx.trail, text];
    const path = nodePath(trail);

    const detected = classifySection(node, {
      profile: ctx.profile,
      parentRole: ctx.parentRole,
      isRoot: ctx.isRoot,
      knownEntities: ctx.knownEntities,
    });

    node.role = hints?.get(path) ?? detected;

    // Den Typ der vorhandenen Seite mitnehmen, nicht nur die Rolle: Ein
    // Werteblock in der Welt ist `monster`, ein NSC ist `npc`, und beide haben
    // dieselbe Rolle. Nur wo die Rolle unverändert übernommen wurde — ein
    // KI-Hinweis oder eine Listenregel wiegt schwerer als der Namensfund.
    const known = matchKnownEntity(text, ctx.knownEntities);
    if (known && node.role === known.role) node.typeHint = known.entity.type;
    outline.push({ path, title: text, excerpt: outlineExcerpt(node.body), role: detected });

    // Erst einordnen, dann aufräumen: „(Begegnung, vermeidbar)" ist für die
    // Rolle ein Hinweis und für den Titel Rauschen.
    node.title = tidyHeadingText(text);
    const extraAliases = [label, text !== node.title ? text : null].filter(
      (value): value is string => Boolean(value),
    );
    if (extraAliases.length > 0) {
      node.aliases = [...new Set([...(node.aliases ?? []), ...extraAliases])];
    }

    annotate(
      node.children,
      {
        profile: ctx.profile,
        parentRole: node.role,
        trail,
        isRoot: false,
        knownEntities: ctx.knownEntities,
      },
      hints,
      outline,
    );
  }
}

// ---------------------------------------------------------------------------
// 5. Typisieren
// ---------------------------------------------------------------------------

function applyTypes(nodes: DocumentNode[], stats: Partial<Record<SectionRole, number>>): number {
  let count = 0;

  for (const node of nodes) {
    const role = node.role ?? "section";

    if (!node.typeHint) {
      node.typeHint =
        role === "statblock"
          ? looksLikeCombatStatblock(node.body)
            ? "monster"
            : "npc"
          : ROLE_PAGE_TYPES[role];
    }

    stats[role] = (stats[role] ?? 0) + 1;
    count += 1 + applyTypes(node.children, stats);
  }

  return count;
}

/**
 * Kapitel eines Kampagnenbuchs erkennen.
 *
 * Ein Gliederungsabschnitt, unter dem die Szenen hängen, ist kein Wissenstext,
 * sondern ein Story-Bogen — genau das, was das Kampagnen-Cockpit als Kapitel
 * liest. Bis hierher kam jedes importierte Kapitel als `lore` an und musste von
 * Hand umgestellt werden, damit das Cockpit die Kampagne überhaupt zeigt.
 *
 * Das stärkste Erkennungsmerkmal ist das beim Aufräumen bewahrte Etikett
 * `BUCH …` oder `KAPITEL …`. So bleibt auch ein erzählerisches Buch ohne direkt
 * darunterliegende Szene ein Story-Bogen. Als Rückfall für unnummerierte
 * Manuskripte gilt die bisherige Szenenregel, aber nur für direkte Kinder des
 * Bandes. Dadurch wird ein Unterabschnitt mit einer Begegnung nicht mehr
 * irrtümlich zu einem eigenen Kampagnenkapitel.
 */
const STORY_LABEL = /^(buch\b|kapitel\s+k\d+\b)/i;

function markStoryArcs(
  nodes: DocumentNode[],
  depth = 0,
  hasLabeledStructure =
    depth === 0 && nodes.some((root) => root.children.some((child) => child.aliases?.some((alias) => STORY_LABEL.test(alias)))),
): number {
  let count = 0;

  for (const node of nodes) {
    const role = node.role ?? "section";
    const hasEncounterChild = node.children.some((child) => child.role === "encounter");
    const hasStoryLabel = (node.aliases ?? []).some((alias) => STORY_LABEL.test(alias));
    const isNarrativeSection =
      (role === "section" || role === "part") && node.typeHint === "lore";

    if (
      isNarrativeSection &&
      (hasStoryLabel || (!hasLabeledStructure && depth === 1 && hasEncounterChild))
    ) {
      node.typeHint = "story_arc";
      count += 1;
    }

    count += markStoryArcs(node.children, depth + 1, hasLabeledStructure);
  }

  return count;
}

/**
 * Baut den Seitenbaum.
 *
 * Der erste Wurzelknoten trägt das Dokument; weitere `#`-Überschriften sind
 * seine Teile (dieselbe Regel wie in `tree-mapper.ts`, hier nur früher, weil
 * die Dungeon-Invariante einen einzigen Wurzelknoten braucht).
 */
export function restructureDocument(
  tree: DocumentTree,
  options: RestructureOptions,
): RestructureResult {
  const counters = emptyCounters();
  const byRole: Partial<Record<SectionRole, number>> = {};
  const outline: OutlineEntry[] = [];

  const nodes = tree.nodes.map(cloneNode);
  if (nodes.length === 0) {
    return {
      tree: { preamble: tree.preamble, nodes },
      outline,
      stats: { pages: 0, ...counters, byRole },
    };
  }

  const root = nodes[0];
  const offset = root.children.length;
  root.children = [
    ...root.children,
    ...nodes.slice(1).map((node, index) => ({ ...node, sortIndex: offset + index })),
  ];

  annotate(
    [root],
    {
      profile: options.profile,
      parentRole: null,
      trail: [],
      isRoot: true,
      knownEntities: options.knownEntities,
    },
    options.roleHints,
    outline,
  );

  dissolveLists(root, counters);
  dissolveContainers(root, counters);
  foldNonPages(root, counters);
  mergeDuplicateEntities(root, counters);

  if (options.profile === "dungeon") {
    liftLevels(root);
    demoteOrphanRooms(root, false);
  }

  dropEmptyShells(root, counters);

  const pages = applyTypes([root], byRole);
  markStoryArcs([root]);

  return {
    tree: { preamble: tree.preamble, nodes: [root] },
    outline,
    stats: { pages, ...counters, byRole },
  };
}

/** Alle Knoten, die einen Gegenstand bezeichnen — Grundlage der Verlinkung. */
export function collectEntityNodes(nodes: DocumentNode[]): DocumentNode[] {
  const out: DocumentNode[] = [];

  const walk = (list: DocumentNode[]) => {
    for (const node of list) {
      if (node.role && isEntityRole(node.role)) out.push(node);
      walk(node.children);
    }
  };

  walk(nodes);
  return out;
}
