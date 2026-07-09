import type { PrismaClient } from "./client";
import type { PageType, QuestLifecycleStatus } from "./generated/prisma/client";
import { normalizeLookupKey } from "./page-service";
import { buildPageUrl } from "./page-types";
import { autoLinkWikitext, buildWikitextLinkTerms } from "./wikitext-convert";
import type { InspectorFixSuggestion, InspectorSeverity } from "./world-inspector";

/**
 * Wiki quality center: maintenance findings that complement the World Inspector's
 * safety/canon audit. Where the inspector asks "is anything leaking or contradictory?",
 * this asks "is the wiki well-kept?" — unlinked mentions, thin pages, NPCs without a
 * faction/place, places without a map, quests without a status, ambiguous aliases.
 *
 * Kept in a dedicated file (the inspector is a frozen baseline monolith) but reuses the
 * inspector's finding shape so the same rendering/handling applies. Everything is
 * read-only and derived from existing data — no AI, no writes.
 */

export type WikiQualityFindingCode =
  | "unlinked_term"
  | "thin_page"
  | "npc_missing_relations"
  | "location_missing_map"
  | "quest_missing_status"
  | "duplicate_alias";

/** Structurally compatible with the inspector's `InspectorFinding`. */
export interface WikiQualityFinding {
  id: string;
  code: WikiQualityFindingCode;
  severity: InspectorSeverity;
  message: string;
  pageTitle?: string;
  href?: string;
  pageId?: string;
  fixes: InspectorFixSuggestion[];
}

export interface WikiQualityPageInput {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  aliases: string[];
  questStatus: QuestLifecycleStatus | null;
  /** Concatenated block prose, used for thin-page + unlinked-term detection. */
  contentText: string;
  /** Types of pages linked to/from this page via PageLink (either direction). */
  linkedPageTypes: PageType[];
  /** Number of map assets linked to this page via AssetPageLink. */
  mapAssetCount: number;
}

export interface WikiQualityOptions {
  /** Pages below this prose length (chars) are flagged as thin. */
  thinPageMinChars?: number;
  /** Minimum term length for the unlinked-mention detector. */
  minTermLength?: number;
}

export interface WikiQualityReport {
  worldSlug: string;
  findings: WikiQualityFinding[];
  counts: Record<WikiQualityFindingCode, number>;
}

const DEFAULT_THIN_PAGE_MIN_CHARS = 280;

/** Page types whose prose is expected to be substantial (worth a thin-page check). */
const NARRATIVE_PAGE_TYPES = new Set<PageType>([
  "lore",
  "location",
  "region",
  "npc",
  "faction",
  "item",
  "quest",
  "monster",
  "player_character",
  "dungeon",
  "rule",
  "secret",
]);

/** A place is expected to have a map. */
const MAPPABLE_PAGE_TYPES = new Set<PageType>(["location", "region"]);

/** Relations that satisfy "an NPC belongs somewhere". */
const NPC_RELATION_TYPES = new Set<PageType>(["faction", "location", "region"]);

const SEVERITY_ORDER: Record<InspectorSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const EMPTY_COUNTS: Record<WikiQualityFindingCode, number> = {
  unlinked_term: 0,
  thin_page: 0,
  npc_missing_relations: 0,
  location_missing_map: 0,
  quest_missing_status: 0,
  duplicate_alias: 0,
};

function findingId(code: WikiQualityFindingCode, parts: string[]): string {
  return [code, ...parts.filter(Boolean)].join(":");
}

function studioHref(worldSlug: string, page: WikiQualityPageInput): string {
  return buildPageUrl(worldSlug, page.type, page.slug);
}

/** Visible prose length, ignoring markdown noise and whitespace runs. */
function proseLength(text: string): number {
  return text
    .replace(/[#>*_`~\-|\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

/**
 * Pure finding builder — everything is derived from the page inputs, so it is fully
 * unit-testable without a database.
 */
export function buildWikiQualityFindings(
  worldSlug: string,
  pages: WikiQualityPageInput[],
  options: WikiQualityOptions = {},
): WikiQualityFinding[] {
  const thinMin = options.thinPageMinChars ?? DEFAULT_THIN_PAGE_MIN_CHARS;
  const findings: WikiQualityFinding[] = [];

  for (const page of pages) {
    const href = studioHref(worldSlug, page);

    // thin_page — narrative page with barely any prose.
    if (NARRATIVE_PAGE_TYPES.has(page.type) && proseLength(page.contentText) < thinMin) {
      findings.push({
        id: findingId("thin_page", [page.id]),
        code: "thin_page",
        severity: "info",
        message: `„${page.title}" hat kaum Inhalt — die Seite ist fast leer.`,
        pageTitle: page.title,
        href,
        pageId: page.id,
        fixes: [],
      });
    }

    // npc_missing_relations — NPC with no link to a faction or place.
    if (
      page.type === "npc" &&
      !page.linkedPageTypes.some((type) => NPC_RELATION_TYPES.has(type))
    ) {
      findings.push({
        id: findingId("npc_missing_relations", [page.id]),
        code: "npc_missing_relations",
        severity: "warning",
        message: `NPC „${page.title}" hat keine Fraktion und keinen Ort — bitte verknüpfen.`,
        pageTitle: page.title,
        href,
        pageId: page.id,
        fixes: [],
      });
    }

    // location_missing_map — a place without a linked map asset.
    if (MAPPABLE_PAGE_TYPES.has(page.type) && page.mapAssetCount === 0) {
      findings.push({
        id: findingId("location_missing_map", [page.id]),
        code: "location_missing_map",
        severity: "info",
        message: `Ort „${page.title}" hat keine verknüpfte Karte.`,
        pageTitle: page.title,
        href,
        pageId: page.id,
        fixes: [],
      });
    }

    // quest_missing_status — a quest page without an open/completed/failed status.
    if (page.type === "quest" && page.questStatus === null) {
      findings.push({
        id: findingId("quest_missing_status", [page.id]),
        code: "quest_missing_status",
        severity: "warning",
        message: `Quest „${page.title}" hat keinen Status (offen / erledigt / gescheitert).`,
        pageTitle: page.title,
        href,
        pageId: page.id,
        fixes: [],
      });
    }
  }

  findings.push(...buildUnlinkedTermFindings(worldSlug, pages, options));
  findings.push(...buildDuplicateAliasFindings(worldSlug, pages));

  return sortWikiQualityFindings(findings);
}

/** One finding per page listing the known terms it mentions without a wikilink. */
function buildUnlinkedTermFindings(
  worldSlug: string,
  pages: WikiQualityPageInput[],
  options: WikiQualityOptions,
): WikiQualityFinding[] {
  const findings: WikiQualityFinding[] = [];
  const termSource = pages.map((page) => ({
    id: page.id,
    title: page.title,
    aliases: page.aliases,
  }));

  for (const page of pages) {
    if (!page.contentText.trim()) continue;
    const terms = buildWikitextLinkTerms(termSource, page.id);
    const { addedLinks } = autoLinkWikitext(page.contentText, terms, {
      minTermLength: options.minTermLength,
    });
    if (addedLinks.length === 0) continue;

    const targets = [...new Set(addedLinks.map((link) => link.target))];
    findings.push({
      id: findingId("unlinked_term", [page.id]),
      code: "unlinked_term",
      severity: "info",
      message: `„${page.title}" erwähnt ohne Wikilink: ${targets
        .map((target) => `„${target}"`)
        .join(", ")}.`,
      pageTitle: page.title,
      href: studioHref(worldSlug, page),
      pageId: page.id,
      fixes: [],
    });
  }

  return findings;
}

/**
 * Ambiguous aliases: an alias of one page resolves to the same lookup key as a title or
 * alias of another page. Complements the inspector's `duplicate_name` (title/slug
 * collisions) by catching alias-driven ambiguity that would misroute wikilinks.
 */
function buildDuplicateAliasFindings(
  worldSlug: string,
  pages: WikiQualityPageInput[],
): WikiQualityFinding[] {
  const byKey = new Map<string, { page: WikiQualityPageInput; fromAlias: boolean }[]>();

  const add = (key: string, page: WikiQualityPageInput, fromAlias: boolean) => {
    const normalized = normalizeLookupKey(key);
    if (!normalized) return;
    const bucket = byKey.get(normalized);
    if (bucket) {
      bucket.push({ page, fromAlias });
    } else {
      byKey.set(normalized, [{ page, fromAlias }]);
    }
  };

  for (const page of pages) {
    add(page.title, page, false);
    for (const alias of page.aliases) add(alias, page, true);
  }

  const findings: WikiQualityFinding[] = [];
  const reported = new Set<string>();

  for (const [key, bucket] of byKey) {
    const distinctPages = new Map(bucket.map((entry) => [entry.page.id, entry.page]));
    if (distinctPages.size < 2) continue;
    // Only report when at least one side of the collision is an alias.
    if (!bucket.some((entry) => entry.fromAlias)) continue;

    const pairKey = [...distinctPages.keys()].sort().join("|");
    if (reported.has(pairKey)) continue;
    reported.add(pairKey);

    const first = [...distinctPages.values()][0];
    findings.push({
      id: findingId("duplicate_alias", [pairKey]),
      code: "duplicate_alias",
      severity: "warning",
      message: `Mehrdeutiger Alias „${key}": ${[...distinctPages.values()]
        .map((page) => page.title)
        .join(", ")} — Wikilinks können auf die falsche Seite zeigen.`,
      pageTitle: first.title,
      href: studioHref(worldSlug, first),
      pageId: first.id,
      fixes: [],
    });
  }

  return findings;
}

export function sortWikiQualityFindings(
  findings: WikiQualityFinding[],
): WikiQualityFinding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.message.localeCompare(b.message, "de"),
  );
}

export function countWikiQualityFindings(
  findings: WikiQualityFinding[],
): Record<WikiQualityFindingCode, number> {
  const counts = { ...EMPTY_COUNTS };
  for (const finding of findings) counts[finding.code] += 1;
  return counts;
}

export class WikiQualityService {
  constructor(private readonly db: PrismaClient) {}

  async inspectWorld(
    worldSlug: string,
    options: WikiQualityOptions = {},
  ): Promise<WikiQualityReport | null> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;

    const [rawPages, links, mapAssetLinks] = await Promise.all([
      this.db.page.findMany({
        where: { worldId: world.id },
        include: { contentBlocks: { orderBy: { sortOrder: "asc" } } },
        orderBy: [{ title: "asc" }],
      }),
      this.db.pageLink.findMany({
        where: { sourcePage: { worldId: world.id } },
        select: { sourcePageId: true, targetPageId: true },
      }),
      this.db.assetPageLink.findMany({
        where: { page: { worldId: world.id }, asset: { type: "map" } },
        select: { pageId: true },
      }),
    ]);

    const typeById = new Map(rawPages.map((page) => [page.id, page.type]));
    const linkedTypes = new Map<string, Set<PageType>>();
    const addLinkedType = (pageId: string, otherId: string) => {
      const otherType = typeById.get(otherId);
      if (!otherType) return;
      const set = linkedTypes.get(pageId) ?? new Set<PageType>();
      set.add(otherType);
      linkedTypes.set(pageId, set);
    };
    for (const link of links) {
      addLinkedType(link.sourcePageId, link.targetPageId);
      addLinkedType(link.targetPageId, link.sourcePageId);
    }

    const mapAssetCounts = new Map<string, number>();
    for (const link of mapAssetLinks) {
      mapAssetCounts.set(link.pageId, (mapAssetCounts.get(link.pageId) ?? 0) + 1);
    }

    const pages: WikiQualityPageInput[] = rawPages.map((page) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      type: page.type,
      aliases: Array.isArray(page.aliases) ? (page.aliases as string[]) : [],
      questStatus: page.questStatus,
      contentText: page.contentBlocks.map((block) => block.content).join("\n"),
      linkedPageTypes: [...(linkedTypes.get(page.id) ?? [])],
      mapAssetCount: mapAssetCounts.get(page.id) ?? 0,
    }));

    const findings = buildWikiQualityFindings(worldSlug, pages, options);
    return { worldSlug, findings, counts: countWikiQualityFindings(findings) };
  }
}

export function createWikiQualityService(db: PrismaClient): WikiQualityService {
  return new WikiQualityService(db);
}

export interface WikiQualityRecommendation {
  priority: number;
  title: string;
  description: string;
  href?: string;
}

export interface WikiQualityInsights {
  score: number;
  grade: string;
  explanation: string;
  recommendations: WikiQualityRecommendation[];
}

const SCORE_WEIGHTS: Record<WikiQualityFindingCode, number> = {
  unlinked_term: 2,
  thin_page: 3,
  npc_missing_relations: 4,
  location_missing_map: 3,
  quest_missing_status: 4,
  duplicate_alias: 5,
};

const RECOMMENDATION_META: Record<
  WikiQualityFindingCode,
  { title: string; description: string; pathSuffix: string }
> = {
  unlinked_term: {
    title: "Unverlinkte Begriffe verlinken",
    description: "Erwähnungen bekannter Seiten im Fließtext verlinken — per Bulk-Auto-Link oder Import.",
    pathSuffix: "/import",
  },
  thin_page: {
    title: "Dünne Seiten ausbauen",
    description: "Seiten mit wenig Inhalt ergänzen oder mit anderen Einträgen zusammenführen.",
    pathSuffix: "/quality",
  },
  npc_missing_relations: {
    title: "NPCs verorten",
    description: "NPCs mit einer Fraktion oder einem Ort verknüpfen.",
    pathSuffix: "/quality",
  },
  location_missing_map: {
    title: "Karten für Orte hinterlegen",
    description: "Orte und Regionen mit einer Karte im Atlas verknüpfen.",
    pathSuffix: "/atlas",
  },
  quest_missing_status: {
    title: "Quest-Status setzen",
    description: "Offene Quests mit einem Lebenszyklus-Status versehen.",
    pathSuffix: "/quality",
  },
  duplicate_alias: {
    title: "Mehrdeutige Aliase bereinigen",
    description: "Doppelte oder kollidierende Aliase umbenennen oder entfernen.",
    pathSuffix: "/quality",
  },
};

/** Derives a transparent maintenance score and prioritized recommendations (#688). */
export function computeWikiQualityInsights(
  worldSlug: string,
  report: WikiQualityReport,
): WikiQualityInsights {
  const penalty = report.findings.reduce((sum, finding) => sum + (SCORE_WEIGHTS[finding.code] ?? 2), 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  let grade = "Ausgezeichnet";
  if (score < 40) grade = "Verbesserungsbedarf";
  else if (score < 70) grade = "Gut — Lücken vorhanden";
  else if (score < 90) grade = "Sehr gut";

  const explanation =
    report.findings.length === 0
      ? "Keine offenen Pflegepunkte — das Wiki ist vollständig verknüpft und gepflegt."
      : `Der Score startet bei 100 und sinkt pro Fundstelle (2–5 Punkte je nach Schweregrad). ` +
        `Aktuell ${report.findings.length} offene Punkt(e), Abzug ${penalty} → ${score}/100 (${grade}).`;

  const recommendations = (Object.keys(report.counts) as WikiQualityFindingCode[])
    .filter((code) => report.counts[code] > 0)
    .sort((a, b) => report.counts[b] - report.counts[a])
    .map((code, index) => {
      const meta = RECOMMENDATION_META[code];
      return {
        priority: index + 1,
        title: meta.title,
        description: `${meta.description} (${report.counts[code]} offen)`,
        href: `/worlds/${worldSlug}${meta.pathSuffix}`,
      };
    });

  return { score, grade, explanation, recommendations };
}
