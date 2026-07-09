"use client";

import { useCallback, useEffect, useState } from "react";
import { HealthBadge } from "@uwe/shared-ui";

interface ProbeResult {
  label: string;
  url: string;
  ok: boolean;
  status: number | null;
  message: string;
}

interface ProbeResponse {
  ok: boolean;
  message: string;
  results: ProbeResult[];
}

/** Live tunnel/public URL reachability probe (#616). */
export function CloudflareTunnelHealthPanel() {
  const [results, setResults] = useState<ProbeResult[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runProbe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/setup/test/urls", {
        method: "POST",
        cache: "no-store",
      });
      const data = (await response.json()) as ProbeResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? data.message ?? "Health-Probe fehlgeschlagen.");
      }
      setResults(data.results);
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Health-Probe fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runProbe();
    const timer = setInterval(() => {
      void runProbe();
    }, 60_000);
    return () => clearInterval(timer);
  }, [runProbe]);

  return (
    <section className="uwe-v2-card uwe-v2-card-padded" aria-label="Tunnel-Health-Probe">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.65rem" }}>
        <h3 className="uwe-v2-section-title" style={{ margin: 0, flex: "1 1 12rem" }}>
          Erreichbarkeits-Probe
        </h3>
        <button
          type="button"
          className="uwe-v2-btn uwe-v2-btn-ghost"
          disabled={loading}
          onClick={() => void runProbe()}
        >
          {loading ? "Prüfe…" : "Jetzt prüfen"}
        </button>
      </div>
      <p className="uwe-dashboard-muted" style={{ marginTop: "0.5rem" }}>
        Prüft <code>/api/health/public</code> auf den konfigurierten Studio- und Portal-URLs — nicht
        nur Config-Flags. Aktualisiert sich alle 60&nbsp;Sekunden.
      </p>
      {error ? (
        <p className="uwe-form-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="uwe-dashboard-muted">{message}</p> : null}
      {results && results.length > 0 ? (
        <ul className="uwe-dashboard-list" style={{ marginTop: "0.75rem" }}>
          {results.map((result) => (
            <li key={result.label}>
              <HealthBadge status={result.ok ? "ok" : "error"} label={result.label} />{" "}
              <code style={{ fontSize: "0.85em" }}>{result.url}</code>
              <span className="uwe-dashboard-muted"> — {result.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
