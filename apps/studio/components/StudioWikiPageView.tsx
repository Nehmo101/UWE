import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Collapsible,
  EmptyState,
  GraphView,
  MetaPanel,
  SidebarSection,
  TagChip,
  VisibilityBadge,
  WikiContent,
} from "@uwe/shared-ui";
import { AiBrainSidebar } from "@/components/AiBrainSidebar";
import { MobileAiPromptPanel } from "@/components/MobileAiPromptPanel";
import { Alert, buttonVariants } from "@/src/components/ui";
import {
  buildPageGraph,
  buildPageView,
  buildPageUrl,
  createAuthService,
  createPrismaClient,
  getAppRepository,
  navCategoryForPageType,
  NAV_CATEGORY_LABELS,
  parseStringArray,
  type NavCategory,
  type PageWithBlocks,
} from "@uwe/database/server";
import { buildPageGraphForViewer } from "@uwe/database/graph-service";
import { buildPageViewForViewer } from "@uwe/database/page-viewer-service";
import { pagePreviewHref } from "@/src/lib/page-preview";
import { describePreviewVisibilityGate } from "@/src/lib/preview-visibility-reason";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { PreviewAsPlayerControls } from "@/src/components/PreviewAsPlayerControls";
import { WikiContextPanel } from "@/src/components/wiki";
import { wikiPageBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { canUsePreview, getAccessContextForWorld, getPreviewUserId, getWorldPlayers } from "@/src/lib/auth";

function renderPreviewNotVisible(worldSlug: string, page: PageWithBlocks) {
  const pageHref = buildPageUrl(worldSlug, page.type, page.slug);
  return (
    <div className="page">
      <EmptyState
        title="Für Spieler noch nicht sichtbar"
        description={`Diese Seite existiert, ist aktuell aber nicht für Spieler sichtbar. ${describePreviewVisibilityGate(page)}`}
        action={
          <Link className={buttonVariants({ variant: "default" })} href={pageHref}>
            Zurück zur DM-Ansicht
          </Link>
        }
      />
    </div>
  );
}

export interface StudioWikiPageViewProps {
  worldSlug: string;
  category: string;
  slug: string;
  preview?: string;
}

function withPlayerPreviewHref(href: string, active: boolean): string {
  if (!active) return href;
  return `${href}${href.includes("?") ? "&" : "?"}preview=player`;
}

export async function StudioWikiPageView({
  worldSlug,
  category,
  slug,
  preview,
}: StudioWikiPageViewProps) {
  const isPlayerPreview = preview === "player";
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const rawPage = await repo.getPageBySlug(worldSlug, slug);
  if (!rawPage) notFound();

  const expectedCategory = navCategoryForPageType(rawPage.type);
  if (expectedCategory !== category) notFound();

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let view;
  let pageGraph;
  let previewUserId: string | null = null;
  let showPreviewControls = false;
  let previewPlayers: Array<{ id: string; displayName: string; characterName: string | null }> = [];

  try {
    if (isPlayerPreview) {
      previewUserId = await getPreviewUserId();
      showPreviewControls = await canUsePreview(worldSlug);
      if (showPreviewControls) {
        const players = await getWorldPlayers(worldSlug);
        previewPlayers = players.map((entry) => ({
          id: entry.user.id,
          displayName: entry.user.displayName,
          characterName: entry.characterName,
        }));
      }

      const accessCtx = await getAccessContextForWorld(worldSlug);
      if (accessCtx?.previewAsUserId) {
        view = await buildPageViewForViewer(auth, repo, worldSlug, slug, accessCtx);
        if (!view) return renderPreviewNotVisible(worldSlug, rawPage);
        pageGraph = await buildPageGraphForViewer(
          repo,
          worldSlug,
          rawPage.id,
          accessCtx,
          "neighbors",
        );
      } else {
        view = await buildPageView(repo, worldSlug, slug, "preview");
        if (!view) return renderPreviewNotVisible(worldSlug, rawPage);
        pageGraph = await buildPageGraph(repo, worldSlug, rawPage.id, "preview", "neighbors");
      }
    } else {
      view = await buildPageView(repo, worldSlug, slug, "dm");
      if (!view) notFound();
      pageGraph = await buildPageGraph(repo, worldSlug, rawPage.id, "dm", "neighbors");
    }

    const pageHref = buildPageUrl(worldSlug, rawPage.type, slug);

    const dmPage = isPlayerPreview ? null : rawPage;
    const useMockAi = process.env.NEXT_PUBLIC_AI_USE_MOCK === "true";
    const graphHref = withPlayerPreviewHref(
      `/worlds/${worldSlug}/graph?focusPageId=${rawPage.id}&mode=neighbors`,
      isPlayerPreview,
    );

    return (
      <>
        {isPlayerPreview && (
          <div
            className="border-b border-border bg-[color-mix(in_srgb,var(--uwe-warning)_15%,transparent)] px-4 py-2 text-center text-sm font-medium"
            role="status"
          >
            Spieler-Vorschau — DM-only Inhalte sind ausgeblendet
            {previewUserId && previewPlayers.length > 0 && (
              <p className="mt-2 font-semibold">
                Perspektive:{" "}
                {previewPlayers.find((player) => player.id === previewUserId)?.characterName ??
                  previewPlayers.find((player) => player.id === previewUserId)?.displayName ??
                  "Spieler"}
              </p>
            )}
            {view.privateReferenceWarning && (
              <p className="mt-2 font-semibold">
                {view.privateReferenceWarning}
              </p>
            )}
            {showPreviewControls && (
              <PreviewAsPlayerControls
                worldSlug={worldSlug}
                players={previewPlayers}
                currentPreviewUserId={previewUserId}
              />
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
                withPlayerPreviewHref(pageHref, isPlayerPreview),
              )}
            />
          }
          contextPanel={
            <>
              <WikiContextPanel
                worldSlug={worldSlug}
                backlinks={view.backlinks.map((link) => ({
                  ...link,
                  href: withPlayerPreviewHref(link.href, isPlayerPreview),
                }))}
                outgoingLinks={view.links.map((link) => ({
                  ...link,
                  href: link.href ? withPlayerPreviewHref(link.href, isPlayerPreview) : link.href,
                }))}
                relatedPages={view.relatedPages.map((page) => ({
                  ...page,
                  href: withPlayerPreviewHref(page.href, isPlayerPreview),
                }))}
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
                    />
                  </SidebarSection>
                  <Collapsible variant="sidebar" title="KI & Assistenz" defaultOpen={false}>
                    <MobileAiPromptPanel
                      worldSlug={worldSlug}
                      pageSlug={slug}
                      pageTitle={view.page.title}
                      useMock={useMockAi}
                      variant="page"
                    />
                  </Collapsible>
                  <Collapsible variant="sidebar" title="Brain-Aktionen" defaultOpen={false}>
                    <p className="mt-0 text-sm text-muted-foreground">
                      Strukturierte Brain-Aktionen mit Review-Proposal — läuft über RTX Connector.
                    </p>
                    <AiBrainSidebar worldSlug={worldSlug} pageSlug={slug} variant="store" />
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
                    <TagChip key={tag} tag={tag} />
                  ))}
                </>
              ) : (
                view.page.tags.map((tag) => <TagChip key={tag} tag={tag} />)
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

          <div className="max-w-[52rem] uwe-v2-wiki">
            {view.links.some((link) => link.status === "broken") && (
              <Alert tone="warning" role="note">
                Diese Seite enthält {view.links.filter((link) => link.status === "broken").length}{" "}
                defekte Wikilinks — siehe Seitenleiste „Ausgehende Links“.
              </Alert>
            )}
            <WikiContent html={view.html} />

            <section className="wiki-graph-section uwe-v2-wiki-aside mt-8">
              <div className="wiki-graph-head mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Nachbarschafts-Graph</h2>
                <Link className="text-sm hover:underline" href={graphHref}>
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
  } finally {
    await db.$disconnect();
  }
}
