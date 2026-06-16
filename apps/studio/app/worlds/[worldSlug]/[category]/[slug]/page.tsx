import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  ContentBlockList,
  GraphView,
  MetaPanel,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
  VisibilityBadge,
  WikiContent,
  WikiSidebar,
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
import { pagePreviewHref } from "../../../../actions";

interface Props {
  params: Promise<{ worldSlug: string; category: string; slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

export default async function StudioPageView({ params, searchParams }: Props) {
  const { worldSlug, category, slug } = await params;
  const { preview } = await searchParams;
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
      <AppShell
        topBar={
          <>
            <TopBarBrand appName="UWE Studio" subtitle={world.name} href="/" />
            {!isPlayerPreview && (
              <Link className="uwe-btn uwe-btn-ghost" href={pagePreviewHref(worldSlug, rawPage.type, slug)}>
                Vorschau als Spieler
              </Link>
            )}
            {isPlayerPreview && (
              <Link className="uwe-btn uwe-btn-ghost" href={buildPageUrl(worldSlug, rawPage.type, slug)}>
                Zurück zur DM-Ansicht
              </Link>
            )}
          </>
        }
        sidebar={
          <>
            <SidebarSection title="Navigation">
              <SidebarNav
                items={[
                  { label: "← Seitenliste", href: `/worlds/${worldSlug}` },
                  { label: "Graph", href: `/worlds/${worldSlug}/graph?focusPageId=${rawPage.id}&mode=neighbors` },
                  { label: "Bearbeiten", href: `${buildPageUrl(worldSlug, rawPage.type, slug)}/edit` },
                ]}
              />
            </SidebarSection>
            {!isPlayerPreview && dmPage && (
              <SidebarSection title="Blöcke">
                <ContentBlockList
                  blocks={dmPage.contentBlocks.map((b) => ({
                    id: b.id,
                    type: b.type,
                    sortOrder: b.sortOrder,
                    content: b.content,
                    visibility: b.visibility,
                  }))}
                  showVisibility
                />
              </SidebarSection>
            )}
          </>
        }
        main={
          <>
            <Breadcrumb
              items={[
                { label: "Dashboard", href: "/" },
                { label: world.name, href: `/worlds/${worldSlug}` },
                { label: NAV_CATEGORY_LABELS[category as NavCategory] },
                { label: view.page.title },
              ]}
            />
            <PageHeader
              title={view.page.title}
              summary={rawPage.summary}
              meta={
                !isPlayerPreview && dmPage ? (
                  <>
                    <VisibilityBadge visibility={dmPage.visibility} />
                    {view.page.tags.map((tag) => (
                      <span key={tag} className="uwe-tag">{tag}</span>
                    ))}
                  </>
                ) : (
                  view.page.tags.map((tag) => (
                    <span key={tag} className="uwe-tag">{tag}</span>
                  ))
                )
              }
              actions={
                !isPlayerPreview ? (
                  <>
                    <Link
                      className="uwe-btn"
                      href={`/worlds/${worldSlug}/labels/new?sourceRef=${rawPage.type === "room" ? "dungeon_room" : "page"}:${rawPage.id}`}
                    >
                      Label erstellen
                    </Link>
                    <Link className="uwe-btn uwe-btn-primary" href={`${buildPageUrl(worldSlug, rawPage.type, slug)}/edit`}>
                      Bearbeiten
                    </Link>
                  </>
                ) : undefined
              }
            />
            <WikiContent html={view.html} />

            <section style={{ marginTop: "2rem" }}>
              <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Nachbarschafts-Graph</h2>
              <GraphView nodes={pageGraph.nodes} edges={pageGraph.edges} compact />
            </section>
          </>
        }
        context={
          <>
            <WikiSidebar
              backlinks={view.backlinks}
              relatedPages={view.relatedPages}
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
                  />
                </SidebarSection>
                <SidebarSection title="Freigabe">
                  <ShareLinkPanel
                    worldId={world.id}
                    worldSlug={worldSlug}
                    targetType={shareTargetType}
                    targetId={rawPage.id}
                    returnPath={returnPath}
                    links={shareLinks}
                    previewHref={previewHref}
                  />
                </SidebarSection>
                <SidebarSection title="KI-Prompt">
                  <MobileAiPromptPanel
                    worldSlug={worldSlug}
                    pageSlug={slug}
                    pageTitle={view.page.title}
                    useMock={useMockAi}
                  />
                </SidebarSection>
                <hr className="mobile-ai-brain-divider" aria-hidden="true" />
                <AiBrainSidebar worldSlug={worldSlug} pageSlug={slug} />
              </>
            )}
          </>
        }
      />
    </>
  );
}
