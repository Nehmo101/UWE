import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EmptyState,
  PageTypeBadge,
  PublishBadge,
  PageListCards,
  SearchFilterBar,
  SearchResultsList,
  SidebarNav,
  SidebarSection,
  VisibilityBadge,
  VISIBILITY_LABELS,
} from "@uwe/shared-ui";
import {
  buildPageUrl,
  getAppRepository,
  NAV_CATEGORIES,
  NAV_CATEGORY_LABELS,
  SEARCH_ENTITY_FILTER_LABELS,
  SEARCH_ENTITY_FILTERS,
  type NavCategory,
  type SearchEntityFilter,
  type Visibility,
} from "@uwe/database/server";
import { WorldCampaignSidebar, WorldModuleShell } from "@/components/WorldModuleShell";
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

  const recentPages = [...pages]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
  const draftCount = pages.filter((page) => page.publishStatus === "draft").length;

  return (
    <WorldModuleShell
      worldSlug={worldSlug}
      worldName={world.name}
      activeNav="pages"
      campaignSlug={campaignSlug}
      searchQuery={q ?? ""}
      breadcrumb={worldRootBreadcrumb(world.name, worldSlug)}
      contextTitle="Welt-Kontext"
      pageHeader={{
        title: world.name,
        summary: world.description,
        actions: (
          <Link className="uwe-btn uwe-btn-primary" href={newPageHref}>
            Seite erstellen
          </Link>
        ),
      }}
      sidebarExtra={
        <WorldCampaignSidebar
          items={campaignNavItems(`/worlds/${worldSlug}`, campaigns, campaignSlug)}
        />
      }
      context={
        <>
          <SidebarSection title="Kontext">
            <p className="uwe-hint" style={{ margin: 0 }}>
              {pages.length} Seiten
              {selectedCampaign ? ` in „${selectedCampaign.name}"` : ""}
              {draftCount > 0 ? ` · ${draftCount} Entwürfe` : ""}
            </p>
          </SidebarSection>
          {recentPages.length > 0 && (
            <SidebarSection title="Zuletzt bearbeitet">
              <SidebarNav
                items={recentPages.map((page) => ({
                  label: page.title,
                  href: buildPageUrl(worldSlug, page.type, page.slug),
                }))}
              />
            </SidebarSection>
          )}
        </>
      }
    >
      <div className="uwe-filter-bar">
        <Link href={`/worlds/${worldSlug}${campaignSlug ? `?campaign=${campaignSlug}` : ""}`} className={!typeFilter ? "active" : undefined}>
          Alle Typen
        </Link>
        {NAV_CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={`/worlds/${worldSlug}?${new URLSearchParams({
              ...(campaignSlug ? { campaign: campaignSlug } : {}),
              type: cat,
            }).toString()}`}
            className={typeFilter === cat ? "active" : undefined}
          >
            {NAV_CATEGORY_LABELS[cat]}
          </Link>
        ))}
      </div>

      {isSearching ? (
        <>
          <SearchFilterBar
            action={`/worlds/${worldSlug}`}
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
          <SearchResultsList
            results={searchResults}
            query={q}
            showVisibility
            showLabelActions
          />
        </>
      ) : pages.length === 0 ? (
        <EmptyState
          title="Keine Seiten"
          description="Für diesen Filter gibt es noch keine Einträge. Erstelle eine neue Seite oder passe den Filter an."
          action={
            <Link className="uwe-btn uwe-btn-primary" href={newPageHref}>
              Seite erstellen
            </Link>
          }
        />
      ) : (
        <>
          <PageListCards
            items={pages.map((page) => ({
              id: page.id,
              title: page.title,
              href: buildPageUrl(worldSlug, page.type, page.slug),
              badges: (
                <>
                  <PageTypeBadge type={page.type} />
                  <VisibilityBadge visibility={page.visibility} />
                  <PublishBadge status={page.publishStatus} />
                </>
              ),
            }))}
          />
          <table className="uwe-page-table uwe-table-hidden-mobile">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Typ</th>
                <th>Sichtbarkeit</th>
                <th>Publish</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id}>
                  <td data-label="Titel">
                    <Link href={buildPageUrl(worldSlug, page.type, page.slug)}>
                      {page.title}
                    </Link>
                  </td>
                  <td data-label="Typ"><PageTypeBadge type={page.type} /></td>
                  <td data-label="Sichtbarkeit"><VisibilityBadge visibility={page.visibility} /></td>
                  <td data-label="Publish"><PublishBadge status={page.publishStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </WorldModuleShell>
  );
}
