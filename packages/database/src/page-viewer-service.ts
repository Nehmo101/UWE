import type { AccessContext } from "@uwe/auth";
import { canReadContent, canViewPage, filterBlocksForViewer, scopeFromAccessContext } from "@uwe/auth";
import type { AuthService } from "./auth";
import {
  detectPrivateReferences,
  formatPrivateReferenceWarning,
} from "./content-access";
import { parseStringArray } from "./json-utils";
import { buildPageUrl } from "./page-types";
import {
  combineBlockContent,
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

function resolveViewerLinks(
  content: string,
  worldSlug: string,
  ctx: AccessContext,
  allPages: PageSummary[],
  scope: ReturnType<typeof scopeFromAccessContext>,
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

    if (!canReadContent(ctx.user, target, scope.world, scope)) {
      return { displayText: raw.label ?? "Verborgen", status: "hidden" as const };
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
  options?: { warnPrivateReferences?: boolean },
): Promise<PageViewData | null> {
  const page = await auth.getPageForViewer(worldSlug, pageSlug, ctx);
  if (!page) {
    return null;
  }

  const blockHtmlParts = await Promise.all(
    page.contentBlocks.map((block) =>
      auth.renderBlockContentForViewer(worldSlug, block.content, ctx),
    ),
  );
  const html = blockHtmlParts.filter(Boolean).join("\n\n");

  const allPages = await repo.getWorldPageIndex(worldSlug);
  const scope = scopeFromAccessContext(ctx, page.worldId);
  const combinedContent = combineBlockContent(page.contentBlocks);
  const links = resolveViewerLinks(combinedContent, worldSlug, ctx, allPages, scope);

  const indexedPages = await repo.listPagesWithBlocksForGraphUnfiltered(worldSlug, {});
  const viewerPages: PageWithBlocks[] = indexedPages
    .filter((candidate) => canViewPage(ctx, candidate))
    .map((candidate) => ({
      ...candidate,
      contentBlocks: filterBlocksForViewer(ctx, candidate.contentBlocks, candidate),
    }));

  const visibleNodes = viewerPages.map((candidate) => pageToWikiNode(worldSlug, candidate, "preview"));
  const node = pageToWikiNode(worldSlug, page, "preview");
  const targetHref = node.href;

  const backlinks: PageViewBacklink[] = [];
  for (const candidate of visibleNodes) {
    if (candidate.id === node.id) continue;

    const candidateLinks = resolveViewerLinks(
      candidate.content,
      worldSlug,
      ctx,
      allPages,
      scope,
    );
    const parsed = parseWikiLinks(candidate.content);

    const linksToTarget = parsed.some((raw, index) => {
      const resolved = candidateLinks[index];
      return resolved.status === "resolved" && resolved.href === targetHref;
    });

    if (linksToTarget) {
      backlinks.push({
        title: candidate.title,
        href: candidate.href,
      });
    }
  }

  backlinks.sort((a, b) => a.title.localeCompare(b.title));

  let privateReferenceWarning: string | null = null;
  if (options?.warnPrivateReferences ?? Boolean(ctx.previewAsUserId)) {
    const dmPage = await repo.getPageBySlug(worldSlug, pageSlug);
    if (dmPage) {
      privateReferenceWarning = formatPrivateReferenceWarning(
        detectPrivateReferences(combinedContent, allPages),
      );
    }
  }

  return {
    page: node,
    links,
    backlinks,
    relatedPages: buildRelatedPages(node, links, backlinks, visibleNodes),
    html,
    privateReferenceWarning,
  };
}
