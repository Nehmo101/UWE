import { useCallback, useEffect, useState } from "react";

import { HealthBadge } from "@uwe/shared-ui";

import { opsInvoke } from "../lib/tauri";
import { toMessage } from "../lib/connector-runtime-labels";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";

/**
 * Cloudflare Managed Challenge — die „Verify you are human"-Prüfung an der Edge.
 *
 * Kam mit dem Feature als Karte in Studios System-Bereich; der ist auf diesem
 * Stand in die Kommandozentrale gezogen (Abschnitt D), also wohnt die Karte
 * jetzt hier neben dem Tunnel. Gleiche Ops-Brücke wie Einstellungen und SMTP:
 * Speichern schreibt die Deployment-Settings, die Host-JSON und wendet die
 * Regel sofort an — kein Dashboard-Schritt. Der API-Token bleibt verschlüsselt
 * auf dem Host und wird hier nie zurückgelesen.
 */

interface ChallengeDesired {
  active: boolean;
  hostnames: string[];
  skipPaths: string[];
  action: string;
  expression: string | null;
}

interface ChallengeEdge {
  ok: boolean;
  present: boolean;
  active: boolean;
  action: string | null;
  foreignRuleCount: number;
  message: string;
}

interface ChallengeDeployment {
  managedChallengeEnabled: boolean;
  managedChallengeHostnames: string[];
  managedChallengeSkipPaths: string[];
  managedChallengeAction: string;
  cloudflareZoneId: string;
  cloudflareApiTokenConfigured?: boolean;
}

interface ChallengeStatus {
  ok: boolean;
  inSync: boolean;
  credentialsConfigured: boolean;
  desired: ChallengeDesired;
  edge: ChallengeEdge | null;
  deployment: ChallengeDeployment;
}

interface ChallengeApplyResult {
  ok: boolean;
  applied: { ok: boolean; message: string } | null;
}

function listToText(values: string[]): string {
  return values.join("\n");
}

export function CloudflareChallengeCard() {
  const [status, setStatus] = useState<ChallengeStatus | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [hostnames, setHostnames] = useState("");
  const [skipPaths, setSkipPaths] = useState("");
  const [action, setAction] = useState("managed_challenge");
  const [zoneId, setZoneId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const result = await opsInvoke<ChallengeStatus>("cloudflare-challenge-status");
      const data = result.data ?? (result as unknown as ChallengeStatus);
      setStatus(data);
      setEnabled(data.deployment.managedChallengeEnabled);
      setHostnames(listToText(data.deployment.managedChallengeHostnames));
      setSkipPaths(listToText(data.deployment.managedChallengeSkipPaths));
      setAction(data.deployment.managedChallengeAction || "managed_challenge");
      setZoneId(data.deployment.cloudflareZoneId);
    } catch (nextError) {
      setError(toMessage(nextError));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(fn: () => Promise<ChallengeApplyResult | unknown>, ok: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = (await fn()) as { data?: ChallengeApplyResult } | ChallengeApplyResult;
      const payload = ("data" in result ? result.data : result) as ChallengeApplyResult | undefined;
      if (payload && payload.applied && !payload.applied.ok) {
        setError(`Gespeichert, aber die Edge meldet: ${payload.applied.message}`);
      } else {
        setMessage(ok);
      }
      setApiToken("");
      await refresh();
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  const edge = status?.edge ?? null;
  const badge = !status
    ? { state: "degraded" as const, label: "Status wird geladen…" }
    : !status.credentialsConfigured
      ? { state: "degraded" as const, label: "Keine Zone-Zugangsdaten" }
      : status.inSync
        ? { state: "ok" as const, label: "Edge im Soll" }
        : { state: "degraded" as const, label: "Edge weicht ab" };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Managed Challenge (Bot-Schutz)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="connector-stack">
          <HealthBadge status={badge.state} label={badge.label} />
          <p className="connector-muted">
            Ganzseitige Cloudflare-Prüfung vor den öffentlichen UWE-Adressen. Standard aus — ein
            Speichern wendet die Regel sofort in der Zone an. <code>/api/health</code>,{" "}
            <code>/api/internal</code>, <code>/api/agent-jobs</code> und{" "}
            <code>/api/connectors</code> bleiben immer ausgenommen: Tunnel-Probes, Job-Callbacks und
            der RTX-Connector sind Maschinen — eine Challenge-Seite käme dort als Ausfall an.
          </p>
          {edge ? (
            <p className="connector-muted">
              Zone: Regel {edge.present ? (edge.active ? "aktiv" : "vorhanden, inaktiv") : "nicht vorhanden"}
              {edge.foreignRuleCount > 0 ? ` · ${edge.foreignRuleCount} fremde WAF-Regel(n) bleiben unberührt` : ""}
              {edge.ok ? "" : ` · ${edge.message}`}
            </p>
          ) : null}
          {message ? <div className="connector-banner connector-banner-success">{message}</div> : null}
          {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}

          <div className="connector-form-grid">
            <label className="connector-field">
              <span>Challenge aktiv</span>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <small>Aus = Regel wird aus der Zone entfernt; niemand wird ausgesperrt.</small>
            </label>
            <label className="connector-field">
              <span>Prüfmodus</span>
              <select
                className="connector-input"
                value={action}
                onChange={(event) => setAction(event.target.value)}
              >
                <option value="managed_challenge">Managed Challenge (adaptiv)</option>
                <option value="js_challenge">JS Challenge (strikt)</option>
              </select>
            </label>
            <label className="connector-field connector-field-full">
              <span>Hostnames (eine pro Zeile, leer = alle öffentlichen UWE-Adressen)</span>
              <textarea
                className="connector-input"
                rows={3}
                value={hostnames}
                onChange={(event) => setHostnames(event.target.value)}
                placeholder={"studio.uwe.example\nportal.uwe.example"}
              />
            </label>
            <label className="connector-field connector-field-full">
              <span>Zusätzlich ausgenommene Pfade (optional)</span>
              <textarea
                className="connector-input"
                rows={2}
                value={skipPaths}
                onChange={(event) => setSkipPaths(event.target.value)}
                placeholder="/api/mein-webhook"
              />
            </label>
            <label className="connector-field">
              <span>Zone-ID</span>
              <input
                className="connector-input"
                value={zoneId}
                onChange={(event) => setZoneId(event.target.value)}
                placeholder="aus dem Cloudflare-Dashboard (Übersicht der Domain)"
              />
            </label>
            <label className="connector-field">
              <span>API-Token {status?.deployment.cloudflareApiTokenConfigured ? "(hinterlegt)" : ""}</span>
              <input
                className="connector-input"
                type="password"
                value={apiToken}
                onChange={(event) => setApiToken(event.target.value)}
                placeholder="Berechtigung: Zone → Zone WAF → Edit"
              />
              <small>Wird verschlüsselt gespeichert und nie wieder angezeigt. Leer = unverändert.</small>
            </label>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="connector-actions">
          <Button
            variant="primary"
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  opsInvoke("cloudflare-challenge-set", {
                    enabled,
                    hostnames,
                    skipPaths,
                    action,
                    zoneId,
                    apiToken: apiToken.trim() || undefined,
                  }),
                "Gespeichert und an der Edge angewendet.",
              )
            }
          >
            {busy ? "…" : "Speichern & anwenden"}
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !status?.credentialsConfigured}
            onClick={() => run(() => opsInvoke("cloudflare-challenge-apply"), "Regel erneut angewendet.")}
          >
            Nur Regel erneut anwenden
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => void refresh()}>
            Status neu laden
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
