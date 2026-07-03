import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Collapsible,
  GraphView,
  MetaPanel,
  SidebarSection,
  VisibilityBadge,
} from "@uwe/shared-ui";
import { AiBrainSidebar } from "@/components/AiBrainSidebar";
import { MobileAiPromptPanel } from "@/components/MobileAiPromptPanel";
import { ShareLinkPanel } from "@/components/ShareLinkPanel";
import {
  buildPageGraph,
  buildPageView,
  buildPageUrl,
  createPrismaClient,
  createShareLinkService,
  getAppRepository,
  navCategoryForPageType,
  NAV_CATEGORY_LABELS,
  parseStringArray,
  type NavCategory,
  type ShareTargetType,
} from "@uwe/database/server";
import { getShareLinkPublicUrl } from "@/src/lib/share-url";
import { pagePreviewHref } from "@/src/lib/page-preview";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { WikiContextPanel, WikiTiptapViewer } from "@/src/components/wiki";
import { wikiPageBreadcrumb } from "@/src/lib/world-breadcrumbs";

export interface StudioWikiPageViewProps {
  worldSlug: string;
  category: string;
  slug: string;
  preview?: string;
}

export async function StudioWikiPageView({
  worldSlug,
  category,
  slug,
  preview,
}: StudioWikiPageViewProps) {
  const isPlayerPreview = preview === "player";
  const context = isPlayerPreview ? "preview" : "dm";
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const rawPage = await repo.getPageBySlug(worldSlug, slug);
  if (!rawPage) notFound();

  const expectedCategory = navCategoryForPageType(rawPage.type);
  if (expectedCategory !== category) notFound();

  const view = await buildPageView(repo, worldSlug, slug, context);
  if (!view) notFound();

  const pageGraph = await buildPageGraph(repo, worldSlug, rawPage.id, context, "neighbors");

  const dmPage = context === "dm" ? rawPage : null;

  const shareTargetType: ShareTargetType =
    rawPage.type === "handout" ? "handout" : "page";
  const returnPath = buildPageUrl(worldSlug, rawPage.type, slug);
  const pageHref = buildPageUrl(worldSlug, rawPage.type, slug);

  const db = createPrismaClient();
  let shareLinks: Array<{
    id: string;
    token: string;
    enabled: boolean;
    expiresAt: string | null;
    readOnly: boolean;
    logAccess: boolean;
    hasPassword: boolean;
    createdAt: string;
  }> = [];
  let previewHref: string | undefined;

  try {
    const shareService = createShareLinkService(db);
    const links = await shareService.listShareLinksForTarget(
      world.id,
      shareTargetType,
      rawPage.id,
    );
    shareLinks = links.map((link) => ({
      id: link.id,
      token: link.token,
      enabled: link.enabled,
      expiresAt: link.expiresAt?.toISOString() ?? null,
      readOnly: link.readOnly,
      logAccess: link.logAccess,
      hasPassword: Boolean(link.passwordHash),
      createdAt: link.createdAt.toISOString(),
    }));
    const activeLink = links.find((link) => link.enabled);
    if (activeLink) {
      previewHref = getShareLinkPublicUrl(activeLink.token);
    }
  } finally {
    await db.$disconnect();
  }

  const useMockAi = process.env.NEXT_PUBLIC_AI_USE_MOCK === "true";

  return (
    <>
      {isPlayerPreview && (
        <div className="uwe-preview-banner">
          Spieler-Vorschau — DM-only Inhalte sind ausgeblendet
          {view.privateReferenceWarning && (
            <p style={{ margin: "0.5rem 0 0", fontWeight: 600 }}>
              {view.privateReferenceWarning}
            </p>
          )}
        </div>
      )}
      <WorldShell
        worldSlug={worldSlug}
        worldName={world.name}
        breadcrumb={
          <BreadcrumbTrail
            items={wikiPageBreadcrumb(
              world.name,
              worldSlug,
              NAV_CATEGORY_LABELS[category as NavCategory],
              view.page.title,
              pageHref,
            )}
          />
        }
        contextPanel={
          <>
            <WikiContextPanel
              worldSlug={worldSlug}
              backlinks={view.backlinks}
              outgoingLinks={view.links}
              relatedPages={view.relatedPages}
              showCreateMissing={!isPlayerPreview}
            />
            {!isPlayerPreview && dmPage && (
              <>
                <SidebarSection title="Metadaten">
                  <MetaPanel
                    visibility={dmPage.visibility}
                    publishStatus={dmPage.publishStatus}
                    canonicalStatus={dmPage.canonicalStatus}
                    type={dmPage.type}
                    tags={parseStringArray(dmPage.tags)}
                    aliases={parseStringArray(dmPage.aliases)}
                    secretLevel={dmPage.secretLevel}
                    revealState={dmPage.revealState}
                  />
                </SidebarSection>
                <Collapsible variant="sidebar" title="Freigabe" defaultOpen={false}>
                  <ShareLinkPanel
                    worldId={world.id}
                    worldSlug={worldSlug}
                    targetType={shareTargetType}
                    targetId={rawPage.id}
                    returnPath={returnPath}
                    links={shareLinks}
                    previewHref={previewHref}
                  />
                </Collapsible>
                <Collapsible variant="sidebar" title="KI & Assistenz" defaultOpen={false}>
                  <MobileAiPromptPanel
                    worldSlug={worldSlug}
                    pageSlug={slug}
                    pageTitle={view.page.title}
                    useMock={useMockAi}
                  />
                  <hr className="mobile-ai-brain-divider" aria-hidden="true" />
                  <AiBrainSidebar worldSlug={worldSlug} pageSlug={slug} />
                </Collapsible>
              </>
            )}
          </>
        }
      >
        <PageHeader
          title={view.page.title}
          summary={rawPage.summary}
          meta={
            !isPlayerPreview && dmPage ? (
              <>
                <VisibilityBadge visibility={dmPage.visibility} />
                {view.page.tags.map((tag) => (
                  <span key={tag} className="uwe-tag">
                    {tag}
                  </span>
                ))}
              </>
            ) : (
              view.page.tags.map((tag) => (
                <span key={tag} className="uwe-tag">
                  {tag}
                </span>
              ))
            )
          }
          actions={
            !isPlayerPreview ? (
              <>
                <Link
                  className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm hover:bg-muted"
                  href={`/worlds/${worldSlug}/labels/new?sourceRef=${rawPage.type === "room" ? "dungeon_room" : "page"}:${rawPage.id}`}
                >
                  Label erstellen
                </Link>
                <Link
                  className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
                  href={`${pageHref}/edit`}
                >
                  Bearbeiten
                </Link>
                <Link
                  className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm hover:bg-muted"
                  href={pagePreviewHref(worldSlug, rawPage.type, slug)}
                >
                  Vorschau als Spieler
                </Link>
              </>
            ) : (
              <Link
                className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm hover:bg-muted"
                href={pageHref}
              >
                Zurück zur DM-Ansicht
              </Link>
            )
          }
        />

        <div className="uwe-v2-reader uwe-v2-wiki">
          <WikiTiptapViewer html={view.html} />

          <section className="wiki-graph-section uwe-v2-wiki-aside mt-8">
            <div className="wiki-graph-head mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Nachbarschafts-Graph</h2>
              <Link
                className="text-sm hover:underline"
                href={`/worlds/${worldSlug}/graph?focusPageId=${rawPage.id}&mode=neighbors`}
              >
                Im großen Graph öffnen →
              </Link>
            </div>
            <GraphView
              nodes={pageGraph.nodes}
              edges={pageGraph.edges}
              compact
              focusPageId={rawPage.id}
              height={320}
            />
          </section>
        </div>
      </WorldShell>
    </>
  );
}
