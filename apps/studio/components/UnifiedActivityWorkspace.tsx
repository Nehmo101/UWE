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
  actorDisplayName: string | null;
  targetHref: string | null;
  severity: "info" | "warn" | "error";
}

interface WorldOption {
  id: string;
  name: string;
  slug: string;
}

const SOURCE_LABELS: Record<UnifiedEntry["source"], string> = {
  activity: "Aktivität",
  audit: "Audit",
  ai_usage: "KI-Nutzung",
};

const PAGE_SIZE = 25;

export function UnifiedActivityWorkspace() {
  const [entries, setEntries] = useState<UnifiedEntry[]>([]);
  const [worlds, setWorlds] = useState<WorldOption[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [worldSlug, setWorldSlug] = useState("");
  const [severity, setSeverity] = useState("");
  const [sinceDays, setSinceDays] = useState("30");

  useEffect(() => {
    setOffset(0);
  }, [source, worldSlug, severity, sinceDays]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (source) params.set("source", source);
    if (worldSlug) params.set("worldSlug", worldSlug);
    if (severity) params.set("severity", severity);
    if (sinceDays) params.set("sinceDays", sinceDays);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));

    try {
      const response = await fetch(studioApiUrl(`/api/admin/activity?${params.toString()}`));
      if (!response.ok) {
        throw new Error(`Verlauf konnte nicht geladen werden (${response.status}).`);
      }
      const data = (await response.json()) as {
        entries: UnifiedEntry[];
        total: number;
        worlds: WorldOption[];
      };
      setEntries(data.entries);
      setTotal(data.total);
      setWorlds(data.worlds);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [source, worldSlug, severity, sinceDays, offset]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
            Welt
            <select value={worldSlug} onChange={(event) => setWorldSlug(event.target.value)}>
              <option value="">Alle Welten</option>
              {worlds.map((world) => (
                <option key={world.id} value={world.slug}>
                  {world.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Schweregrad
            <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
              <option value="">Alle</option>
              <option value="info">Info</option>
              <option value="warn">Warnung</option>
              <option value="error">Fehler</option>
            </select>
          </label>
          <label>
            Zeitraum
            <select value={sinceDays} onChange={(event) => setSinceDays(event.target.value)}>
              <option value="7">Letzte 7 Tage</option>
              <option value="30">Letzte 30 Tage</option>
              <option value="90">Letzte 90 Tage</option>
              <option value="">Gesamt</option>
            </select>
          </label>
          <div style={{ alignSelf: "end" }}>
            <button type="button" className="uwe-v2-btn uwe-v2-btn-secondary" onClick={() => void loadEntries()}>
              Aktualisieren
            </button>
          </div>
        </div>
        {worldSlug && source === "ai_usage" && (
          <p className="uwe-hint">KI-Nutzung ist global — Weltfilter blendet nur Aktivität/Audit ein.</p>
        )}
      </section>

      {loading && <p>Lade Verlauf…</p>}
      {error && <p className="uwe-form-error">{error}</p>}

      {!loading && !error && (
        <section className="uwe-v2-card uwe-v2-section">
          <h2 className="uwe-v2-section-title">
            Einträge ({entries.length} von {total})
          </h2>
          {entries.length === 0 ? (
            <p className="uwe-dashboard-muted">Keine Einträge gefunden.</p>
          ) : (
            <div className="uwe-today-card-list">
              {entries.map((entry) => (
                <article key={entry.id} className="uwe-today-card">
                  <header style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <span
                      className={`uwe-badge uwe-badge-${entry.severity === "error" ? "secret" : entry.severity === "warn" ? "draft" : "type"}`}
                    >
                      {SOURCE_LABELS[entry.source]}
                    </span>
                    <strong>{entry.actionLabel}</strong>
                    <span className="uwe-dashboard-muted">{formatStudioDateTime(entry.timestamp)}</span>
                  </header>
                  <p>{entry.summary}</p>
                  <p className="uwe-dashboard-muted">
                    {entry.worldSlug ? `Welt: ${entry.worldSlug}` : "Global"}
                    {entry.actorDisplayName
                      ? ` · ${entry.actorDisplayName}`
                      : entry.actorUserId
                        ? ` · User ${entry.actorUserId}`
                        : ""}
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
          {total > PAGE_SIZE ? (
            <div
              className="uwe-dashboard-muted"
              style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem" }}
            >
              <span>
                Seite {page} von {pageCount}
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
                  disabled={offset === 0}
                  onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
                >
                  Zurück
                </button>
                <button
                  type="button"
                  className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset((value) => value + PAGE_SIZE)}
                >
                  Weiter
                </button>
              </div>
            </div>
          ) : null}
        </section>
      )}
    </>
  );
}
