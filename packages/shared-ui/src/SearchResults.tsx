import type { ReactNode } from "react";
import { EmptyState } from "./AppShell";
import { PageTypeBadge, VisibilityBadge } from "./StatusBadges";
import type { PageType, PublishStatus, Visibility } from "@uwe/database/enums";

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
}: {
  results: SearchResultViewModel[];
  query?: string;
  showWorld?: boolean;
  showVisibility?: boolean;
  showPublish?: boolean;
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
        {results.length} Treffer für „{query}"
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
                  <span>{result.publishStatus}</span>
                )}
              </div>

              {result.snippet && (
                <p className="uwe-search-result-snippet">{result.snippet}</p>
              )}

              {result.matchedFields.length > 0 && (
                <p className="uwe-search-result-fields">
                  Treffer in: {result.matchedFields.join(", ")}
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
  return (
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
      />
      {extraFields}
      <button type="submit" className="uwe-btn uwe-btn-primary">
        Suchen
      </button>
    </form>
  );
}
