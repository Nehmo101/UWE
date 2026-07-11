"use client";

import { useCallback, useEffect, useState } from "react";
import { HealthBadge } from "@uwe/shared-ui";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

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
    <Card aria-label="Tunnel-Health-Probe">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Erreichbarkeits-Probe</CardTitle>
        <Button type="button" variant="ghost" disabled={loading} onClick={() => void runProbe()}>
          {loading ? "Prüfe…" : "Jetzt prüfen"}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Prüft <code>/api/health/public</code> auf den konfigurierten Studio- und Portal-URLs — nicht
          nur Config-Flags. Aktualisiert sich alle 60&nbsp;Sekunden.
        </p>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {results && results.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {results.map((result) => (
              <li key={result.label}>
                <HealthBadge status={result.ok ? "ok" : "error"} label={result.label} />{" "}
                <code className="text-xs">{result.url}</code>
                <span className="text-sm text-muted-foreground"> — {result.message}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
