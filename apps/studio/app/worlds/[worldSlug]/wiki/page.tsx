import Link from "next/link";
import { badgeVariants } from "@/src/components/ui/badge";
import { notFound } from "next/navigation";
import {
  EmptyState,
  SearchFilterBar,
  SearchResultsList,
  CANONICAL_LABELS,
} from "@uwe/shared-ui";
import {
  buildPageUrl,
  CANONICAL_LIFECYCLE_FILTER_STATUSES,
  getAppRepository,
  isCanonicalLifecycleFilterStatus,
  NAV_CATEGORIES,
  NAV_CATEGORY_LABELS,
  parseStringArray,
  SEARCH_ENTITY_FILTER_LABELS,
  SEARCH_ENTITY_FILTERS,
  type NavCategory,
  type SearchEntityFilter,
  type CanonicalStatus,
} from "@uwe/database/server";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
import {
  CampaignSidebar,
  WikiPageTable,
  type WikiPageRow,
} from "@/src/components/wiki";
import { campaignNavItems } from "@/src/lib/world-nav";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { worldWikiPath } from "@/src/lib/world-last-route";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{
    campaign?: string;
    type?: string;
    q?: string;
    filter?: string;
    canon?: string;
  }>;
}

export default async function StudioWorldWikiPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const {
    campaign: campaignSlug,
    type: typeFilter,
    q,
    filter: entityFilter,
    canon: canonFilter,
  } = await searchParams;
  const repo = getAppRepository();

  const canonicalStatus = isCanonicalLifecycleFilterStatus(canonFilter)
    ? (canonFilter as CanonicalStatus)
    : undefined;

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const selectedCampaign = campaignSlug
    ? campaigns.find((c) => c.slug === campaignSlug)
    : null;

  const pages = await repo.listPagesByWorld(worldSlug, {
    campaignId: selectedCampaign?.id,
    navCategory: typeFilter as NavCategory | undefined,
    canonicalStatus,
  });


  const searchResults = q?.trim()
    ? await repo.search({
        query: q,
        worldSlug,
        campaignId: selectedCampaign?.id,
        entityFilter: entityFilter as SearchEntityFilter | undefined,
        canonicalStatusFilter: canonicalStatus,
        urlMode: "studio",
      })
    : [];

  const isSearching = Boolean(q?.trim());
  const newPageHref = `/worlds/${worldSlug}/pages/new${campaignSlug ? `?campaign=${campaignSlug}` : ""}`;
  const wikiBase = worldWikiPath(worldSlug);
  const filterHiddenFields = {
    ...(campaignSlug ? { campaign: campaignSlug } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(q?.trim() ? { q: q.trim() } : {}),
  };
  const canonFilterOptions = [
    { value: "", label: "Alle Kanon-Status" },
    ...CANONICAL_LIFECYCLE_FILTER_STATUSES.map((status) => ({
      value: status,
      label: CANONICAL_LABELS[status],
    })),
  ];

  const tableRows: WikiPageRow[] = pages.map((page) => ({
    id: page.id,
    title: page.title,
    href: buildPageUrl(worldSlug, page.type, page.slug),
    type: page.type,
    canonicalStatus: page.canonicalStatus,
    questStatus: page.questStatus ?? null,
    tags: parseStringArray(page.tags),
    updatedAt: page.updatedAt.toISOString(),
    aiReviewedAt: page.aiReviewedAt?.toISOString() ?? null,
  }));

  const campaignItems = campaignNavItems(wikiBase, campaigns, campaignSlug);

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldSectionBreadcrumb(world.name, worldSlug, "Wiki / Seiten", wikiBase)}
        />
      }
      contextPanel={
        <CampaignSidebar
          items={[
            { label: "Alle Kampagnen", href: wikiBase, active: !campaignSlug },
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
        title="Wiki / Seiten"
        summary={world.description ?? "Alle Wiki-Seiten dieser Welt — filtern, suchen und verwalten."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              href={newPageHref}
            >
              Seite erstellen
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href={`${wikiBase}${campaignSlug ? `?campaign=${campaignSlug}` : ""}`}
          className={badgeVariants({ variant: !typeFilter ? "accent" : "default" })}
        >
          Alle Typen
        </Link>
        {NAV_CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={`${wikiBase}?${new URLSearchParams({
              ...(campaignSlug ? { campaign: campaignSlug } : {}),
              type: cat,
            }).toString()}`}
            className={badgeVariants({ variant: typeFilter === cat ? "accent" : "default" })}
          >
            {NAV_CATEGORY_LABELS[cat]}
          </Link>
        ))}
      </div>

      <SearchFilterBar
        action={wikiBase}
        query={q}
        hiddenFields={filterHiddenFields}
        filters={[
          {
            name: "canon",
            label: "Kanon-Status",
            value: canonFilter,
            options: canonFilterOptions,
          },
        ]}
      />

      {isSearching ? (
        <>
          <SearchFilterBar
            action={wikiBase}
            query={q}
            hiddenFields={filterHiddenFields}
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
                name: "canon",
                label: "Kanon-Status",
                value: canonFilter,
                options: canonFilterOptions,
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
        <WikiPageTable
          rows={tableRows}
          worldSlug={worldSlug}
          campaigns={campaigns.map((campaign) => ({ id: campaign.id, name: campaign.name }))}
        />
      )}
    </WorldShell>
  );
}
