import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  PortalNavByType,
  PortalWorldHero,
  SearchField,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  buildPageUrl,
  getAppRepository,
  navCategoryForPageType,
  type NavCategory,
} from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ type?: string; q?: string }>;
}

export default async function PortalWorldHome({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { type, q } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const pages = await repo.listPagesForContext(worldSlug, "portal", {
    navCategory: type as NavCategory | undefined,
    query: q,
  });

  const navItems = pages.map((page) => ({
    title: page.title,
    href: buildPageUrl(worldSlug, page.type, page.slug),
    navCategory: navCategoryForPageType(page.type),
  }));

  return (
    <AppShell
      topBar={
        <>
          <TopBarBrand appName="UWE Portal" subtitle={world.name} href="/" />
          <SearchField
            action={`/worlds/${worldSlug}`}
            defaultValue={q ?? ""}
            placeholder="In dieser Welt suchen…"
          />
        </>
      }
      sidebar={
        <SidebarSection title="Navigation">
          <Link href="/worlds" style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
            ← Alle Welten
          </Link>
          <PortalNavByType
            worldSlug={worldSlug}
            items={navItems}
            activeCategory={type as NavCategory | undefined}
          />
        </SidebarSection>
      }
      main={
        <>
          <PortalWorldHero
            name={world.name}
            description={world.description}
            pageCount={pages.length}
          />

          {q && (
            <p style={{ color: "#94a3b8", marginBottom: "1rem" }}>
              {pages.length} Treffer für „{q}"
            </p>
          )}

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
          </div>

          {pages.length === 0 && (
            <p className="uwe-empty">Keine veröffentlichten Seiten gefunden.</p>
          )}
        </>
      }
    />
  );
}
