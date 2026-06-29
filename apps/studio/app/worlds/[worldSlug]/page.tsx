import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EmptyState,
  SearchFilterBar,
  SearchResultsList,
  VISIBILITY_LABELS,
} from "@uwe/shared-ui";
import {
  buildPageUrl,
  getAppRepository,
  NAV_CATEGORIES,
  NAV_CATEGORY_LABELS,
  parseStringArray,
  SEARCH_ENTITY_FILTER_LABELS,
  SEARCH_ENTITY_FILTERS,
  type NavCategory,
  type SearchEntityFilter,
  type Visibility,
} from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import { CampaignSidebar, WikiPageTable, type WikiPageRow } from "@/src/components/wiki";
import { campaignNavItems } from "@/src/lib/world-nav";
import { worldRootBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{
    campaign?: string;
    type?: string;
    q?: string;
    filter?: string;
    visibility?: string;
  }>;
}

export default async function StudioWorldPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const {
    campaign: campaignSlug,
    type: typeFilter,
    q,
    filter: entityFilter,
    visibility,
  } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const selectedCampaign = campaignSlug
    ? campaigns.find((c) => c.slug === campaignSlug)
    : null;

  const pages = await repo.listPagesByWorld(worldSlug, {
    campaignId: selectedCampaign?.id,
    navCategory: typeFilter as NavCategory | undefined,
  });

  const searchResults = q?.trim()
    ? await repo.search("dm", {
        query: q,
        worldSlug,
        campaignId: selectedCampaign?.id,
        entityFilter: entityFilter as SearchEntityFilter | undefined,
        visibilityFilter: visibility ? [visibility as Visibility] : undefined,
        urlMode: "studio",
      })
    : [];

  const isSearching = Boolean(q?.trim());
  const newPageHref = `/worlds/${worldSlug}/pages/new${campaignSlug ? `?campaign=${campaignSlug}` : ""}`;
  const worldBase = `/worlds/${worldSlug}`;

  const tableRows: WikiPageRow[] = pages.map((page) => ({
    id: page.id,
    title: page.title,
    href: buildPageUrl(worldSlug, page.type, page.slug),
    type: page.type,
    visibility: page.visibility,
    publishStatus: page.publishStatus,
    tags: parseStringArray(page.tags),
    updatedAt: page.updatedAt.toISOString(),
  }));

  const campaignItems = campaignNavItems(worldBase, campaigns, campaignSlug);

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={<BreadcrumbTrail items={worldRootBreadcrumb(world.name, worldSlug)} />}
      contextPanel={
        <CampaignSidebar
          items={[
            { label: "Alle Kampagnen", href: worldBase, active: !campaignSlug },
            ...campaignItems.map((item) => ({
              label: item.label,
              href: item.href,
              active: item.active,
            })),
          ]}
        />
      }
    >
      <PageHeader
        title={world.name}
        summary={world.description}
        actions={
          <Link
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            href={newPageHref}
          >
            Seite erstellen
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link
          href={`${worldBase}${campaignSlug ? `?campaign=${campaignSlug}` : ""}`}
          className={`rounded-md px-3 py-1.5 ${!typeFilter ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
        >
          Alle Typen
        </Link>
        {NAV_CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={`${worldBase}?${new URLSearchParams({
              ...(campaignSlug ? { campaign: campaignSlug } : {}),
              type: cat,
            }).toString()}`}
            className={`rounded-md px-3 py-1.5 ${typeFilter === cat ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            {NAV_CATEGORY_LABELS[cat]}
          </Link>
        ))}
      </div>

      {isSearching ? (
        <>
          <SearchFilterBar
            action={worldBase}
            query={q}
            hiddenFields={campaignSlug ? { campaign: campaignSlug } : undefined}
            filters={[
              {
                name: "filter",
                label: "Suchbereich",
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
          <SearchResultsList results={searchResults} query={q} showVisibility showLabelActions />
        </>
      ) : pages.length === 0 ? (
        <EmptyState
          title="Keine Seiten"
          description="Für diesen Filter gibt es noch keine Einträge. Erstelle eine neue Seite oder passe den Filter an."
          action={
            <Link
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              href={newPageHref}
            >
              Seite erstellen
            </Link>
          }
        />
      ) : (
        <WikiPageTable rows={tableRows} />
      )}
    </WorldShell>
  );
}
