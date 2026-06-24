import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalPublicShell } from "@/src/components/PortalPublicShell";
import { portalWorldBottomNav } from "@/src/lib/mobile-nav";
import {
  GlobalSearchForm,
  PageHeaderV2,
  PortalNavByType,
  PortalNavSidebar,
  WikiContent,
} from "@uwe/shared-ui";
import {
  buildPageUrl,
  createAuthService,
  createPrismaClient,
  navCategoryForPageType,
  NAV_CATEGORY_LABELS,
  parseStringArray,
  type NavCategory,
} from "@uwe/database/server";
import { assertWorldReadable } from "@/src/lib/auth";

interface Props {
  params: Promise<{ worldSlug: string; category: string; slug: string }>;
}

export default async function PortalPageView({ params }: Props) {
  const { worldSlug, category, slug } = await params;

  let world;
  let ctx;
  try {
    ({ world, ctx } = await assertWorldReadable(worldSlug));
  } catch {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);

  let page;
  let navPages;
  let blockHtml: string[] = [];

  try {
    page = await auth.getPageForViewer(worldSlug, slug, ctx);
    if (!page) {
      notFound();
    }

    const expectedCategory = navCategoryForPageType(page.type);
    if (expectedCategory !== category) {
      notFound();
    }

    blockHtml = await Promise.all(
      page.contentBlocks.map((block) =>
        auth.renderBlockContentForViewer(worldSlug, block.content, ctx),
      ),
    );

    navPages = await auth.listPagesForViewer(worldSlug, ctx);
  } finally {
    await db.$disconnect();
  }

  const navItems = navPages.map((entry) => ({
    title: entry.title,
    href: buildPageUrl(worldSlug, entry.type, entry.slug),
    navCategory: navCategoryForPageType(entry.type),
  }));

  return (
    <PortalPublicShell
      worldName={world.name}
      worldSlug={worldSlug}
      bottomNav={portalWorldBottomNav(worldSlug, "home")}
      topBarExtra={
        <GlobalSearchForm
          action={`/worlds/${worldSlug}`}
          query=""
          placeholder="In dieser Welt suchen…"
        />
      }
      breadcrumbs={[
        { label: "Welten", href: "/worlds" },
        { label: world.name, href: `/worlds/${worldSlug}` },
        { label: NAV_CATEGORY_LABELS[category as NavCategory] },
        { label: page.title },
      ]}
      sidebar={
        <PortalNavSidebar>
          <Link href={`/worlds/${worldSlug}`} className="uwe-sidebar-back-link">
            ← {world.name}
          </Link>
          <PortalNavByType
            worldSlug={worldSlug}
            items={navItems}
            activeCategory={category as NavCategory}
          />
        </PortalNavSidebar>
      }
    >
      <PageHeaderV2
        title={page.title}
        meta={parseStringArray(page.tags).map((tag) => (
          <span key={tag} className="uwe-tag">
            {tag}
          </span>
        ))}
      />
      <div className="uwe-v2-reader">
      {page.contentBlocks.map((block, index) => (
        <WikiContent key={block.id} html={blockHtml[index] ?? ""} />
      ))}
      </div>
    </PortalPublicShell>
  );
}
