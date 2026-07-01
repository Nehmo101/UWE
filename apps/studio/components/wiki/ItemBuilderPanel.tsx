"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface EquipmentSearchResult {
  id: string;
  name: string;
  url?: string;
  provider: "open5e" | "dnd5e_srd";
  kind?: "weapon" | "magicitem" | "equipment" | null;
  summary?: string;
}

interface Props {
  worldSlug: string;
  pageId: string;
  pageSlug: string;
  category: string;
  pageTitle: string;
  pageSummary: string | null;
  searchEquipmentUrl: string;
  applyEquipmentAction: (formData: FormData) => void | Promise<void>;
  generatorSectionId?: string;
}

function kindLabel(kind: EquipmentSearchResult["kind"]): string | null {
  switch (kind) {
    case "weapon":
      return "Waffe";
    case "magicitem":
      return "Magischer Gegenstand";
    case "equipment":
      return "SRD-Ausrüstung";
    default:
      return null;
  }
}

export function ItemBuilderPanel({
  worldSlug,
  pageId,
  pageSlug,
  category,
  pageTitle,
  pageSummary,
  searchEquipmentUrl,
  applyEquipmentAction,
  generatorSectionId = "item-structured-generator",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EquipmentSearchResult[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearchBusy(true);
      setSearchError(null);
      try {
        const response = await fetch(`${searchEquipmentUrl}?q=${encodeURIComponent(trimmed)}`);
        const data = (await response.json()) as {
          results?: EquipmentSearchResult[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Ausrüstungssuche fehlgeschlagen.");
        }
        setResults(data.results ?? []);
      } catch (error) {
        setResults([]);
        setSearchError(error instanceof Error ? error.message : "Ausrüstungssuche fehlgeschlagen.");
      } finally {
        setSearchBusy(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, searchEquipmentUrl]);

  const hiddenFields = {
    worldSlug,
    pageId,
    pageSlug,
    category,
  };

  return (
    <section className="uwe-v2-card uwe-v2-section">
      <h2 className="uwe-v2-section-title">Magic Item Builder</h2>
      <p className="uwe-dashboard-muted">
        SRD- und Open5e-Ausrüstung suchen, als Basis übernehmen oder im strukturierten
        Generator weiter ausarbeiten.
      </p>

      <p className="uwe-hint">
        Aktuell: <strong>{pageTitle}</strong>
        {pageSummary?.trim() ? <> — {pageSummary.trim()}</> : null}
      </p>

      <div className="auth-character-spell-search">
        <label>
          SRD / Open5e Ausrüstung
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="z. B. Longsword, Oil of Sharpness"
            autoComplete="off"
          />
        </label>
        {searchBusy && <p className="auth-muted">Suche…</p>}
        {searchError && <p className="auth-error">{searchError}</p>}
        {results.length > 0 && (
          <ul className="auth-character-spell-search-results">
            {results.map((result) => {
              const label = kindLabel(result.kind);
              return (
                <li key={`${result.provider}:${result.id}`}>
                  <form action={applyEquipmentAction} className="auth-character-spell-search-form">
                    {Object.entries(hiddenFields).map(([name, value]) => (
                      <input key={name} type="hidden" name={name} value={value} />
                    ))}
                    <input type="hidden" name="provider" value={result.provider} />
                    <input type="hidden" name="equipmentId" value={result.id} />
                    <input type="hidden" name="name" value={result.name} />
                    {result.url ? (
                      <input type="hidden" name="sourceUrl" value={result.url} />
                    ) : null}
                    <button type="submit" className="auth-btn auth-btn-small">
                      {result.name}
                      {label ? ` · ${label}` : null}
                      {result.summary ? ` — ${result.summary}` : null}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="uwe-dashboard-muted">
        <Link href={`#${generatorSectionId}`}>Zum strukturierten Item-Generator ↓</Link>
      </p>
    </section>
  );
}
