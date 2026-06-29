import Link from "next/link";
import {
  GlobalSearchForm,
  SearchFilterBar,
  SearchResultsList,
  SidebarSection,
  VISIBILITY_LABELS,
} from "@uwe/shared-ui";
import {
  getAppRepository,
  SEARCH_ENTITY_FILTER_LABELS,
  SEARCH_ENTITY_FILTERS,
  type SearchEntityFilter,
  type Visibility,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";

interface Props {
  searchParams: Promise<{
    q?: string;
    world?: string;
    type?: string;
    visibility?: string;
    campaign?: string;
  }>;
}

export default async function StudioSearchPage({ searchParams }: Props) {
  const { q, world: worldSlug, type: entityFilter, visibility, campaign: campaignSlug } =
    await searchParams;

  const repo = getAppRepository();
  const [worlds, campaigns] = await Promise.all([
    repo.listWorlds(),
    worldSlug ? repo.listCampaignsByWorld(worldSlug) : Promise.resolve([]),
  ]);

  const selectedCampaign = campaignSlug
    ? campaigns.find((entry) => entry.slug === campaignSlug)
    : null;

  const results = q?.trim()
    ? await repo.search("dm", {
        query: q,
        worldSlug: worldSlug || undefined,
        campaignId: selectedCampaign?.id,
        entityFilter: entityFilter as SearchEntityFilter | undefined,
        visibilityFilter: visibility ? [visibility as Visibility] : undefined,
        urlMode: "studio",
        limit: 100,
      })
    : [];

  return (
    <StudioShell
      breadcrumb={<BreadcrumbTrail items={[{ label: "Globale Suche" }]} />}
      contextPanel={
        <SidebarSection title="Suchbereiche">
          <ul className="uwe-dashboard-muted" style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.8rem" }}>
            {SEARCH_ENTITY_FILTERS.map((filter) => (
              <li key={filter} style={{ marginBottom: "0.35rem" }}>
                {SEARCH_ENTITY_FILTER_LABELS[filter]}
              </li>
            ))}
          </ul>
          <p className="uwe-dashboard-muted" style={{ fontSize: "0.75rem", marginTop: "1rem" }}>
            Als DM siehst du alle Inhalte inkl. Entwürfe und GM-only Seiten.
          </p>
          {!worldSlug && (
            <Link href="/search" className="uwe-dashboard-list" style={{ fontSize: "0.8rem" }}>
              Weltfilter zurücksetzen
            </Link>
          )}
        </SidebarSection>
      }
    >
      <PageHeader
        title="Globale Suche"
        summary="Durchsuche Seiten, Inhaltsblöcke, NPCs, Orte, Tags und Aliase über alle Welten."
      />
      <GlobalSearchForm action="/search" query={q ?? ""} placeholder="Alles durchsuchen…" />
      <SearchFilterBar
        action="/search"
        query={q}
        filters={[
          {
            name: "world",
            label: "Welt",
            value: worldSlug,
            options: worlds.map((world) => ({ value: world.slug, label: world.name })),
          },
          ...(worldSlug
            ? [
                {
                  name: "campaign",
                  label: "Kampagne",
                  value: campaignSlug,
                  options: campaigns.map((entry) => ({
                    value: entry.slug,
                    label: entry.name,
                  })),
                },
              ]
            : []),
          {
            name: "type",
            label: "Typ",
            value: entityFilter,
            options: SEARCH_ENTITY_FILTERS.map((filter) => ({
              value: filter,
              label: SEARCH_ENTITY_FILTER_LABELS[filter],
            })),
          },
          {
            name: "visibility",
            label: "Sichtbarkeit",
            value: visibility,
            options: Object.entries(VISIBILITY_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          },
        ]}
      />

      <SearchResultsList
        results={results}
        query={q}
        showWorld={!worldSlug}
        showVisibility
        showLabelActions
      />
    </StudioShell>
  );
}
