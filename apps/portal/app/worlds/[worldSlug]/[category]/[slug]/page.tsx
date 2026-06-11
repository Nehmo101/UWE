import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  PageHeader,
  PortalNavByType,
  SearchField,
  SidebarSection,
  TopBarBrand,
  WikiContent,
  WikiSidebar,
} from "@uwe/shared-ui";
import {
  buildPageView,
  buildPageUrl,
  getAppRepository,
  navCategoryForPageType,
  NAV_CATEGORY_LABELS,
  type NavCategory,
} from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string; category: string; slug: string }>;
}

export default async function PortalPageView({ params }: Props) {
  const { worldSlug, category, slug } = await params;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const rawPage = await repo.getPublicPageForPortal(worldSlug, slug);
  if (!rawPage) notFound();

  const expectedCategory = navCategoryForPageType(rawPage.type);
  if (expectedCategory !== category) notFound();

  const view = await buildPageView(repo, worldSlug, slug, "portal");
  if (!view) notFound();

  const navPages = await repo.listPagesForContext(worldSlug, "portal");
  const navItems = navPages.map((page) => ({
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
            placeholder="Suchen…"
          />
        </>
      }
      sidebar={
        <>
          <SidebarSection title="Navigation">
            <Link href={`/worlds/${worldSlug}`} style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
              ← {world.name}
            </Link>
            <PortalNavByType worldSlug={worldSlug} items={navItems} activeCategory={category as NavCategory} />
          </SidebarSection>
        </>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Welten", href: "/worlds" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: NAV_CATEGORY_LABELS[category as NavCategory] },
              { label: view.page.title },
            ]}
          />
          <PageHeader
            title={view.page.title}
            meta={view.page.tags.map((tag) => (
              <span key={tag} className="uwe-tag">{tag}</span>
            ))}
          />
          <WikiContent html={view.html} />
        </>
      }
      context={
        <WikiSidebar
          backlinks={view.backlinks}
          relatedPages={view.relatedPages}
        />
      }
    />
  );
}
