"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";

interface TagReference {
  entityType: string;
  entityId: string;
  title: string;
}

interface TagInventoryEntry {
  tag: string;
  normalizedKey: string;
  count: number;
  references: TagReference[];
  onlyOnDrafts: boolean;
  onlyDmOnly: boolean;
}

interface TagMergeSuggestion {
  targetTag: string;
  sourceTags: string[];
  totalReferences: number;
  reason: string;
}

interface SimilarTagGroup {
  canonical: string;
  variants: string[];
  reason: string;
}

interface WorldOption {
  id: string;
  name: string;
  slug: string;
}

interface TagsResponse {
  inventory: TagInventoryEntry[];
  suggestions: TagMergeSuggestion[];
  unused: TagInventoryEntry[];
  similar: SimilarTagGroup[];
  coverage?: {
    types: Array<{
      entityType: string;
      totalEntities: number;
      jsonTagged: number;
      entityTagTagged: number;
    }>;
    totalTags: number;
    totalEntityTags: number;
  };
  entityTypeLabels?: Record<string, string>;
  worlds: WorldOption[];
}

export function TagAdminWorkspace() {
  const [data, setData] = useState<TagsResponse | null>(null);
  const [worldId, setWorldId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mergeToTag, setMergeToTag] = useState("");
  const [mergeFromTags, setMergeFromTags] = useState("");
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  const loadTags = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (worldId) params.set("worldId", worldId);

    try {
      const response = await fetch(studioApiUrl(`/api/admin/tags?${params.toString()}`));
      if (!response.ok) {
        throw new Error(`Tags konnten nicht geladen werden (${response.status}).`);
      }
      setData((await response.json()) as TagsResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [worldId]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  async function handleMerge(event: React.FormEvent) {
    event.preventDefault();
    setMerging(true);
    setMergeStatus(null);

    try {
      const response = await fetch(studioApiUrl("/api/admin/tags"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "merge",
          worldId: worldId || null,
          fromTags: mergeFromTags,
          toTag: mergeToTag,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? `Merge fehlgeschlagen (${response.status}).`);
      }

      const payload = (await response.json()) as {
        result: { updatedEntities: number; toTag: string };
      };
      setMergeStatus(
        `Zusammengeführt nach „${payload.result.toTag}" — ${payload.result.updatedEntities} Entitäten aktualisiert.`,
      );
      setMergeFromTags("");
      setMergeToTag("");
      await loadTags();
    } catch (mergeError) {
      setMergeStatus(
        mergeError instanceof Error ? mergeError.message : "Merge fehlgeschlagen.",
      );
    } finally {
      setMerging(false);
    }
  }

  function applySuggestion(suggestion: TagMergeSuggestion) {
    setMergeToTag(suggestion.targetTag);
    setMergeFromTags(suggestion.sourceTags.join(", "));
  }

  async function handleBackfill() {
    setBackfilling(true);
    setBackfillStatus(null);

    try {
      const response = await fetch(studioApiUrl("/api/admin/tags"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "backfill",
          worldId: worldId || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? `Backfill fehlgeschlagen (${response.status}).`);
      }

      const payload = (await response.json()) as {
        result: { entitiesProcessed: number; entityTagsCreated: number };
      };
      setBackfillStatus(
        `Backfill abgeschlossen — ${payload.result.entitiesProcessed} Entitäten, ${payload.result.entityTagsCreated} neue EntityTag-Zeilen.`,
      );
      await loadTags();
    } catch (backfillError) {
      setBackfillStatus(
        backfillError instanceof Error ? backfillError.message : "Backfill fehlgeschlagen.",
      );
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <>
      <section className="uwe-v2-card uwe-form" style={{ marginBottom: "1.5rem" }}>
        <h2>Filter</h2>
        <div className="uwe-form-grid">
          <label>
            Welt (optional)
            <select value={worldId} onChange={(event) => setWorldId(event.target.value)}>
              <option value="">Alle Welten</option>
              {data?.worlds.map((world) => (
                <option key={world.id} value={world.id}>
                  {world.name} ({world.slug})
                </option>
              ))}
            </select>
          </label>
          <div style={{ alignSelf: "end" }}>
            <button type="button" className="uwe-v2-btn uwe-v2-btn-secondary" onClick={() => void loadTags()}>
              Aktualisieren
            </button>
          </div>
        </div>
      </section>

      {loading && <p>Lade Tag-Inventar…</p>}
      {error && <p className="uwe-form-error">{error}</p>}

      {data && !loading && (
        <>
          {data.coverage && (
            <section className="uwe-v2-card uwe-v2-section">
              <h2 className="uwe-v2-section-title">EntityTag-Abdeckung</h2>
              <p className="uwe-dashboard-muted">
                {data.coverage.totalTags} zentrale Tags · {data.coverage.totalEntityTags}{" "}
                EntityTag-Verknüpfungen. Inventar und Merge nutzen EntityTag als Primärquelle;
                Legacy-Json nur für noch nicht backgefillte Entitäten.
              </p>
              <div className="uwe-today-card-list">
                {data.coverage.types.map((entry) => (
                  <article key={entry.entityType} className="uwe-today-card">
                    <h3>{data.entityTypeLabels?.[entry.entityType] ?? entry.entityType}</h3>
                    <p className="uwe-dashboard-muted">
                      Quelle: {entry.jsonTagged}/{entry.totalEntities} · EntityTag:{" "}
                      {entry.entityTagTagged}/{entry.totalEntities}
                    </p>
                  </article>
                ))}
              </div>
              <button
                type="button"
                className="uwe-v2-btn uwe-v2-btn-secondary"
                disabled={backfilling}
                onClick={() => void handleBackfill()}
              >
                {backfilling ? "Backfill läuft…" : "Legacy-Tags → EntityTag backfillen"}
              </button>
              {backfillStatus && <p className="uwe-hint">{backfillStatus}</p>}
            </section>
          )}

          <section className="uwe-v2-card uwe-v2-section">
            <h2 className="uwe-v2-section-title">Merge-Vorschläge ({data.suggestions.length})</h2>
            {data.suggestions.length === 0 ? (
              <p className="uwe-dashboard-muted">Keine ähnlichen Tags gefunden.</p>
            ) : (
              <div className="uwe-today-card-list">
                {data.suggestions.slice(0, 20).map((suggestion) => (
                  <article key={`${suggestion.targetTag}-${suggestion.sourceTags.join("-")}`} className="uwe-today-card">
                    <h3>
                      {suggestion.sourceTags.join(", ")} → {suggestion.targetTag}
                    </h3>
                    <p className="uwe-dashboard-muted">
                      {suggestion.reason} · {suggestion.totalReferences} Referenzen
                    </p>
                    <button
                      type="button"
                      className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
                      onClick={() => applySuggestion(suggestion)}
                    >
                      In Merge-Formular übernehmen
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="uwe-v2-card uwe-v2-section">
            <h2 className="uwe-v2-section-title">Tags zusammenführen</h2>
            <form className="uwe-form-grid" onSubmit={handleMerge}>
              <label>
                Ziel-Tag
                <input
                  value={mergeToTag}
                  onChange={(event) => setMergeToTag(event.target.value)}
                  placeholder="stadt"
                  required
                />
              </label>
              <label>
                Quell-Tags (kommagetrennt)
                <input
                  value={mergeFromTags}
                  onChange={(event) => setMergeFromTags(event.target.value)}
                  placeholder="Stadt, STADT"
                  required
                />
              </label>
              <div style={{ alignSelf: "end" }}>
                <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary" disabled={merging}>
                  {merging ? "Merge läuft…" : "Tags mergen"}
                </button>
              </div>
            </form>
            {mergeStatus && <p className="uwe-dashboard-muted">{mergeStatus}</p>}
          </section>

          <section className="uwe-v2-card uwe-v2-section">
            <h2 className="uwe-v2-section-title">
              Unbenutzte Kandidaten ({data.unused.length})
            </h2>
            <p className="uwe-dashboard-muted">
              Tags nur auf Drafts oder nur dm_only — Kandidaten zum Aufräumen.
            </p>
            {data.unused.length > 0 && (
              <ul>
                {data.unused.slice(0, 30).map((entry) => (
                  <li key={entry.tag}>
                    <strong>{entry.tag}</strong> ({entry.count}×)
                    {entry.onlyOnDrafts && " · nur Drafts"}
                    {entry.onlyDmOnly && " · nur dm_only"}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="uwe-v2-card uwe-v2-section">
            <h2 className="uwe-v2-section-title">Tag-Inventar ({data.inventory.length})</h2>
            <table className="uwe-table">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Normalisiert</th>
                  <th>Referenzen</th>
                  <th>Hinweise</th>
                </tr>
              </thead>
              <tbody>
                {data.inventory.slice(0, 100).map((entry) => (
                  <tr key={entry.tag}>
                    <td>
                      <strong>{entry.tag}</strong>
                    </td>
                    <td>{entry.normalizedKey}</td>
                    <td>{entry.count}</td>
                    <td>
                      {entry.onlyOnDrafts && <span className="uwe-badge">Draft</span>}{" "}
                      {entry.onlyDmOnly && <span className="uwe-badge">dm_only</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
