import type { PrismaClient } from "./client";
import type {
  AssetType,
  CanonicalStatus,
  ContentBlockType,
  PageType,
  Visibility,
} from "./generated/prisma/client";
import { normalizeLookupKey, parseWikiLinks } from "./page-service";
import { buildPageUrl } from "./page-types";
import {
  isPageAccessible,
  isPortalAssetVisibility,
  isPortalBlockVisibility,
  type PortalAccessOptions,
} from "./permissions";
import { SettingsService } from "./settings-service";
import { getExtendedCanonFindings, mergeCanonFindings } from "./canon-conflict-service";

/**
 * World Inspector: audits a world for two things —
 *
 * 1. Safety: what exactly is exposed to players via the portal and share
 *    links, and whether anything looks like an accidental leak.
 * 2. Canon: content quality warnings (broken wiki links, duplicate names,
 *    contradictory pages, inconsistent visibility/publish states).
 *
 * Everything is read-only and built from existing data — no AI, no
 * external services.
 */

export type InspectorSeverity = "critical" | "warning" | "info";

export type InspectorFindingCode =
  | "gm_note_player_visible"
  | "secret_page_portal_visible"
  | "hidden_link_in_portal_page"
  | "broken_wiki_link"
  | "duplicate_name"
  | "contradictory_page"
  | "published_but_dm_only"
  | "orphan_page"
  | "uncategorized_page"
  | "deprecated_player_visible"
  | "non_canon_portal_published"
  | "npc_status_conflict"
  | "brain_fact_death_conflict"
  | "world_rule_terra_tower";

/** Fix actions that can be applied directly from a finding (see inspector-fix-service). */
export type InspectorFixAction =
  | "set_block_dm_only"
  | "set_page_dm_only"
  | "set_page_player_visible"
  | "remove_broken_wiki_link"
  | "assign_page_campaign";

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
  visibility: Visibility;
  content: string;
}

export interface InspectorPageInput {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  visibility: Visibility;
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

export interface PortalVisiblePage {
  title: string;
  href: string;
  visibility: Visibility;
  visibleBlockCount: number;
  hiddenBlockCount: number;
}

export interface PortalVisibleAsset {
  title: string;
  type: AssetType;
  visibility: Visibility;
}

export interface WorldInspectorReport {
  worldSlug: string;
  portal: {
    portalEnabled: boolean;
    publicSharingEnabled: boolean;
    guestModeEnabled: boolean;
  };
  visiblePages: PortalVisiblePage[];
  visibleAssets: PortalVisibleAsset[];
  dmOnlyAssetCount: number;
  safetyFindings: InspectorFinding[];
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

    if (page.visibility === "dm_only") {
      findings.push({
        id: findingId("published_but_dm_only", [page.id]),
        code: "published_but_dm_only",
        severity: "info",
        message: `„${page.title}" ist DM-only — Spieler sehen sie nicht.`,
        pageTitle: page.title,
        href,
        pageId: page.id,
        fixes: [
          {
            action: "set_page_player_visible",
            label: "Für angemeldete Spieler im Portal freigeben",
          },
        ],
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

/** Safety findings: anything that looks like an accidental leak towards players. */
export function buildSafetyFindings(
  worldSlug: string,
  pages: InspectorPageInput[],
  portalOptions: PortalAccessOptions,
): InspectorFinding[] {
  const findings: InspectorFinding[] = [];
  const titleIndex = buildTitleIndex(pages);
  const pageById = new Map(pages.map((page) => [page.id, page]));

  for (const page of pages) {
    const href = studioHref(worldSlug, page);
    const portalVisible = isPageAccessible(page, "portal", portalOptions);

    for (const [blockIndex, block] of page.blocks.entries()) {
      if (block.type === "gm_note" && isPortalBlockVisibility(block.visibility)) {
        findings.push({
          id: findingId("gm_note_player_visible", [page.id, block.id ?? String(blockIndex)]),
          code: "gm_note_player_visible",
          severity: "critical",
          message: `GM-Notiz auf „${page.title}" ist als spielersichtbar markiert — Inhalt prüfen!`,
          pageTitle: page.title,
          href,
          pageId: page.id,
          blockId: block.id,
          fixes: block.id
            ? [{ action: "set_block_dm_only", label: "Block auf Nur GM setzen" }]
            : [],
        });
      }
    }

    if (page.type === "secret" && portalVisible) {
      findings.push({
        id: findingId("secret_page_portal_visible", [page.id]),
        code: "secret_page_portal_visible",
        severity: "critical",
        message: `Geheimnis-Seite „${page.title}" ist im Portal sichtbar.`,
        pageTitle: page.title,
        href,
        pageId: page.id,
        fixes: [{ action: "set_page_dm_only", label: "Seite auf Nur GM setzen" }],
      });
    }

    if (portalVisible) {
      const visibleContent = page.blocks
        .filter((block) => isPortalBlockVisibility(block.visibility))
        .map((block) => block.content)
        .join("\n");

      const hiddenTargets = new Set<string>();
      for (const link of parseWikiLinks(visibleContent)) {
        const targets = titleIndex.get(normalizeLookupKey(link.target)) ?? [];
        for (const target of targets) {
          const resolved = pageById.get(target.id);
          if (resolved && !isPageAccessible(resolved, "portal", portalOptions)) {
            hiddenTargets.add(resolved.title);
          }
        }
      }

      for (const hiddenTitle of hiddenTargets) {
        findings.push({
          id: findingId("hidden_link_in_portal_page", [page.id, normalizeLookupKey(hiddenTitle)]),
          code: "hidden_link_in_portal_page",
          severity: "info",
          message: `„${page.title}" verlinkt sichtbar auf die verborgene Seite „${hiddenTitle}" — Spieler sehen einen „Verborgen"-Platzhalter.`,
          pageTitle: page.title,
          href,
          pageId: page.id,
          fixes: [],
        });
      }
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
    const portalOptions: PortalAccessOptions = {
      publicSharingEnabled: settings.portal.publicSharingEnabled,
    };

    const [rawPages, assets, explicitLinks, campaigns] = await Promise.all([
      this.db.page.findMany({
        where: { worldId: world.id },
        include: { contentBlocks: { orderBy: { sortOrder: "asc" } } },
        orderBy: [{ title: "asc" }],
      }),
      this.db.asset.findMany({
        where: { worldId: world.id },
        select: { id: true, title: true, type: true, visibility: true },
        orderBy: [{ title: "asc" }],
      }),
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
      visibility: page.visibility,
      canonicalStatus: page.canonicalStatus,
      aliases: Array.isArray(page.aliases) ? (page.aliases as string[]) : [],
      campaignId: page.campaignId,
      blocks: page.contentBlocks.map((block) => ({
        id: block.id,
        type: block.type,
        visibility: block.visibility,
        content: block.content,
      })),
    }));


    const visiblePages: PortalVisiblePage[] = pages
      .filter((page) => isPageAccessible(page, "portal", portalOptions))
      .map((page) => {
        const visibleBlockCount = page.blocks.filter((block) =>
          isPortalBlockVisibility(block.visibility),
        ).length;
        return {
          title: page.title,
          href: studioHref(worldSlug, page),
          visibility: page.visibility,
          visibleBlockCount,
          hiddenBlockCount: page.blocks.length - visibleBlockCount,
        };
      });

    const visibleAssets: PortalVisibleAsset[] = assets
      .filter((asset) => isPortalAssetVisibility(asset.visibility))
      .map((asset) => ({
        title: asset.title,
        type: asset.type,
        visibility: asset.visibility,
      }));

    return {
      worldSlug,
      portal: {
        portalEnabled: settings.portal.portalEnabled,
        publicSharingEnabled: settings.portal.publicSharingEnabled,
        guestModeEnabled: world.guestModeEnabled,
      },
      visiblePages,
      visibleAssets,
      dmOnlyAssetCount: assets.length - visibleAssets.length,
      safetyFindings: buildSafetyFindings(worldSlug, pages, portalOptions),
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
