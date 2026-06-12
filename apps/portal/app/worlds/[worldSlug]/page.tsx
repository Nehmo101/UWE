import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  EmptyState,
  GlobalSearchForm,
  PortalNavByType,
  PortalWorldHero,
  SearchFilterBar,
  SearchResultsList,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  buildPageUrl,
  getAppRepository,
  navCategoryForPageType,
  SEARCH_ENTITY_FILTER_LABELS,
  SEARCH_ENTITY_FILTERS,
  type NavCategory,
  type SearchEntityFilter,
} from "@uwe/database/server";
import { portalWorldBottomNav } from "@/src/lib/mobile-nav";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ type?: string; q?: string; filter?: string }>;
}

export default async function PortalWorldHome({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { type, q, filter: entityFilter } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const isSearching = Boolean(q?.trim());

  const pages = isSearching
    ? []
    : await repo.listPagesForContext(worldSlug, "portal", {
        navCategory: type as NavCategory | undefined,
      });

  const searchResults = isSearching
    ? await repo.search("portal", {
        query: q!,
        worldSlug,
        entityFilter: entityFilter as SearchEntityFilter | undefined,
        urlMode: "portal",
      })
    : [];

  const navItems = (isSearching ? searchResults : pages).map((page) => ({
    title: page.title,
    href: buildPageUrl(worldSlug, page.type, page.slug),
    navCategory: navCategoryForPageType(page.type),
  }));

  return (
    <AppShell
      bottomNav={portalWorldBottomNav(worldSlug, isSearching ? "search" : "home")}
      contextTitle="Navigation"
      topBar={
        <>
          <TopBarBrand appName="UWE Portal" subtitle={world.name} href="/" />
          <div id="search">
            <GlobalSearchForm
              action={`/worlds/${worldSlug}`}
              query={q ?? ""}
              placeholder="In dieser Welt suchen…"
            />
          </div>
        </>
      }
      sidebar={
        <SidebarSection title="Navigation">
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
        </SidebarSection>
      }
      main={
        <>
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
                  description="In dieser Welt sind noch keine Inhalte für Spieler freigegeben."
                />
              )}
            </div>
          )}
        </>
      }
    />
  );
}
