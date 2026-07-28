import { useCallback, useEffect, useState } from "react";

import { opsInvoke } from "../../lib/tauri";
import { toMessage } from "../../lib/connector-runtime-labels";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";

/**
 * SMTP-Zugangsdaten in der Datenbank — Ersatz für den Mail-Tab von Studio
 * `/admin/setup` (Abschnitt D7).
 *
 * Deployment schreibt `.env`. Was hier steht, gewinnt dagegen: die Mail-Settings
 * bevorzugen die DB-Quelle. Darum gibt es „Auf .env zurücksetzen" — sonst ließe
 * sich eine einmal hinterlegte Konfiguration nicht mehr ablösen.
 *
 * Das Passwort geht über stdin an die CLI, nie über die Kommandozeile, und
 * kommt nie wieder heraus: gelesen wird nur der Status.
 */

interface SmtpStatus {
  host: string | null;
  port: number | null;
  secure: boolean;
  username: string | null;
  fromAddress: string | null;
  passwordConfigured: boolean;
  configured: boolean;
  useMock: boolean;
  message: string;
  source: "portal" | "env";
}

interface FormState {
  host: string;
  port: string;
  user: string;
  password: string;
  from: string;
  secure: boolean;
  useMock: boolean;
}

const EMPTY: FormState = {
  host: "",
  port: "587",
  user: "",
  password: "",
  from: "",
  secure: false,
  useMock: false,
};

export function OpsSmtpForm() {
  const [status, setStatus] = useState<SmtpStatus | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const applyStatus = useCallback((next: SmtpStatus | null) => {
    setStatus(next);
    setForm({
      host: next?.host ?? "",
      port: next?.port ? String(next.port) : "587",
      user: next?.username ?? "",
      password: "",
      from: next?.fromAddress ?? "",
      secure: next?.secure === true,
      useMock: next?.useMock === true,
    });
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await opsInvoke<SmtpStatus>("smtp-status");
      if (!result.ok) throw new Error(result.message ?? "SMTP-Status nicht lesbar.");
      applyStatus(result.data ?? null);
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }, [applyStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (action: "smtp-set" | "smtp-clear") => {
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        const payload =
          action === "smtp-set"
            ? {
                host: form.host.trim(),
                port: Number(form.port) || 587,
                secure: form.secure,
                user: form.user.trim(),
                // Leer lassen behält das gespeicherte Passwort.
                password: form.password.length > 0 ? form.password : undefined,
                from: form.from.trim(),
                useMock: form.useMock,
              }
            : undefined;
        const result = await opsInvoke<SmtpStatus>(action, payload);
        if (!result.ok) throw new Error(result.message ?? "Aktion fehlgeschlagen.");
        applyStatus(result.data ?? null);
        setMessage(action === "smtp-set" ? "SMTP gespeichert." : "DB-Zugangsdaten entfernt — es gilt wieder .env.");
      } catch (nextError) {
        setError(toMessage(nextError));
      } finally {
        setBusy(false);
      }
    },
    [applyStatus, form],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setMessage(null);
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="command-center-stack">
      {message ? <div className="connector-banner connector-banner-success">{message}</div> : null}
      {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="connector-muted">
            {status ? `${status.message} · Quelle: ${status.source === "portal" ? "Datenbank" : ".env"}` : "Lade …"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zugangsdaten</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="connector-form-grid">
            <label className="connector-field">
              <span>Host</span>
              <input
                className="connector-input"
                value={form.host}
                disabled={busy}
                onChange={(event) => set("host", event.target.value)}
              />
            </label>
            <label className="connector-field">
              <span>Port</span>
              <input
                className="connector-input"
                type="number"
                value={form.port}
                disabled={busy}
                onChange={(event) => set("port", event.target.value)}
              />
            </label>
            <label className="connector-field">
              <span>Benutzer</span>
              <input
                className="connector-input"
                value={form.user}
                disabled={busy}
                onChange={(event) => set("user", event.target.value)}
              />
            </label>
            <label className="connector-field">
              <span>Passwort</span>
              <input
                className="connector-input"
                type="password"
                value={form.password}
                disabled={busy}
                placeholder={
                  status?.passwordConfigured ? "•••••• (gesetzt — leer lassen zum Behalten)" : ""
                }
                onChange={(event) => set("password", event.target.value)}
              />
            </label>
            <label className="connector-field">
              <span>Absender (From)</span>
              <input
                className="connector-input"
                value={form.from}
                disabled={busy}
                onChange={(event) => set("from", event.target.value)}
              />
            </label>
            <label className="connector-checkbox">
              <input
                type="checkbox"
                checked={form.secure}
                disabled={busy}
                onChange={(event) => set("secure", event.target.checked)}
              />
              <span>TLS/SSL</span>
            </label>
            <label className="connector-checkbox">
              <input
                type="checkbox"
                checked={form.useMock}
                disabled={busy}
                onChange={(event) => set("useMock", event.target.checked)}
              />
              <span>Mock-Versand (nichts wird zugestellt)</span>
            </label>
          </div>
        </CardContent>
        <CardFooter>
          <div className="connector-actions">
            <Button variant="primary" onClick={() => void run("smtp-set")} disabled={busy}>
              Speichern
            </Button>
            <Button variant="ghost" onClick={() => void run("smtp-clear")} disabled={busy}>
              Auf .env zurücksetzen
            </Button>
            <Button variant="ghost" onClick={() => void load()} disabled={busy}>
              Neu laden
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
