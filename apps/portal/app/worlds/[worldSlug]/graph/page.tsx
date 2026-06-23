import Link from "next/link";
import { notFound } from "next/navigation";
import {
  GraphView,
  PortalNavByType,
  PortalNavSidebar,
  SearchField,
} from "@uwe/shared-ui";
import {
  buildPageUrl,
  buildWorldGraph,
  getAppRepository,
  navCategoryForPageType,
} from "@uwe/database/server";
import { portalWorldBottomNav } from "@/src/lib/mobile-nav";
import { PortalGuestShell } from "@/src/components/PortalGuestShell";

interface Props {
  params: Promise<{ worldSlug: string }>;
}

export default async function PortalGraphPage({ params }: Props) {
  const { worldSlug } = await params;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const graph = await buildWorldGraph(repo, worldSlug, "portal");

  const navPages = await repo.listPagesForContext(worldSlug, "portal");
  const navItems = navPages.map((page) => ({
    title: page.title,
    href: buildPageUrl(worldSlug, page.type, page.slug),
    navCategory: navCategoryForPageType(page.type),
  }));

  return (
    <PortalGuestShell
      worldName={world.name}
      brandHref="/worlds"
      bottomNav={portalWorldBottomNav(worldSlug, "graph")}
      breadcrumbs={[
        { label: "Welten", href: "/worlds" },
        { label: world.name, href: `/worlds/${worldSlug}` },
        { label: "Graph" },
      ]}
      pageHeader={{
        title: "Link-Graph",
        summary: "Nur freigegebene Seiten und Relationen.",
      }}
      topBarExtra={
        <SearchField action={`/worlds/${worldSlug}`} placeholder="Suchen…" />
      }
      sidebar={
        <PortalNavSidebar>
          <Link href={`/worlds/${worldSlug}`} className="uwe-sidebar-back-link">
            ← {world.name}
          </Link>
          <PortalNavByType worldSlug={worldSlug} items={navItems} />
          <Link href={`/worlds/${worldSlug}/graph`} className="uwe-card-link">
            Link-Graph
          </Link>
        </PortalNavSidebar>
      }
    >
      <GraphView nodes={graph.nodes} edges={graph.edges} />
      <p className="uwe-empty" style={{ marginTop: "1rem" }}>
        {graph.nodes.length} Knoten · {graph.edges.length} Kanten
      </p>
    </PortalGuestShell>
  );
}
