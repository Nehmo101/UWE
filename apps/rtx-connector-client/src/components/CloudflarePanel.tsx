import { useCallback, useEffect, useState } from "react";

import { HealthBadge } from "@uwe/shared-ui";

import {
  cloudflareClearToken,
  cloudflareSetToken,
  cloudflareStart,
  cloudflareStatus,
  cloudflareStop,
  type CloudflareTunnelStatus,
} from "../lib/tauri";
import { toMessage } from "../lib/connector-runtime-labels";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";

export function CloudflarePanel() {
  const [status, setStatus] = useState<CloudflareTunnelStatus | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setStatus(await cloudflareStatus());
    } catch (nextError) {
      setError(toMessage(nextError));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run<T>(fn: () => Promise<T>, ok: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(ok);
      await refresh();
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  const running = status?.running ?? false;
  const hasToken = status?.hasToken ?? false;

  return (
    <div className="command-center-stack">
      <section className={`command-center-hero ${running ? "is-ready" : "is-attention"}`}>
        <div>
          <span className="connector-kicker">CLOUDFLARE · TUNNEL · ÖFFENTLICHE HOSTS</span>
          <h3>Cloudflare-Tunnel</h3>
          <p>Startet den lokalen cloudflared-Connector, der Startseite, Studio, Portal und Brain öffentlich erreichbar macht.</p>
        </div>
        <div className="command-center-hero-status">
          <HealthBadge status={running ? "ok" : "degraded"} label={running ? "Tunnel läuft" : "Tunnel gestoppt"} />
          <small>{status?.pid ? `PID ${status.pid}` : hasToken ? "Token hinterlegt" : "Kein Token"}</small>
        </div>
      </section>

      {message ? <div className="connector-banner connector-banner-success">{message}</div> : null}
      {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
      {!hasToken ? (
        <div className="connector-banner connector-banner-error">
          Es ist noch kein Tunnel-Token hinterlegt — ohne Token kann der Connector nicht starten und
          die öffentlichen Adressen (studio./portal./brain.uweanddragons.org) sind offline.
        </div>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Connector steuern</CardTitle></CardHeader>
        <CardContent>
          <div className="connector-stack">
            <HealthBadge status={running ? "ok" : "degraded"} label={running ? "cloudflared läuft" : "cloudflared gestoppt"} />
            <p className="connector-muted">
              Der Tunnel wird im Cloudflare-Dashboard verwaltet; hier läuft nur der lokale Connector.
              Binary: <code>{status?.bin ?? "cloudflared"}</code>
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <div className="connector-actions">
            <Button variant="primary" onClick={() => run(cloudflareStart, "Tunnel gestartet.")} disabled={busy || running || !hasToken}>
              {busy ? "…" : "Tunnel starten"}
            </Button>
            <Button variant="secondary" onClick={() => run(cloudflareStop, "Tunnel gestoppt.")} disabled={busy || !running}>
              Tunnel stoppen
            </Button>
            <Button variant="ghost" onClick={() => void refresh()} disabled={busy}>Status neu laden</Button>
          </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tunnel-Token</CardTitle></CardHeader>
        <CardContent>
          <div className="connector-form-grid">
            <label className="connector-field connector-field-full">
              <span>Tunnel-Token</span>
              <input
                className="connector-input"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="eyJhIjoi… (aus dem Cloudflare-Dashboard)"
              />
              <small>
                Cloudflare Zero Trust → Networks → Tunnels → deinen Tunnel → Configure → „Install connector&quot;:
                der Wert hinter <code>--token</code>. Wird nur lokal, owner-only gespeichert.
              </small>
            </label>
          </div>
        </CardContent>
        <CardFooter>
          <div className="connector-actions">
            <Button
              variant="primary"
              onClick={() => run(() => cloudflareSetToken(token), "Token gespeichert.").then(() => setToken(""))}
              disabled={busy || token.trim().length < 20}
            >
              Token speichern
            </Button>
            {hasToken ? (
              <Button variant="ghost" onClick={() => run(cloudflareClearToken, "Token entfernt.")} disabled={busy || running}>
                Token entfernen
              </Button>
            ) : null}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
