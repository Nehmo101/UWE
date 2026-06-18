import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  GraphRelationList,
  GraphView,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
  VISIBILITY_LABELS,
} from "@uwe/shared-ui";
import {
  buildWorldGraph,
  getAppRepository,
  GRAPH_NODE_CATEGORIES,
  GRAPH_NODE_CATEGORY_LABELS,
  type GraphNodeCategory,
  type GraphViewMode,
  type Visibility,
} from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{
    campaign?: string;
    category?: string | string[];
    tag?: string;
    visibility?: string | string[];
    focusPageId?: string;
    mode?: string;
    preview?: string;
  }>;
}

function parseCategories(value: string | string[] | undefined): GraphNodeCategory[] | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value : value.split(",");
  const categories = raw.filter((item): item is GraphNodeCategory =>
    GRAPH_NODE_CATEGORIES.includes(item as GraphNodeCategory),
  );
  return categories.length ? categories : undefined;
}

function parseVisibilities(
  value: string | string[] | undefined,
): Visibility[] | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value : value.split(",");
  const visibilities = raw.filter((item): item is Visibility =>
    Object.keys(VISIBILITY_LABELS).includes(item),
  );
  return visibilities.length ? visibilities : undefined;
}

function parseMode(value: string | undefined): GraphViewMode {
  if (value === "focus" || value === "neighbors" || value === "backlinks" || value === "full") {
    return value;
  }
  return "full";
}

export default async function StudioGraphPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const query = await searchParams;
  const isPlayerPreview = query.preview === "player";
  const context = isPlayerPreview ? "preview" : "dm";
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const selectedCampaign = query.campaign
    ? campaigns.find((campaign) => campaign.slug === query.campaign)
    : null;

  const categories = parseCategories(query.category);
  const visibilities = parseVisibilities(query.visibility);
  const tags = query.tag?.trim() ? [query.tag.trim()] : undefined;
  const mode = parseMode(query.mode);

  const graph = await buildWorldGraph(repo, worldSlug, context, {
    campaignId: selectedCampaign?.id,
    categories,
    tags,
    visibilities,
    focusPageId: query.focusPageId,
    mode: query.focusPageId ? mode : "full",
  });

  const focusOptions = await repo.listPagesByWorld(worldSlug, {
    campaignId: selectedCampaign?.id,
  });

  const allTags = [
    ...new Set(graph.nodes.flatMap((node) => node.tags)),
  ].sort((a, b) => a.localeCompare(b, "de"));

  const nodeTitles = Object.fromEntries(graph.nodes.map((node) => [node.id, node.title]));
  const previewSuffix = isPlayerPreview ? "?preview=player" : "";

  return (
    <>
      {isPlayerPreview && (
        <div className="uwe-preview-banner">
          Spieler-Vorschau — DM-only Inhalte sind ausgeblendet
        </div>
      )}
      <AppShell
        topBar={
          <>
            <TopBarBrand appName="UWE Studio" subtitle={world.name} href="/studio" />
            {!isPlayerPreview ? (
              <Link
                className="uwe-btn uwe-btn-ghost"
                href={`/worlds/${worldSlug}/graph?preview=player`}
              >
                Vorschau als Spieler
              </Link>
            ) : (
              <Link className="uwe-btn uwe-btn-ghost" href={`/worlds/${worldSlug}/graph`}>
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
                  { label: "Graph", href: `/worlds/${worldSlug}/graph`, active: true },
                ]}
              />
            </SidebarSection>
            <SidebarSection title="Kampagnen">
              <SidebarNav
                items={[
                  {
                    label: "Alle",
                    href: `/worlds/${worldSlug}/graph${previewSuffix}`,
                    active: !query.campaign,
                  },
                  ...campaigns.map((campaign) => ({
                    label: campaign.name,
                    href: `/worlds/${worldSlug}/graph?campaign=${campaign.slug}${isPlayerPreview ? "&preview=player" : ""}`,
                    active: query.campaign === campaign.slug,
                  })),
                ]}
              />
            </SidebarSection>
          </>
        }
        main={
          <>
            <Breadcrumb
              items={[
                { label: "Dashboard", href: "/studio" },
                { label: world.name, href: `/worlds/${worldSlug}` },
                { label: "Graph" },
              ]}
            />
            <PageHeader
              title="Link-Graph"
              summary="Seiten als Knoten, Wikilinks und Relationen als Kanten."
            />

            <form method="get" className="uwe-graph-filters">
              {isPlayerPreview && <input type="hidden" name="preview" value="player" />}
              {query.campaign && <input type="hidden" name="campaign" value={query.campaign} />}

              <label>
                Typ
                <select name="category" defaultValue={categories?.[0] ?? ""}>
                  <option value="">Alle Typen</option>
                  {GRAPH_NODE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {GRAPH_NODE_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Tag
                <select name="tag" defaultValue={query.tag ?? ""}>
                  <option value="">Alle Tags</option>
                  {allTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Sichtbarkeit
                <select name="visibility" defaultValue={visibilities?.[0] ?? ""}>
                  <option value="">Alle</option>
                  {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Modus
                <select name="mode" defaultValue={mode}>
                  <option value="full">Gesamter Graph</option>
                  <option value="focus">Nur Fokus-Seite</option>
                  <option value="neighbors">Nachbarn</option>
                  <option value="backlinks">Backlinks</option>
                </select>
              </label>

              <label>
                Fokus-Seite
                <select name="focusPageId" defaultValue={query.focusPageId ?? ""}>
                  <option value="">Kein Fokus</option>
                  {focusOptions.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.title}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit" className="uwe-btn uwe-btn-primary">
                Filter anwenden
              </button>
            </form>

            <GraphView nodes={graph.nodes} edges={graph.edges} />

            <p className="uwe-empty" style={{ marginTop: "1rem" }}>
              {graph.nodes.length} Knoten · {graph.edges.length} Kanten
            </p>
          </>
        }
        context={
          <SidebarSection title="Relationen">
            <GraphRelationList
              edges={graph.edges}
              focusPageId={graph.focusPageId}
              nodeTitles={nodeTitles}
            />
          </SidebarSection>
        }
      />
    </>
  );
}
