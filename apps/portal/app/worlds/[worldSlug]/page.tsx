import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EmptyState,
  GlobalSearchForm,
  PortalNavByType,
  PortalNavSidebar,
  PortalWorldHero,
  SearchFilterBar,
  SearchResultsList,
} from "@uwe/shared-ui";
import {
  buildPageUrl,
  createAuthService,
  createPrismaClient,
  navCategoryForPageType,
  SEARCH_ENTITY_FILTER_LABELS,
  SEARCH_ENTITY_FILTERS,
  type NavCategory,
  type SearchEntityFilter,
} from "@uwe/database/server";
import { assertWorldReadable } from "@/src/lib/auth";
import { portalWorldBottomNav } from "@/src/lib/mobile-nav";
import { PortalGuestShell } from "@/src/components/PortalGuestShell";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ type?: string; q?: string; filter?: string }>;
}

export default async function PortalWorldHome({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { type, q, filter: entityFilter } = await searchParams;

  let world;
  let ctx;
  try {
    ({ world, ctx } = await assertWorldReadable(worldSlug));
  } catch {
    notFound();
  }

  const isSearching = Boolean(q?.trim());
  const db = createPrismaClient();
  const auth = createAuthService(db);

  let pages;
  let searchResults;

  try {
    const allPages = await auth.listPagesForViewer(worldSlug, ctx);
    pages = type
      ? allPages.filter((page) => navCategoryForPageType(page.type) === type)
      : allPages;

    searchResults = isSearching
      ? await auth.searchForViewer(worldSlug, ctx, {
          query: q!,
          entityFilter: entityFilter as SearchEntityFilter | undefined,
          urlMode: "portal",
        })
      : [];
  } finally {
    await db.$disconnect();
  }

  const navItems = (isSearching ? searchResults : pages).map((page) => ({
    title: page.title,
    href: buildPageUrl(worldSlug, page.type, page.slug),
    navCategory: navCategoryForPageType(page.type),
  }));

  return (
    <PortalGuestShell
      worldName={world.name}
      brandHref="/worlds"
      bottomNav={portalWorldBottomNav(worldSlug, isSearching ? "search" : "home")}
      breadcrumbs={[
        { label: "Welten", href: "/worlds" },
        { label: world.name },
      ]}
      topBarExtra={
        <GlobalSearchForm
          action={`/worlds/${worldSlug}`}
          query={q ?? ""}
          placeholder="In dieser Welt suchen…"
        />
      }
      sidebar={
        <PortalNavSidebar>
          <Link href="/worlds" className="uwe-sidebar-back-link">
            ← Alle Welten
          </Link>
          {!isSearching && (
            <PortalNavByType
              worldSlug={worldSlug}
              items={navItems}
              activeCategory={type as NavCategory | undefined}
            />
          )}
        </PortalNavSidebar>
      }
    >
      <PortalWorldHero
        name={world.name}
        description={world.description}
        pageCount={isSearching ? searchResults.length : pages.length}
      />

      {isSearching ? (
        <>
          <SearchFilterBar
            action={`/worlds/${worldSlug}`}
            query={q}
            filters={[
              {
                name: "filter",
                label: "Typ",
                value: entityFilter,
                options: SEARCH_ENTITY_FILTERS.map((filter) => ({
                  value: filter,
                  label: SEARCH_ENTITY_FILTER_LABELS[filter],
                })),
              },
            ]}
          />
          <SearchResultsList results={searchResults} query={q} />
        </>
      ) : (
        <div className="wiki-page-list">
          {pages.map((page) => (
            <article key={page.id} className="wiki-world-card">
              <h2>
                <Link href={buildPageUrl(worldSlug, page.type, page.slug)}>
                  {page.title}
                </Link>
              </h2>
              {page.summary && <p>{page.summary}</p>}
            </article>
          ))}

          {pages.length === 0 && (
            <EmptyState
              title="Keine veröffentlichten Seiten"
              description="In dieser Welt sind noch keine Inhalte für dich freigegeben."
            />
          )}
        </div>
      )}
    </PortalGuestShell>
  );
}
