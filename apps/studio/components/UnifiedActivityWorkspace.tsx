"use client";

import Link from "next/link";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useCallback, useEffect, useState } from "react";
import { formatStudioDateTime } from "@/src/lib/format";

interface UnifiedEntry {
  id: string;
  source: "activity" | "audit" | "ai_usage";
  timestamp: string;
  action: string;
  actionLabel: string;
  summary: string;
  worldId: string | null;
  worldSlug: string | null;
  actorUserId: string | null;
  targetHref: string | null;
  severity: "info" | "warn" | "error";
}

const SOURCE_LABELS: Record<UnifiedEntry["source"], string> = {
  activity: "Aktivität",
  audit: "Audit",
  ai_usage: "KI-Nutzung",
};

export function UnifiedActivityWorkspace() {
  const [entries, setEntries] = useState<UnifiedEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [worldId, setWorldId] = useState("");

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (source) params.set("source", source);
    if (worldId) params.set("worldId", worldId);
    params.set("limit", "100");

    try {
      const response = await fetch(studioApiUrl(`/api/admin/activity?${params.toString()}`));
      if (!response.ok) {
        throw new Error(`Verlauf konnte nicht geladen werden (${response.status}).`);
      }
      const data = (await response.json()) as { entries: UnifiedEntry[]; total: number };
      setEntries(data.entries);
      setTotal(data.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [source, worldId]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  return (
    <>
      <section className="uwe-v2-card uwe-form" style={{ marginBottom: "1.5rem" }}>
        <h2>Filter</h2>
        <div className="uwe-form-grid">
          <label>
            Quelle
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="">Alle Quellen</option>
              <option value="activity">Aktivität</option>
              <option value="audit">Audit</option>
              <option value="ai_usage">KI-Nutzung</option>
            </select>
          </label>
          <label>
            Welt-ID (optional)
            <input value={worldId} onChange={(event) => setWorldId(event.target.value)} />
          </label>
          <div style={{ alignSelf: "end" }}>
            <button type="button" className="uwe-v2-btn uwe-v2-btn-secondary" onClick={() => void loadEntries()}>
              Aktualisieren
            </button>
          </div>
        </div>
      </section>

      {loading && <p>Lade Verlauf…</p>}
      {error && <p className="uwe-form-error">{error}</p>}

      {!loading && !error && (
        <section className="uwe-v2-card uwe-v2-section">
          <h2 className="uwe-v2-section-title">Einträge ({total})</h2>
          {entries.length === 0 ? (
            <p className="uwe-dashboard-muted">Keine Einträge gefunden.</p>
          ) : (
            <div className="uwe-today-card-list">
              {entries.map((entry) => (
                <article key={entry.id} className="uwe-today-card">
                  <header style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <span className={`uwe-badge uwe-badge-${entry.severity === "error" ? "secret" : entry.severity === "warn" ? "draft" : "type"}`}>
                      {SOURCE_LABELS[entry.source]}
                    </span>
                    <strong>{entry.actionLabel}</strong>
                    <span className="uwe-dashboard-muted">{formatStudioDateTime(entry.timestamp)}</span>
                  </header>
                  <p>{entry.summary}</p>
                  <p className="uwe-dashboard-muted">
                    {entry.worldSlug ? `Welt: ${entry.worldSlug}` : "Global"}
                    {entry.actorUserId ? ` · Actor: ${entry.actorUserId}` : ""}
                  </p>
                  {entry.targetHref && (
                    <Link className="uwe-v2-btn uwe-v2-btn-sm uwe-v2-btn-secondary" href={entry.targetHref}>
                      Ziel öffnen
                    </Link>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
