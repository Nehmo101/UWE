import Link from "next/link";
import {
  GlobalSearchForm,
  SearchFilterBar,
  SearchResultsList,
  SidebarSection,
  VISIBILITY_LABELS,
  CANONICAL_LABELS,
} from "@uwe/shared-ui";
import {
  ENTITY_TAG_ENTITY_TYPE_LABELS,
  ADMIN_SEARCH_ENTITY_LABELS,
  ADMIN_SEARCH_ENTITY_TYPES,
  CANONICAL_LIFECYCLE_FILTER_STATUSES,
  getAppRepository,
  isCanonicalLifecycleFilterStatus,
  prisma,
  QUEST_LIFECYCLE_LABELS,
  SEARCH_ENTITY_FILTER_LABELS,
  SEARCH_ENTITY_FILTERS,
  searchStudioCrossDomain,
  type AdminSearchEntityType,
  type QuestLifecycleStatus,
  type SearchEntityFilter,
  type Visibility,
  type CanonicalStatus,
} from "@uwe/database/server";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";

type SearchScope = "admin" | "worlds" | "all";

interface Props {
  searchParams: Promise<{
    q?: string;
    scope?: string;
    world?: string;
    type?: string;
    entityType?: string;
    visibility?: string;
    campaign?: string;
    canon?: string;
    quest?: string;
  }>;
}

function resolveScope(raw: string | undefined): SearchScope {
  if (raw === "admin" || raw === "worlds") {
    return raw;
  }
  return "all";
}

export default async function StudioSearchPage({ searchParams }: Props) {
  const {
    q,
    scope: scopeParam,
    world: worldSlug,
    type: entityFilter,
    entityType: adminEntityType,
    visibility,
    campaign: campaignSlug,
    canon: canonFilter,
    quest: questParam,
  } = await searchParams;
  const scope = resolveScope(scopeParam);
  const questStatusFilter =
    entityFilter === "quests" && questParam && questParam in QUEST_LIFECYCLE_LABELS
      ? (questParam as QuestLifecycleStatus)
      : undefined;
  const canonicalStatus = isCanonicalLifecycleFilterStatus(canonFilter)
    ? (canonFilter as CanonicalStatus)
    : undefined;
  const canonFilterOptions = [
    { value: "", label: "Alle Kanon-Status" },
    ...CANONICAL_LIFECYCLE_FILTER_STATUSES.map((status) => ({
      value: status,
      label: CANONICAL_LABELS[status],
    })),
  ];

  const repo = getAppRepository();
  const [worlds, campaigns] = await Promise.all([
    repo.listWorlds(),
    worldSlug ? repo.listCampaignsByWorld(worldSlug) : Promise.resolve([]),
  ]);

  const selectedCampaign = campaignSlug
    ? campaigns.find((entry) => entry.slug === campaignSlug)
    : null;

  const trimmedQuery = q?.trim() ?? "";

  const { wiki: results, admin: adminResults, media: mediaResults, tags: tagResults } = trimmedQuery
    ? await searchStudioCrossDomain(prisma, {
        query: trimmedQuery,
        scope,
        wiki: {
          worldSlug: worldSlug || undefined,
          campaignId: selectedCampaign?.id,
          entityFilter: entityFilter as SearchEntityFilter | undefined,
          visibilityFilter: visibility ? [visibility as Visibility] : undefined,
          canonicalStatusFilter: canonicalStatus,
          questStatusFilter,
          urlMode: "studio",
          limit: 100,
        },
        admin: {
          entityType: adminEntityType as AdminSearchEntityType | undefined,
          limit: 50,
        },
      })
    : { wiki: [], admin: [], media: [], tags: [] };

  const hasWikiResults = results.length > 0;
  const hasAdminResults = adminResults.length > 0;
  const hasMediaResults = mediaResults.length > 0;
  const hasTagResults = tagResults.length > 0;
  const hasAnyResults = hasWikiResults || hasAdminResults || hasMediaResults || hasTagResults;

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
            Persönliche Admin-Daten (Capture, Projekte, Verträge, …) erscheinen im Bereich
            „Studio-only“.
          </p>
          <p className="uwe-dashboard-muted" style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>
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
        summary="Durchsuche Wiki-Inhalte und persönliche Admin-Daten — Capture, Projekte, Verträge und mehr."
      />
      <GlobalSearchForm
        action="/search"
        query={q ?? ""}
        placeholder="Alles durchsuchen…"
        extraFields={<input type="hidden" name="scope" value={scope} />}
      />
      <SearchFilterBar
        action="/search"
        query={q}
        filters={[
          {
            name: "scope",
            label: "Bereich",
            value: scope === "all" ? "" : scope,
            options: [
              { value: "worlds", label: "Welten / Wiki" },
              { value: "admin", label: "Daily Admin OS" },
            ],
          },
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
          ...(scope === "admin"
            ? [
                {
                  name: "entityType",
                  label: "Admin-Typ",
                  value: adminEntityType,
                  options: ADMIN_SEARCH_ENTITY_TYPES.map((type) => ({
                    value: type,
                    label: ADMIN_SEARCH_ENTITY_LABELS[type],
                  })),
                },
              ]
            : [
                {
                  name: "type",
                  label: "Typ",
                  value: entityFilter,
                  options: SEARCH_ENTITY_FILTERS.map((filter) => ({
                    value: filter,
                    label: SEARCH_ENTITY_FILTER_LABELS[filter],
                  })),
                },
                ...(entityFilter === "quests"
                  ? [
                      {
                        name: "quest",
                        label: "Quest-Status",
                        value: questParam,
                        options: Object.entries(QUEST_LIFECYCLE_LABELS).map(
                          ([value, label]) => ({ value, label }),
                        ),
                      },
                    ]
                  : []),
                {
                  name: "visibility",
                  label: "Sichtbarkeit",
                  value: visibility,
                  options: Object.entries(VISIBILITY_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  })),
                },
                {
                  name: "canon",
                  label: "Kanon-Status",
                  value: canonFilter,
                  options: canonFilterOptions,
                },
              ]),
        ]}
      />

      {!trimmedQuery ? (
        <SearchResultsList results={[]} query={q} showWorld={!worldSlug} showVisibility showLabelActions />
      ) : !hasAnyResults ? (
        <p className="uwe-dashboard-muted">Keine Treffer für „{trimmedQuery}“.</p>
      ) : (
        <>
          {hasWikiResults && scope !== "admin" && (
            <SearchResultsList
              results={results}
              query={q}
              showWorld={!worldSlug}
              showVisibility
              showLabelActions
            />
          )}

          {hasMediaResults && scope !== "admin" && (
            <section className="uwe-v2-section">
              <h2 className="uwe-v2-section-title">Medien & Soundboard</h2>
              <p className="uwe-search-count">
                {mediaResults.length} Treffer für „{trimmedQuery}&ldquo;
              </p>
              <ul className="uwe-search-results">
                {mediaResults.map((item) => (
                  <li key={`${item.entityType}-${item.id}`} className="uwe-search-result">
                    <article>
                      <header className="uwe-search-result-header">
                        <h2>
                          <Link href={item.href}>{item.title}</Link>
                        </h2>
                        <div className="uwe-search-result-badges">
                          <span className="uwe-badge uwe-badge-muted">
                            {item.entityType === "asset" ? "Asset" : "Soundboard"}
                          </span>
                        </div>
                      </header>
                      <div className="uwe-search-result-meta">
                        <span>
                          {item.worldName} ({item.worldSlug})
                        </span>
                      </div>
                      {item.snippet && (
                        <p className="uwe-search-result-snippet">{item.snippet}</p>
                      )}
                    </article>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasTagResults && (
            <section className="uwe-v2-section">
              <h2 className="uwe-v2-section-title">Tag-Treffer</h2>
              <p className="uwe-search-count">
                {tagResults.length} Entitäten mit passenden Tags für „{trimmedQuery}&ldquo;
              </p>
              <ul className="uwe-search-results">
                {tagResults.map((item) => (
                  <li key={`tag-${item.entityType}-${item.id}`} className="uwe-search-result">
                    <article>
                      <header className="uwe-search-result-header">
                        <h2>
                          <Link href={item.href}>{item.title}</Link>
                        </h2>
                        <div className="uwe-search-result-badges">
                          <span className="uwe-badge uwe-badge-muted">
                            {ENTITY_TAG_ENTITY_TYPE_LABELS[item.entityType] ?? item.entityType}
                          </span>
                        </div>
                      </header>
                      <div className="uwe-search-result-meta">
                        <span>{item.group}</span>
                        {item.worldName && <span> · {item.worldName}</span>}
                      </div>
                      <p className="uwe-search-result-snippet">
                        Tags: {item.matchedTags.join(", ")}
                      </p>
                    </article>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasAdminResults && scope !== "worlds" && (
            <section className="uwe-v2-section">
              <h2 className="uwe-v2-section-title">
                Daily Admin OS{" "}
                <span className="uwe-badge uwe-badge-muted" style={{ fontSize: "0.75rem" }}>
                  Studio-only
                </span>
              </h2>
              <p className="uwe-search-count">
                {adminResults.length} Treffer für „{trimmedQuery}&ldquo;
              </p>
              <ul className="uwe-search-results">
                {adminResults.map((item) => (
                  <li key={`${item.entityType}-${item.id}`} className="uwe-search-result">
                    <article>
                      <header className="uwe-search-result-header">
                        <h2>
                          <Link href={item.href}>{item.title}</Link>
                        </h2>
                        <div className="uwe-search-result-badges">
                          <span className="uwe-badge uwe-badge-muted">
                            {ADMIN_SEARCH_ENTITY_LABELS[item.entityType]}
                          </span>
                        </div>
                      </header>
                      <div className="uwe-search-result-meta">
                        <span>{item.group}</span>
                      </div>
                      {item.snippet && (
                        <p className="uwe-search-result-snippet">{item.snippet}</p>
                      )}
                    </article>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </StudioShell>
  );
}
