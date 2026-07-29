import type { AccessContext } from "@uwe/auth";
import { filterBlocksForViewer, filterPagesForViewer } from "@uwe/auth";
import type { AuthService } from "./auth";
import { parseStringArray } from "./json-utils";
import { buildPageUrl } from "./page-types";
import {
  combineBlockContent,
  getWorldWikiGraph,
  normalizeLookupKey,
  pageToWikiNode,
  parseWikiLinks,
  type PageViewBacklink,
  type PageViewData,
  type PageViewLink,
  type PageViewRelated,
  type WikiPageNode,
} from "./page-service";
import type { PageSummary, PageWithBlocks, UweRepository } from "./repository";
import { renderAssetBlockHtml, studioAssetUrl } from "./content-block-html";

function resolveViewerLinks(
  content: string,
  worldSlug: string,
  allPages: PageSummary[],
): PageViewLink[] {
  return parseWikiLinks(content).map((raw) => {
    const displayText = raw.label ?? raw.target;
    const key = normalizeLookupKey(raw.target);
    const target = allPages.find(
      (page) =>
        normalizeLookupKey(page.title) === key ||
        normalizeLookupKey(page.slug) === key ||
        parseStringArray(page.aliases).some((alias) => normalizeLookupKey(alias) === key),
    );

    if (!target) {
      return { displayText, status: "broken" as const };
    }

    return {
      displayText,
      href: buildPageUrl(worldSlug, target.type, target.slug),
      status: "resolved" as const,
    };
  });
}

function buildRelatedPages(
  node: WikiPageNode,
  links: PageViewLink[],
  backlinks: PageViewBacklink[],
  visibleNodes: WikiPageNode[],
): PageViewRelated[] {
  const relatedScores = new Map<
    string,
    { title: string; href: string; reasons: Set<string>; score: number }
  >();

  function addRelated(target: WikiPageNode, reason: string, score: number) {
    if (target.id === node.id) return;

    const existing = relatedScores.get(target.id);
    if (existing) {
      existing.reasons.add(reason);
      existing.score += score;
    } else {
      relatedScores.set(target.id, {
        title: target.title,
        href: target.href,
        reasons: new Set([reason]),
        score,
      });
    }
  }

  for (const link of links) {
    if (link.status === "resolved" && link.href) {
      const target = visibleNodes.find((item) => item.href === link.href);
      if (target) addRelated(target, "direct_link", 3);
    }
  }

  for (const backlink of backlinks) {
    const target = visibleNodes.find((item) => item.href === backlink.href);
    if (target) addRelated(target, "backlink", 2);
  }

  for (const other of visibleNodes) {
    if (other.id === node.id) continue;
    const shared = other.tags.filter((tag) => node.tags.includes(tag));
    if (shared.length > 0) {
      addRelated(other, `shared_tag:${shared.join(",")}`, shared.length);
    }
  }

  return [...relatedScores.values()]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 10)
    .map((item) => ({
      title: item.title,
      href: item.href,
      reasons: [...item.reasons],
    }));
}

export async function buildPageViewForViewer(
  auth: AuthService,
  repo: UweRepository,
  worldSlug: string,
  pageSlug: string,
  ctx: AccessContext,
): Promise<PageViewData | null> {
  const page = await auth.getPageForViewer(worldSlug, pageSlug, ctx);
  if (!page) {
    return null;
  }

  const renderCtx = await auth.buildViewerRenderContext(worldSlug, ctx);
  const blockHtmlParts = await Promise.all(
    page.contentBlocks.map(async (block) => {
      const html = await auth.renderBlockContentForViewer(
        worldSlug,
        block.content,
        ctx,
        renderCtx,
      );
      return renderAssetBlockHtml(block, html, { assetUrl: studioAssetUrl });
    }),
  );
  const html = blockHtmlParts.filter(Boolean).join("\n\n");

  const { pages: indexedPages, pageIndex: allPages, blockTargets } =
    await getWorldWikiGraph(repo, worldSlug);
  const combinedContent = combineBlockContent(page.contentBlocks);
  const links = resolveViewerLinks(combinedContent, worldSlug, allPages);

  const viewerPages: PageWithBlocks[] = filterPagesForViewer(ctx, indexedPages).map((candidate) => ({
    ...candidate,
    contentBlocks: filterBlocksForViewer(ctx, candidate.contentBlocks),
  }));

  const visibleNodes = viewerPages.map((candidate) => pageToWikiNode(worldSlug, candidate));
  const node = pageToWikiNode(worldSlug, page);

  // Backlinks from the cached, pre-parsed wikilink graph (H2). A page is a
  // backlink of the focus page iff one of its blocks contains a wikilink that
  // resolves — by the same first-match over the world page index as
  // resolveViewerLinks — to the focus page. Slugs are unique per world, so
  // "resolves to focus page id" is exactly the original href match.
  const backlinks: PageViewBacklink[] = [];
  for (const candidate of viewerPages) {
    if (candidate.id === node.id) continue;
    const linksToTarget = candidate.contentBlocks.some((block) =>
      blockTargets.get(block.id)?.includes(page.id),
    );
    if (linksToTarget) {
      backlinks.push({
        title: candidate.title,
        href: buildPageUrl(worldSlug, candidate.type, candidate.slug),
      });
    }
  }

  backlinks.sort((a, b) => a.title.localeCompare(b.title));

  return {
    page: node,
    links,
    backlinks,
    relatedPages: buildRelatedPages(node, links, backlinks, visibleNodes),
    html,
  };
}
