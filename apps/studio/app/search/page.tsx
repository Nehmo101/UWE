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
import { brainPrisma } from "@uwe/database/brain-client";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { Badge, Card, CardContent } from "@/src/components/ui";

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
    ? await searchStudioCrossDomain(prisma, brainPrisma, {
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
          <ul className="m-0 list-none p-0 text-[0.8rem] text-muted-foreground">
            {SEARCH_ENTITY_FILTERS.map((filter) => (
              <li key={filter} className="mb-[0.35rem]">
                {SEARCH_ENTITY_FILTER_LABELS[filter]}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Persönliche Admin-Daten (Capture, Projekte, Verträge, …) erscheinen im Bereich
            „Studio-only“.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Als DM siehst du alle Inhalte inkl. Entwürfe und GM-only Seiten.
          </p>
          {!worldSlug && (
            <Link
              href="/search"
              className="mt-2 inline-block text-[0.8rem] text-muted-foreground hover:text-foreground hover:underline"
            >
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
        <p className="text-sm text-muted-foreground">Keine Treffer für „{trimmedQuery}“.</p>
      ) : (
        <div className="flex flex-col gap-6">
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
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Medien & Soundboard</h2>
              <p className="text-sm text-muted-foreground">
                {mediaResults.length} Treffer für „{trimmedQuery}&ldquo;
              </p>
              <ul className="grid gap-2">
                {mediaResults.map((item) => (
                  <li key={`${item.entityType}-${item.id}`}>
                    <Card>
                      <CardContent className="flex flex-col gap-2 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h3 className="text-base font-semibold">
                            <Link href={item.href}>{item.title}</Link>
                          </h3>
                          <Badge>{item.entityType === "asset" ? "Asset" : "Soundboard"}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <span>
                            {item.worldName} ({item.worldSlug})
                          </span>
                        </div>
                        {item.snippet && <p className="text-sm">{item.snippet}</p>}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasTagResults && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Tag-Treffer</h2>
              <p className="text-sm text-muted-foreground">
                {tagResults.length} Entitäten mit passenden Tags für „{trimmedQuery}&ldquo;
              </p>
              <ul className="grid gap-2">
                {tagResults.map((item) => (
                  <li key={`tag-${item.entityType}-${item.id}`}>
                    <Card>
                      <CardContent className="flex flex-col gap-2 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h3 className="text-base font-semibold">
                            <Link href={item.href}>{item.title}</Link>
                          </h3>
                          <Badge>{ENTITY_TAG_ENTITY_TYPE_LABELS[item.entityType] ?? item.entityType}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <span>{item.group}</span>
                          {item.worldName && <span> · {item.worldName}</span>}
                        </div>
                        <p className="text-sm">Tags: {item.matchedTags.join(", ")}</p>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasAdminResults && scope !== "worlds" && (
            <section className="flex flex-col gap-3">
              <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
                Daily Admin OS <Badge>Studio-only</Badge>
              </h2>
              <p className="text-sm text-muted-foreground">
                {adminResults.length} Treffer für „{trimmedQuery}&ldquo;
              </p>
              <ul className="grid gap-2">
                {adminResults.map((item) => (
                  <li key={`${item.entityType}-${item.id}`}>
                    <Card>
                      <CardContent className="flex flex-col gap-2 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h3 className="text-base font-semibold">
                            <Link href={item.href}>{item.title}</Link>
                          </h3>
                          <Badge>{ADMIN_SEARCH_ENTITY_LABELS[item.entityType]}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <span>{item.group}</span>
                        </div>
                        {item.snippet && <p className="text-sm">{item.snippet}</p>}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </StudioShell>
  );
}
