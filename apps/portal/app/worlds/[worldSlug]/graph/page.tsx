import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  GraphView,
  PageHeader,
  PortalNavByType,
  SearchField,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  buildPageUrl,
  buildWorldGraph,
  getAppRepository,
  navCategoryForPageType,
} from "@uwe/database/server";

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
    <AppShell
      topBar={
        <>
          <TopBarBrand appName="UWE Portal" subtitle={world.name} href="/" />
          <SearchField action={`/worlds/${worldSlug}`} placeholder="Suchen…" />
        </>
      }
      sidebar={
        <>
          <SidebarSection title="Navigation">
            <Link href={`/worlds/${worldSlug}`} style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
              ← {world.name}
            </Link>
            <PortalNavByType worldSlug={worldSlug} items={navItems} />
            <Link href={`/worlds/${worldSlug}/graph`} style={{ color: "#818cf8", fontSize: "0.875rem" }}>
              Link-Graph
            </Link>
          </SidebarSection>
        </>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Welten", href: "/worlds" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: "Graph" },
            ]}
          />
          <PageHeader
            title="Link-Graph"
            summary="Nur freigegebene Seiten und Relationen."
          />
          <GraphView nodes={graph.nodes} edges={graph.edges} />
          <p className="uwe-empty" style={{ marginTop: "1rem" }}>
            {graph.nodes.length} Knoten · {graph.edges.length} Kanten
          </p>
        </>
      }
    />
  );
}
