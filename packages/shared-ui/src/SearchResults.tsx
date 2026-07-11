import type { ReactNode } from "react";
import { EmptyState } from "./AppShell";
import { MobileFilterSheet } from "./MobileComponents";
import { PageTypeBadge, PUBLISH_LABELS, QuestStatusBadge, VisibilityBadge } from "./StatusBadges";
import type {
  PageType,
  PublishStatus,
  QuestLifecycleStatus,
  Visibility,
} from "@uwe/database/enums";

const MATCH_FIELD_LABELS: Record<string, string> = {
  title: "Titel",
  slug: "Slug",
  summary: "Zusammenfassung",
  tags: "Tags",
  aliases: "Aliase",
  content: "Inhalt",
};

export interface SearchResultViewModel {
  pageId: string;
  title: string;
  slug: string;
  type: PageType;
  worldSlug: string;
  worldName: string;
  campaignName: string | null;
  visibility: Visibility;
  publishStatus?: PublishStatus;
  /** Quest lifecycle status; `null` counts as open. Only rendered for quest results. */
  questStatus?: QuestLifecycleStatus | null;
  href: string;
  matchedFields: string[];
  snippet: string | null;
}

export function SearchResultsList({
  results,
  query,
  showWorld = false,
  showVisibility = false,
  showPublish = false,
  showLabelActions = false,
}: {
  results: SearchResultViewModel[];
  query?: string;
  showWorld?: boolean;
  showVisibility?: boolean;
  showPublish?: boolean;
  /** Studio: optional „Label erstellen“ link per result */
  showLabelActions?: boolean;
}) {
  if (!query?.trim()) {
    return (
      <EmptyState
        title="Suche starten"
        description="Gib einen Suchbegriff ein, um Seiten, Inhalte, Tags und Aliase zu finden."
      />
    );
  }

  if (results.length === 0) {
    return (
      <EmptyState
        title="Keine Treffer"
        description={`Für „${query}" wurden keine passenden Seiten gefunden.`}
      />
    );
  }

  return (
    <>
      <p className="mb-4 text-[0.9rem] text-muted-foreground">
        {results.length} Treffer für „{query}&ldquo;
      </p>
      <ul className="m-0 flex list-none flex-col gap-[0.85rem] p-0">
        {results.map((result) => (
          <li
            key={result.pageId}
            className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
          >
            <article>
              <header className="mb-[0.35rem] flex items-start justify-between gap-3">
                <h2 className="m-0 text-[1.05rem]">
                  <a
                    href={result.href}
                    className="text-foreground no-underline hover:text-[color-mix(in_srgb,var(--uwe-accent)_75%,white_25%)]"
                  >
                    {result.title}
                  </a>
                </h2>
                <div className="flex flex-wrap gap-[0.35rem]">
                  <PageTypeBadge type={result.type} />
                  {result.type === "quest" && result.questStatus !== undefined && (
                    <QuestStatusBadge status={result.questStatus} />
                  )}
                  {showVisibility && <VisibilityBadge visibility={result.visibility} />}
                </div>
              </header>

              <div className="mb-[0.45rem] flex flex-wrap gap-2 text-[0.8rem] text-muted-foreground">
                {showWorld && (
                  <span>
                    {result.worldName}
                    {result.campaignName ? ` · ${result.campaignName}` : ""}
                  </span>
                )}
                {!showWorld && result.campaignName && (
                  <span>{result.campaignName}</span>
                )}
                {showPublish && result.publishStatus && (
                  <span>{PUBLISH_LABELS[result.publishStatus] ?? result.publishStatus}</span>
                )}
              </div>

              {result.snippet && (
                <p className="m-0 text-[0.9rem] leading-[1.45] text-foreground">{result.snippet}</p>
              )}

              {result.matchedFields.length > 0 && (
                <p className="mt-[0.45rem] text-xs text-muted-foreground">
                  Treffer in: {result.matchedFields.map((field) => MATCH_FIELD_LABELS[field] ?? field).join(", ")}
                </p>
              )}

              {showLabelActions && (
                <p>
                  <a
                    className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] border border-transparent bg-transparent px-3 py-1 text-[0.8125rem] font-medium text-foreground shadow-sm transition-colors hover:bg-[color-mix(in_srgb,var(--uwe-accent)_8%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    href={`/worlds/${result.worldSlug}/labels/new?sourceRef=${result.type === "room" ? "dungeon_room" : "page"}:${result.pageId}`}
                  >
                    Label erstellen
                  </a>
                </p>
              )}
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}

export function SearchFilterBar({
  action,
  query,
  filters,
  hiddenFields,
}: {
  action: string;
  query?: string;
  filters: {
    name: string;
    label: string;
    value?: string;
    options: { value: string; label: string }[];
  }[];
  hiddenFields?: Record<string, string>;
}) {
  const activeCount = filters.filter((filter) => filter.value).length;

  const formContent = (
    <form
      className="mb-5 flex flex-wrap items-end gap-3 rounded-[var(--uwe-radius-lg)] border border-border bg-[color-mix(in_srgb,var(--uwe-card)_64%,transparent)] px-4 py-[0.85rem]"
      action={action}
      method="get"
    >
      <input type="hidden" name="q" value={query ?? ""} />
      {hiddenFields &&
        Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      {filters.map((filter) => (
        <label key={filter.name} className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span>{filter.label}</span>
          <select
            name={filter.name}
            defaultValue={filter.value ?? ""}
            className="min-w-[9rem] rounded-[0.45rem] border border-border bg-card px-[0.65rem] py-[0.45rem] text-foreground"
          >
            <option value="">Alle</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button
        type="submit"
        className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        Filtern
      </button>
    </form>
  );

  return (
    <MobileFilterSheet title="Suchfilter" activeCount={activeCount}>
      {formContent}
    </MobileFilterSheet>
  );
}

export function GlobalSearchForm({
  action,
  query = "",
  placeholder = "Global suchen…",
  extraFields,
}: {
  action: string;
  query?: string;
  placeholder?: string;
  extraFields?: ReactNode;
}) {
  return (
    <form
      className="flex min-w-0 max-w-[42rem] flex-1 items-center gap-[0.65rem]"
      action={action}
      method="get"
    >
      <input
        type="search"
        name="q"
        placeholder={placeholder}
        defaultValue={query}
        aria-label="Globale Suche"
        enterKeyHint="search"
        className="min-h-11 min-w-0 flex-1 rounded-[0.55rem] border border-border bg-card px-[0.85rem] py-[0.65rem] text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {extraFields}
      <button
        type="submit"
        className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        Suchen
      </button>
    </form>
  );
}
