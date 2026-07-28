"use client";

import { useCallback, useEffect, useState } from "react";
import { HealthBadge } from "@uwe/shared-ui";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

interface DesiredState {
  active: boolean;
  hostnames: string[];
  skipPaths: string[];
  action: string;
  expression: string | null;
}

interface EdgeState {
  ok: boolean;
  present: boolean;
  active: boolean;
  action: string | null;
  expression: string | null;
  foreignRuleCount: number;
  message: string;
}

interface ChallengeResponse {
  ok: boolean;
  inSync: boolean;
  desired: DesiredState;
  edge: EdgeState;
  error?: string;
}

/**
 * Live view of the Cloudflare Managed Challenge: what UWE wants (from the
 * settings below) next to what the zone actually has. Read-only — the rule is
 * written by saving the settings form or the "Jetzt anwenden" button next to it.
 */
export function CloudflareManagedChallengePanel() {
  const [data, setData] = useState<ChallengeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/cloudflare/managed-challenge", { cache: "no-store" });
      const payload = (await response.json()) as ChallengeResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Status konnte nicht gelesen werden.");
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status konnte nicht gelesen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const desired = data?.desired;
  const edge = data?.edge;

  return (
    <Card aria-label="Managed-Challenge-Status">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Managed Challenge an der Edge</CardTitle>
        <Button type="button" variant="ghost" disabled={loading} onClick={() => void load()}>
          {loading ? "Prüfe…" : "Neu laden"}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Fragt die WAF-Regel direkt bei Cloudflare ab — Soll-Zustand aus UWE gegen Ist-Zustand in der
          Zone. Fremde WAF-Regeln bleiben dabei unberührt.
        </p>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {data ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <HealthBadge
                status={data.inSync ? "ok" : data.ok ? "degraded" : "error"}
                label={
                  !data.ok
                    ? "Nicht lesbar"
                    : data.inSync
                      ? "Edge entspricht UWE"
                      : "Abweichung — speichern oder anwenden"
                }
              />
              <span className="text-sm text-muted-foreground">{edge?.message}</span>
            </div>

            <dl className="grid grid-cols-[14rem_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Soll (UWE)</dt>
              <dd className="font-mono break-all">
                {desired?.active
                  ? `${desired.action} für ${desired.hostnames.join(", ")}`
                  : "keine Challenge"}
              </dd>
              <dt className="text-muted-foreground">Ist (Cloudflare)</dt>
              <dd className="font-mono break-all">
                {edge?.active ? `${edge.action}` : edge?.present ? "Regel vorhanden, deaktiviert" : "keine Regel"}
              </dd>
              <dt className="text-muted-foreground">Ausnahme-Pfade</dt>
              <dd className="font-mono break-all">{desired?.skipPaths.join(", ") || "—"}</dd>
              <dt className="text-muted-foreground">Fremde WAF-Regeln</dt>
              <dd className="font-mono">{edge?.foreignRuleCount ?? 0}</dd>
            </dl>

            {edge?.expression ? (
              <p className="text-xs text-muted-foreground">
                Regel-Ausdruck: <code className="break-all">{edge.expression}</code>
              </p>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
