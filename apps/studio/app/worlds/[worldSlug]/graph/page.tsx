import Link from "next/link";
import { notFound } from "next/navigation";
import { GraphRelationList, GraphView } from "@uwe/shared-ui";
import {
  buildWorldGraph,
  getAppRepository,
  GRAPH_NODE_CATEGORIES,
  GRAPH_NODE_CATEGORY_LABELS,
  type GraphNodeCategory,
  type GraphViewMode,
} from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import {
  CampaignSidebar,
  ConnectionMatrix,
} from "@/src/components/wiki";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{
    campaign?: string;
    category?: string | string[];
    tag?: string;
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

function parseMode(value: string | undefined, focusPageId?: string): GraphViewMode {
  if (value === "focus" || value === "neighbors" || value === "backlinks" || value === "full") {
    return value;
  }
  return focusPageId ? "focus" : "neighbors";
}

export default async function StudioGraphPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const query = await searchParams;
  const isPlayerPreview = query.preview === "player";
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const selectedCampaign = query.campaign
    ? campaigns.find((campaign) => campaign.slug === query.campaign)
    : null;

  const categories = parseCategories(query.category);
  const tags = query.tag?.trim() ? [query.tag.trim()] : undefined;
  const mode = parseMode(query.mode, query.focusPageId);

  const graph = await buildWorldGraph(repo, worldSlug, {
    campaignId: selectedCampaign?.id,
    categories,
    tags,
    focusPageId: query.focusPageId,
    mode,
  });

  const focusOptions = await repo.listPagesByWorld(worldSlug, {
    campaignId: selectedCampaign?.id,
  });

  const allTags = [...new Set(graph.nodes.flatMap((node) => node.tags))].sort((a, b) =>
    a.localeCompare(b, "de"),
  );

  const nodeTitles = Object.fromEntries(graph.nodes.map((node) => [node.id, node.title]));
  const nodeHrefs = Object.fromEntries(graph.nodes.map((node) => [node.id, node.href]));
  const previewSuffix = isPlayerPreview ? "?preview=player" : "";
  const graphBase = `/worlds/${worldSlug}/graph`;

  return (
    <>
      {isPlayerPreview && (
        <div className="border-b border-border bg-[color-mix(in_srgb,var(--uwe-warning)_15%,transparent)] px-4 py-2 text-center text-sm font-medium" role="status">
          Spieler-Vorschau — DM-only Inhalte sind ausgeblendet
        </div>
      )}
      <WorldShell
        worldSlug={worldSlug}
        worldName={world.name}
        breadcrumb={
          <BreadcrumbTrail
            items={worldSectionBreadcrumb(world.name, worldSlug, "Wissensgraph", graphBase)}
          />
        }
        contextPanel={
          <GraphRelationList
            edges={graph.edges}
            focusPageId={graph.focusPageId}
            nodeTitles={nodeTitles}
          />
        }
      >
        <PageHeader
          title="Link-Graph"
          summary={
            graph.truncated
              ? `Seiten als Knoten — ${graph.nodes.length} von ${graph.totalNodeCount ?? graph.nodes.length} angezeigt (Performance-Limit). Nutze Fokus/Filter oder Nachbarn-Modus.`
              : "Seiten als Knoten, Wikilinks und Relationen als Kanten."
          }
          actions={
            !isPlayerPreview ? (
              <Link
                className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm hover:bg-muted"
                href={`${graphBase}?preview=player`}
              >
                Vorschau als Spieler
              </Link>
            ) : (
              <Link
                className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm hover:bg-muted"
                href={graphBase}
              >
                Zurück zur DM-Ansicht
              </Link>
            )
          }
        />

        <CampaignSidebar
          className="mb-4"
          items={[
            { label: "Alle Kampagnen", href: `${graphBase}${previewSuffix}`, active: !query.campaign },
            ...campaigns.map((campaign) => ({
              label: campaign.name,
              href: `${graphBase}?campaign=${campaign.slug}${isPlayerPreview ? "&preview=player" : ""}`,
              active: query.campaign === campaign.slug,
            })),
          ]}
        />

        <form method="get" className="mb-4 flex flex-wrap gap-3 text-sm">
          {isPlayerPreview && <input type="hidden" name="preview" value="player" />}
          {query.campaign && <input type="hidden" name="campaign" value={query.campaign} />}

          <label className="flex flex-col gap-1">
            Typ
            <select name="category" defaultValue={categories?.[0] ?? ""} className="rounded-md border border-border px-2 py-1">
              <option value="">Alle Typen</option>
              {GRAPH_NODE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {GRAPH_NODE_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            Tag
            <select name="tag" defaultValue={query.tag ?? ""} className="rounded-md border border-border px-2 py-1">
              <option value="">Alle Tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>


          <label className="flex flex-col gap-1">
            Modus
            <select name="mode" defaultValue={mode} className="rounded-md border border-border px-2 py-1">
              <option value="full">Gesamter Graph</option>
              <option value="focus">Nur Fokus-Seite</option>
              <option value="neighbors">Nachbarn</option>
              <option value="backlinks">Backlinks</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            Fokus-Seite
            <select name="focusPageId" defaultValue={query.focusPageId ?? ""} className="rounded-md border border-border px-2 py-1">
              <option value="">Kein Fokus</option>
              {focusOptions.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="self-end rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground"
          >
            Filter anwenden
          </button>
        </form>

        <div className="mb-6">
          <GraphView nodes={graph.nodes} edges={graph.edges} height={600} />
        </div>
        <ConnectionMatrix
          edges={graph.edges}
          nodeTitles={nodeTitles}
          nodeHrefs={nodeHrefs}
          className="mb-4"
        />

        <p className="text-sm text-muted-foreground">
          {graph.nodes.length} Knoten · {graph.edges.length} Kanten
        </p>
      </WorldShell>
    </>
  );
}
