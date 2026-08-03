import { useCallback, useEffect, useState } from "react";

import { HealthBadge } from "@uwe/shared-ui";

import { opsInvoke } from "../lib/tauri";
import { toMessage } from "../lib/connector-runtime-labels";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";

/**
 * Öffentliche Adressen — welcher Hostname auf welche App zeigt.
 *
 * Bisher war das Dashboard-Handarbeit oder ein Bash-Skript auf dem Host, und
 * eine vergessene App (zuletzt Family) fiel erst auf, wenn ein Link ins Leere
 * lief. Die Soll-Routen kommen aus derselben Konfiguration wie die Links in der
 * App, das Anwenden setzt Ingress und DNS in einem Schritt. Fremde Routen im
 * Tunnel bleiben unangetastet.
 */

interface RoutePlan {
  label: string;
  hostname: string;
  path?: string;
  port: number;
}

interface IngressPlan {
  ok: boolean;
  apexHost: string;
  routes: RoutePlan[];
  dnsHosts: string[];
  notes: string[];
}

interface TunnelStatus {
  ok: boolean;
  inSync: boolean;
  plan: IngressPlan;
  tunnelConfigured: boolean;
  apiTokenConfigured: boolean;
  message: string;
}

interface ApplyResult {
  ok: boolean;
  changed: boolean;
  message: string;
  preservedHostnames: string[];
  dns: { hostname: string; outcome: string; message: string }[];
}

function unwrap<T>(result: { data?: T } | T): T {
  return (result && typeof result === "object" && "data" in result
    ? ((result as { data?: T }).data ?? (result as T))
    : result) as T;
}

export function CloudflareRoutesCard() {
  const [status, setStatus] = useState<TunnelStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setStatus(unwrap(await opsInvoke<TunnelStatus>("cloudflare-tunnel-status")));
    } catch (nextError) {
      setError(toMessage(nextError));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function apply() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = unwrap(await opsInvoke<ApplyResult>("cloudflare-tunnel-apply"));
      if (result?.ok) {
        const preserved = result.preservedHostnames?.length
          ? ` Fremde Routen unverändert: ${result.preservedHostnames.join(", ")}.`
          : "";
        setMessage(`${result.message}${preserved}`);
      } else {
        setError(result?.message ?? "Die Routen konnten nicht gesetzt werden.");
      }
      await refresh();
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  const plan = status?.plan ?? null;
  const blocked = status ? !status.tunnelConfigured || !status.apiTokenConfigured : false;
  const badge = !status
    ? { state: "degraded" as const, label: "Status wird geladen…" }
    : blocked || !plan?.ok
      ? { state: "degraded" as const, label: "Nicht eingerichtet" }
      : status.inSync
        ? { state: "ok" as const, label: "Alle Adressen aktiv" }
        : { state: "degraded" as const, label: "Routen weichen ab" };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Öffentliche Adressen</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="connector-stack">
          <HealthBadge status={badge.state} label={badge.label} />
          <p className="connector-muted">
            Welcher Hostname auf welche App zeigt. „Adressen einrichten“ schreibt die Routen in den
            Tunnel und legt die fehlenden DNS-Einträge an — beides in einem Schritt, wiederholbar
            ohne Nebenwirkung. Fremde Routen im Tunnel bleiben erhalten.
          </p>

          {plan?.ok ? (
            <div className="connector-table-wrap">
              <table className="connector-table">
                <thead>
                  <tr>
                    <th>App</th>
                    <th>Adresse</th>
                    <th>Lokaler Port</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.routes.map((route) => (
                    <tr key={`${route.hostname}${route.path ?? ""}`}>
                      <td>{route.label}</td>
                      <td>
                        <code>
                          {route.hostname}
                          {route.path ?? ""}
                        </code>
                      </td>
                      <td>:{route.port}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {plan?.notes.map((note) => (
            <p key={note} className="connector-muted">
              {note}
            </p>
          ))}

          {status && !status.tunnelConfigured ? (
            <div className="connector-banner connector-banner-error">
              Kein Tunnel-Token hinterlegt — oben unter „Tunnel-Token“ speichern.
            </div>
          ) : null}
          {status && status.tunnelConfigured && !status.apiTokenConfigured ? (
            <div className="connector-banner connector-banner-error">
              Kein Cloudflare-API-Token hinterlegt. Rechte: Account → Cloudflare Tunnel → Edit und
              Zone → DNS → Edit. Eintragen in der Karte „Managed Challenge“ weiter unten.
            </div>
          ) : null}
          {status && !blocked && !status.ok ? (
            <div className="connector-banner connector-banner-error">{status.message}</div>
          ) : null}
        </div>
      </CardContent>
      <CardFooter>
        <div className="connector-actions">
          {message ? <div className="connector-banner connector-banner-success">{message}</div> : null}
          {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
          <Button
            variant="primary"
            onClick={() => void apply()}
            disabled={busy || blocked || !plan?.ok}
          >
            {busy ? "…" : "Adressen einrichten"}
          </Button>
          <Button variant="ghost" onClick={() => void refresh()} disabled={busy}>
            Status neu laden
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
