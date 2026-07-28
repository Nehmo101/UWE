import type { PrismaClient } from "./client";
import type {
  CanonicalStatus,
  ContentBlockType,
  PageType,
} from "./generated/prisma/client";
import { normalizeLookupKey, parseWikiLinks } from "./page-service";
import { buildPageUrl } from "./page-types";
import { SettingsService } from "./settings-service";
import { getExtendedCanonFindings, mergeCanonFindings } from "./canon-conflict-service";

/**
 * World Inspector: audits a world for content quality — broken wiki links,
 * ambiguous names, contradictory pages, orphans, pages without a campaign,
 * and canon conflicts.
 *
 * It used to have a second half that audited *exposure*: which pages and
 * assets reached the portal and whether anything leaked. With per-item
 * visibility gone there is nothing to audit — every world member sees
 * everything in their world by design.
 *
 * Everything is read-only and built from existing data — no AI, no
 * external services.
 */

export type InspectorSeverity = "critical" | "warning" | "info";

export type InspectorFindingCode =
  | "broken_wiki_link"
  | "duplicate_name"
  | "contradictory_page"
  | "orphan_page"
  | "uncategorized_page"
  | "deprecated_player_visible"
  | "non_canon_portal_published"
  | "npc_status_conflict"
  | "brain_fact_death_conflict"
  | "world_rule_terra_tower";

/** Fix actions that can be applied directly from a finding (see inspector-fix-service). */
export type InspectorFixAction = "remove_broken_wiki_link" | "assign_page_campaign";

export interface InspectorFixSuggestion {
  action: InspectorFixAction;
  label: string;
}

export interface InspectorFinding {
  /** Stable identifier so a finding can be matched before/after a fix. */
  id: string;
  code: InspectorFindingCode;
  severity: InspectorSeverity;
  message: string;
  pageTitle?: string;
  href?: string;
  pageId?: string;
  blockId?: string;
  /** Unresolved wikilink target (only for broken_wiki_link). */
  linkTarget?: string;
  fixes: InspectorFixSuggestion[];
}

export interface InspectorBlockInput {
  /** DB id — optional so synthetic test fixtures stay simple. */
  id?: string;
  type: ContentBlockType;
  content: string;
}

export interface InspectorPageInput {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  canonicalStatus: CanonicalStatus;
  aliases: string[];
  campaignId?: string | null;
  blocks: InspectorBlockInput[];
}

export interface CanonFindingOptions {
  /** Campaigns of the world — enables the uncategorized_page finding. */
  campaigns?: { id: string; name: string }[];
}

function findingId(
  code: InspectorFindingCode,
  parts: (string | undefined)[],
): string {
  return [code, ...parts.filter(Boolean)].join(":");
}

export interface WorldInspectorReport {
  worldSlug: string;
  portal: {
    portalEnabled: boolean;
  };
  pageCount: number;
  assetCount: number;
  canonFindings: InspectorFinding[];
}

const SEVERITY_ORDER: Record<InspectorSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function sortFindings(findings: InspectorFinding[]): InspectorFinding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.message.localeCompare(b.message, "de"),
  );
}

function studioHref(worldSlug: string, page: Pick<InspectorPageInput, "type" | "slug">): string {
  return buildPageUrl(worldSlug, page.type, page.slug);
}

function buildTitleIndex(pages: InspectorPageInput[]): Map<string, InspectorPageInput[]> {
  const index = new Map<string, InspectorPageInput[]>();

  const add = (key: string, page: InspectorPageInput) => {
    const normalized = normalizeLookupKey(key);
    if (!normalized) return;
    const bucket = index.get(normalized);
    if (bucket) {
      if (!bucket.some((entry) => entry.id === page.id)) bucket.push(page);
    } else {
      index.set(normalized, [page]);
    }
  };

  for (const page of pages) {
    add(page.title, page);
    add(page.slug, page);
    for (const alias of page.aliases) add(alias, page);
  }

  return index;
}

/** Canon-quality findings: duplicates, broken links, contradictions, inconsistent states. */
export function buildCanonFindings(
  worldSlug: string,
  pages: InspectorPageInput[],
  explicitLinks: { sourcePageId: string; targetPageId: string }[] = [],
  options: CanonFindingOptions = {},
): InspectorFinding[] {
  const findings: InspectorFinding[] = [];
  const titleIndex = buildTitleIndex(pages);

  // Duplicate names: the same title/alias resolves to more than one page,
  // which makes [[wiki links]] ambiguous.
  const reportedPairs = new Set<string>();
  for (const [key, bucket] of titleIndex) {
    if (bucket.length < 2) continue;
    const pairKey = bucket
      .map((page) => page.id)
      .sort()
      .join("|");
    if (reportedPairs.has(pairKey)) continue;
    reportedPairs.add(pairKey);

    findings.push({
      id: findingId("duplicate_name", [pairKey]),
      code: "duplicate_name",
      severity: "warning",
      message: `Mehrdeutiger Name „${key}": ${bucket
        .map((page) => page.title)
        .join(", ")} — Wikilinks können auf die falsche Seite zeigen.`,
      pageTitle: bucket[0].title,
      href: studioHref(worldSlug, bucket[0]),
      pageId: bucket[0].id,
      fixes: [],
    });
  }

  const linkedPageIds = new Set<string>();
  for (const link of explicitLinks) {
    linkedPageIds.add(link.sourcePageId);
    linkedPageIds.add(link.targetPageId);
  }

  for (const page of pages) {
    const href = studioHref(worldSlug, page);
    const content = page.blocks.map((block) => block.content).join("\n");
    const wikiLinks = parseWikiLinks(content);

    const brokenTargets = new Set<string>();
    for (const link of wikiLinks) {
      if (titleIndex.has(normalizeLookupKey(link.target))) {
        linkedPageIds.add(page.id);
        for (const target of titleIndex.get(normalizeLookupKey(link.target)) ?? []) {
          linkedPageIds.add(target.id);
        }
      } else {
        brokenTargets.add(link.target);
      }
    }

    for (const target of brokenTargets) {
      findings.push({
        id: findingId("broken_wiki_link", [page.id, normalizeLookupKey(target)]),
        code: "broken_wiki_link",
        severity: "warning",
        message: `„${page.title}" verlinkt auf „${target}", aber diese Seite existiert nicht.`,
        pageTitle: page.title,
        href,
        pageId: page.id,
        linkTarget: target,
        fixes: [
          {
            action: "remove_broken_wiki_link",
            label: "Wikilink in normalen Text umwandeln",
          },
        ],
      });
    }

    if (page.canonicalStatus === "contradictory") {
      findings.push({
        id: findingId("contradictory_page", [page.id]),
        code: "contradictory_page",
        severity: "warning",
        message: `„${page.title}" ist als widersprüchlich markiert und sollte aufgelöst werden.`,
        pageTitle: page.title,
        href,
        pageId: page.id,
        fixes: [],
      });
    }

    if (
      options.campaigns &&
      options.campaigns.length > 0 &&
      page.campaignId === null
    ) {
      const singleCampaign = options.campaigns.length === 1 ? options.campaigns[0] : null;
      findings.push({
        id: findingId("uncategorized_page", [page.id]),
        code: "uncategorized_page",
        severity: "info",
        message: `„${page.title}" ist keiner Kampagne zugeordnet.`,
        pageTitle: page.title,
        href,
        pageId: page.id,
        fixes: singleCampaign
          ? [
              {
                action: "assign_page_campaign",
                label: `Kampagne „${singleCampaign.name}" zuordnen`,
              },
            ]
          : [],
      });
    }
  }

  // Orphans: pages that neither link out nor are linked from anywhere.
  for (const page of pages) {
    if (linkedPageIds.has(page.id)) continue;

    const isLinkedFromOthers = pages.some((other) => {
      if (other.id === page.id) return false;
      const content = other.blocks.map((block) => block.content).join("\n");
      return parseWikiLinks(content).some((link) => {
        const key = normalizeLookupKey(link.target);
        return (
          key === normalizeLookupKey(page.title) ||
          key === normalizeLookupKey(page.slug) ||
          page.aliases.some((alias) => normalizeLookupKey(alias) === key)
        );
      });
    });

    if (!isLinkedFromOthers) {
      findings.push({
        id: findingId("orphan_page", [page.id]),
        code: "orphan_page",
        severity: "info",
        message: `„${page.title}" hat keine Beziehungen — keine Wikilinks hinein oder hinaus.`,
        pageTitle: page.title,
        href: studioHref(worldSlug, page),
        pageId: page.id,
        fixes: [],
      });
    }
  }

  return sortFindings(findings);
}

export class WorldInspectorService {
  constructor(private readonly db: PrismaClient) {}

  async inspectWorld(worldSlug: string): Promise<WorldInspectorReport | null> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;

    const settings = await new SettingsService(this.db).getSettings();

    const [rawPages, assetCount, explicitLinks, campaigns] = await Promise.all([
      this.db.page.findMany({
        where: { worldId: world.id },
        include: { contentBlocks: { orderBy: { sortOrder: "asc" } } },
        orderBy: [{ title: "asc" }],
      }),
      this.db.asset.count({ where: { worldId: world.id } }),
      this.db.pageLink.findMany({
        where: { sourcePage: { worldId: world.id } },
        select: { sourcePageId: true, targetPageId: true },
      }),
      this.db.campaign.findMany({
        where: { worldId: world.id },
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const pages: InspectorPageInput[] = rawPages.map((page) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      type: page.type,
      canonicalStatus: page.canonicalStatus,
      aliases: Array.isArray(page.aliases) ? (page.aliases as string[]) : [],
      campaignId: page.campaignId,
      blocks: page.contentBlocks.map((block) => ({
        id: block.id,
        type: block.type,
        content: block.content,
      })),
    }));

    return {
      worldSlug,
      portal: {
        portalEnabled: settings.portal.portalEnabled,
      },
      pageCount: pages.length,
      assetCount,
      canonFindings: mergeCanonFindings(
        buildCanonFindings(worldSlug, pages, explicitLinks, { campaigns }),
        await getExtendedCanonFindings(this.db, worldSlug, pages),
      ),
    };
  }
}

export function createWorldInspectorService(db: PrismaClient): WorldInspectorService {
  return new WorldInspectorService(db);
}
