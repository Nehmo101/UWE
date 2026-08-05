import type { PageSummary, PageWithBlocks, PageType } from "@uwe/database/server";
import { buildPageUrl } from "@uwe/database/page-types";
import type { WorldWikiGraph } from "@uwe/database/page-service";

/*
 * Beziehungen einer Quest, abgeleitet aus den [[Wiki-Links]] ihres Textes.
 * Kein eigener Index: der gecachte WorldWikiGraph (page-service) liefert pro
 * ContentBlock die bereits aufgelösten Ziel-Seiten — dieselbe First-Match-
 * Semantik wie die Wiki-Anzeige. Pure Funktionen, gut testbar.
 */

export interface QuestRelationTarget {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  href: string;
}

export interface QuestRelations {
  npcs: QuestRelationTarget[];
  locations: QuestRelationTarget[];
  factions: QuestRelationTarget[];
}

const NPC_TYPES: PageType[] = ["npc", "player_character", "monster"];
const LOCATION_TYPES: PageType[] = ["location", "region"];

function toTarget(worldSlug: string, page: PageSummary): QuestRelationTarget {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    type: page.type,
    href: buildPageUrl(worldSlug, page.type, page.slug),
  };
}

/**
 * Vorwärts: welche NSCs, Orte und Fraktionen erwähnt der Quest-Text?
 * `quest.contentBlocks` gegen `graph.blockTargets` auflösen und nach Typ
 * gruppieren. Duplikate (mehrfach verlinkt) fallen zusammen.
 */
export function deriveQuestRelations(
  worldSlug: string,
  quest: Pick<PageWithBlocks, "contentBlocks">,
  graph: Pick<WorldWikiGraph, "blockTargets" | "pageIndex">,
): QuestRelations {
  const pageById = new Map(graph.pageIndex.map((page) => [page.id, page]));
  const seen = new Set<string>();
  const relations: QuestRelations = { npcs: [], locations: [], factions: [] };

  for (const block of quest.contentBlocks) {
    for (const targetId of graph.blockTargets.get(block.id) ?? []) {
      if (seen.has(targetId)) continue;
      seen.add(targetId);
      const target = pageById.get(targetId);
      if (!target) continue;
      if (NPC_TYPES.includes(target.type)) {
        relations.npcs.push(toTarget(worldSlug, target));
      } else if (LOCATION_TYPES.includes(target.type)) {
        relations.locations.push(toTarget(worldSlug, target));
      } else if (target.type === "faction") {
        relations.factions.push(toTarget(worldSlug, target));
      }
    }
  }

  return relations;
}

/**
 * Mehrere Beziehungs-Sets zu einem zusammenfassen — z. B. Kapiteltext plus
 * alle Quest-Texte zu einer NSC-Tafel des ganzen Akts. Reihenfolge bleibt
 * stabil (erste Erwähnung gewinnt), Duplikate fallen über die Seiten-Id weg.
 */
export function mergeQuestRelations(...sets: QuestRelations[]): QuestRelations {
  const merged: QuestRelations = { npcs: [], locations: [], factions: [] };
  const seen = new Set<string>();
  for (const set of sets) {
    for (const key of ["npcs", "locations", "factions"] as const) {
      for (const target of set[key]) {
        if (seen.has(target.id)) continue;
        seen.add(target.id);
        merged[key].push(target);
      }
    }
  }
  return merged;
}

/**
 * Rückwärts: welche Seiten erwähnen diese Quest? Dasselbe Muster wie der
 * Backlink-Aufbau in page-viewer-service — über alle Seiten laufen und deren
 * aufgelöste Block-Ziele gegen die Quest-Id halten.
 */
export function deriveQuestBacklinks(
  worldSlug: string,
  questPageId: string,
  graph: Pick<WorldWikiGraph, "pages" | "blockTargets">,
): QuestRelationTarget[] {
  const backlinks: QuestRelationTarget[] = [];
  for (const page of graph.pages) {
    if (page.id === questPageId) continue;
    const linksToQuest = page.contentBlocks.some((block) =>
      (graph.blockTargets.get(block.id) ?? []).includes(questPageId),
    );
    if (linksToQuest) {
      backlinks.push(toTarget(worldSlug, page));
    }
  }
  return backlinks;
}
