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
      <p className="uwe-search-count">
        {results.length} Treffer für „{query}&ldquo;
      </p>
      <ul className="uwe-search-results">
        {results.map((result) => (
          <li key={result.pageId} className="uwe-search-result">
            <article>
              <header className="uwe-search-result-header">
                <h2>
                  <a href={result.href}>{result.title}</a>
                </h2>
                <div className="uwe-search-result-badges">
                  <PageTypeBadge type={result.type} />
                  {result.type === "quest" && result.questStatus !== undefined && (
                    <QuestStatusBadge status={result.questStatus} />
                  )}
                  {showVisibility && <VisibilityBadge visibility={result.visibility} />}
                </div>
              </header>

              <div className="uwe-search-result-meta">
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
                <p className="uwe-search-result-snippet">{result.snippet}</p>
              )}

              {result.matchedFields.length > 0 && (
                <p className="uwe-search-result-fields">
                  Treffer in: {result.matchedFields.map((field) => MATCH_FIELD_LABELS[field] ?? field).join(", ")}
                </p>
              )}

              {showLabelActions && (
                <p className="uwe-search-result-actions">
                  <a
                    className="uwe-btn uwe-btn-ghost uwe-btn-small"
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
    <form className="uwe-search-filters" action={action} method="get">
      <input type="hidden" name="q" value={query ?? ""} />
      {hiddenFields &&
        Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      {filters.map((filter) => (
        <label key={filter.name} className="uwe-search-filter">
          <span>{filter.label}</span>
          <select name={filter.name} defaultValue={filter.value ?? ""}>
            <option value="">Alle</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button type="submit" className="uwe-btn uwe-btn-secondary">
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
    <form className="uwe-search uwe-search-wide" action={action} method="get">
      <input
        type="search"
        name="q"
        placeholder={placeholder}
        defaultValue={query}
        aria-label="Globale Suche"
        enterKeyHint="search"
      />
      {extraFields}
      <button type="submit" className="uwe-btn uwe-btn-primary">
        Suchen
      </button>
    </form>
  );
}
