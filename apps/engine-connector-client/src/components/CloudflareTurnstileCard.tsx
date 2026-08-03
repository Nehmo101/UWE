import { useCallback, useEffect, useState } from "react";

import { HealthBadge } from "@uwe/shared-ui";

import { opsInvoke } from "../lib/tauri";
import { toMessage } from "../lib/connector-runtime-labels";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";

/**
 * Cloudflare Turnstile — die Menschprüfung auf dem Anmeldeformular.
 *
 * Steht bewusst neben der Managed Challenge: beide sind Bot-Schutz, aber an
 * verschiedenen Stellen. Die Challenge filtert an der Edge vor dem ganzen Host,
 * Turnstile sichert nur den Login — und wirkt auch dann, wenn UWE nicht hinter
 * einem Cloudflare-Tunnel liegt. Beide dürfen gleichzeitig laufen.
 *
 * Die Karte liest den Secret-Key nie zurück; leer lassen behält den gespeicherten.
 */

interface TurnstileStatus {
  ok: boolean;
  mode: "env" | "on" | "off";
  siteKey: string;
  secretConfigured: boolean;
  effective: boolean;
  message: string;
}

function unwrap<T>(result: { data?: T } | T): T {
  return (result && typeof result === "object" && "data" in result
    ? ((result as { data?: T }).data ?? (result as T))
    : result) as T;
}

export function CloudflareTurnstileCard() {
  const [status, setStatus] = useState<TurnstileStatus | null>(null);
  const [mode, setMode] = useState<"env" | "on" | "off">("env");
  const [siteKey, setSiteKey] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = unwrap(await opsInvoke<TurnstileStatus>("turnstile-status"));
      setStatus(data);
      setMode(data.mode);
      setSiteKey(data.siteKey);
    } catch (nextError) {
      setError(toMessage(nextError));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(payload: Record<string, unknown>, ok: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await opsInvoke("turnstile-set", payload);
      setSecret("");
      setMessage(ok);
      await refresh();
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  const badge = !status
    ? { state: "degraded" as const, label: "Status wird geladen…" }
    : status.effective
      ? { state: "ok" as const, label: "Login-Prüfung aktiv" }
      : { state: "degraded" as const, label: "Login-Prüfung aus" };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Turnstile (Bot-Schutz am Login)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="connector-stack">
          <HealthBadge status={badge.state} label={badge.label} />
          <p className="connector-muted">
            Cloudflares Menschprüfung direkt auf den Anmeldeformularen von Studio, Portal und
            Startseite — die Ergänzung zur Managed Challenge darüber. Die prüft an der Edge, bevor
            ein Request den Host erreicht; Turnstile schützt gezielt den Login und wirkt auch ohne
            Tunnel davor. Beide dürfen gleichzeitig laufen.
          </p>
          {status ? <p className="connector-muted">{status.message}</p> : null}
          <p className="connector-muted">
            Schlüssel gibt es kostenlos unter Cloudflare-Dashboard → Turnstile → &bdquo;Add
            widget&ldquo; (Widget-Modus <em>Managed</em>). Der Site-Key ist öffentlich, der
            Secret-Key nicht.
          </p>
          {message ? <div className="connector-banner connector-banner-success">{message}</div> : null}
          {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}

          <div className="connector-form-grid">
            <label className="connector-field">
              <span>Schalter</span>
              <select
                className="connector-input"
                value={mode}
                onChange={(event) => setMode(event.target.value as "env" | "on" | "off")}
              >
                <option value="env">Automatisch (an, sobald beide Schlüssel da sind)</option>
                <option value="on">Erzwingen</option>
                <option value="off">Aus</option>
              </select>
              <small>
                &bdquo;Aus&ldquo; ist der Not-Schalter: die Schlüssel bleiben gespeichert.
              </small>
            </label>
            <label className="connector-field">
              <span>Site-Key (öffentlich)</span>
              <input
                className="connector-input"
                value={siteKey}
                onChange={(event) => setSiteKey(event.target.value)}
                placeholder="0x4AAAAAAA…"
              />
              <small>Leer = es gilt der Wert aus der <code>.env</code> des Hosts.</small>
            </label>
            <label className="connector-field connector-field-full">
              <span>Secret-Key {status?.secretConfigured ? "(hinterlegt)" : ""}</span>
              <input
                className="connector-input"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder={status?.secretConfigured ? "•••••• (leer lassen zum Behalten)" : "0x4AAAAAAA…"}
              />
              <small>Wird verschlüsselt gespeichert und nie wieder angezeigt.</small>
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
                { mode, siteKey, secret: secret.trim() || undefined },
                "Gespeichert. Die Anmeldeformulare übernehmen es beim nächsten Aufruf.",
              )
            }
          >
            {busy ? "…" : "Speichern"}
          </Button>
          {status?.secretConfigured ? (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => run({ mode, siteKey, clearSecret: true }, "Secret entfernt — es gilt wieder die .env.")}
            >
              Secret entfernen
            </Button>
          ) : null}
          <Button variant="ghost" disabled={busy} onClick={() => void refresh()}>
            Status neu laden
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
