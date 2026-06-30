"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PERSONAL_BRAIN_CATEGORIES,
  PERSONAL_BRAIN_CATEGORY_LABELS,
} from "@uwe/database/personal-brain-constants";

interface SearchDocumentHit {
  id: string;
  title: string;
  content: string;
  category: string | null;
  score: number;
}

interface SearchFactHit {
  id: string;
  title: string;
  content: string;
  factType: string;
  score: number;
}

interface SearchResponse {
  documents: SearchDocumentHit[];
  facts: SearchFactHit[];
}

function truncate(text: string, maxLength = 140): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function LifeBrainSearchPanel() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResponse | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 && !category) {
      setResults(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (trimmed.length >= 2) {
          params.set("q", trimmed);
        }
        if (category) {
          params.set("category", category);
        }
        params.set("limit", "20");

        const response = await fetch(`/api/life-brain/search?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Suche fehlgeschlagen (${response.status})`);
        }

        const payload = (await response.json()) as SearchResponse;
        setResults(payload);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Suche fehlgeschlagen");
        setResults(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, category]);

  const hasHits =
    results != null && (results.documents.length > 0 || results.facts.length > 0);
  const showEmpty =
    results != null &&
    !loading &&
    query.trim().length >= 2 &&
    results.documents.length === 0 &&
    results.facts.length === 0;

  return (
    <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
      <h2 className="uwe-v2-section-title">Suche</h2>
      <div className="uwe-brain-create-form">
        <label>
          Stichwort
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="homelab, netzwerk, filament…"
            autoComplete="off"
          />
        </label>
        <label>
          Kategorie
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Alle Kategorien</option>
            {PERSONAL_BRAIN_CATEGORIES.map((entry) => (
              <option key={entry} value={entry}>
                {PERSONAL_BRAIN_CATEGORY_LABELS[entry]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading && <p className="uwe-dashboard-muted">Suche läuft…</p>}
      {error && (
        <p className="uwe-form-error" role="alert">
          {error}
        </p>
      )}
      {showEmpty && <p className="uwe-dashboard-muted">Keine Treffer für „{query.trim()}“.</p>}
      {hasHits && (
        <div className="uwe-v2-section">
          {results.documents.length > 0 && (
            <>
              <h3 className="uwe-section-subtitle">Dokumente ({results.documents.length})</h3>
              <div className="uwe-today-card-list">
                {results.documents.map((document) => (
                  <article key={document.id} className="uwe-today-card">
                    <h4>
                      <Link href={`/life-brain/documents/${document.id}`}>{document.title}</Link>
                    </h4>
                    <p className="uwe-dashboard-muted">
                      {document.category
                        ? (PERSONAL_BRAIN_CATEGORY_LABELS[
                            document.category as (typeof PERSONAL_BRAIN_CATEGORIES)[number]
                          ] ?? document.category)
                        : "Allgemein"}
                    </p>
                    {document.content && <p>{truncate(document.content)}</p>}
                  </article>
                ))}
              </div>
            </>
          )}
          {results.facts.length > 0 && (
            <>
              <h3 className="uwe-section-subtitle">Fakten ({results.facts.length})</h3>
              <div className="uwe-today-card-list">
                {results.facts.map((fact) => (
                  <article key={fact.id} className="uwe-today-card">
                    <h4>
                      <Link href={`/life-brain/facts/${fact.id}`}>{fact.title}</Link>
                    </h4>
                    <p className="uwe-dashboard-muted">{fact.factType}</p>
                    {fact.content && <p>{truncate(fact.content)}</p>}
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {query.trim().length === 1 && (
        <p className="uwe-dashboard-muted">Mindestens 2 Zeichen für die Stichwortsuche.</p>
      )}
    </section>
  );
}
