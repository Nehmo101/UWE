"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AuthUiVariant } from "./AuthPageLayout";
import { authClasses } from "./AuthPageLayout";

interface TwoFactorSetupFormProps {
  variant: AuthUiVariant;
  backHref?: string;
}

interface SetupPayload {
  secret: string;
  otpauthUri: string;
}

export function TwoFactorSetupForm({
  variant,
  backHref = "/",
}: TwoFactorSetupFormProps) {
  const classes = authClasses(variant);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingSetup, setPendingSetup] = useState<SetupPayload | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/auth/two-factor");
    setLoading(false);
    if (!response.ok) {
      setError("2FA-Status konnte nicht geladen werden.");
      return;
    }
    const payload = (await response.json()) as { enabled?: boolean };
    setEnabled(Boolean(payload.enabled));
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function beginSetup() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const response = await fetch("/api/auth/two-factor/setup", { method: "POST" });
    setBusy(false);
    const payload = (await response.json()) as SetupPayload & { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Setup konnte nicht gestartet werden.");
      return;
    }
    setPendingSetup({ secret: payload.secret, otpauthUri: payload.otpauthUri });
  }

  async function activateSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingSetup) return;

    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/two-factor/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: confirmCode }),
    });
    setBusy(false);
    const payload = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setError(payload.error ?? "Aktivierung fehlgeschlagen.");
      return;
    }
    setPendingSetup(null);
    setConfirmCode("");
    setEnabled(true);
    setSuccess(payload.message ?? "Zwei-Faktor-Authentifizierung ist aktiv.");
  }

  async function disableTwoFactor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/two-factor/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: disableCode }),
    });
    setBusy(false);
    const payload = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setError(payload.error ?? "Deaktivierung fehlgeschlagen.");
      return;
    }
    setDisableCode("");
    setEnabled(false);
    setSuccess(payload.message ?? "Zwei-Faktor-Authentifizierung wurde deaktiviert.");
  }

  if (loading) {
    return <p className={classes.lead}>Lade Sicherheitseinstellungen…</p>;
  }

  return (
    <div className={classes.form}>
      {success && (
        <p className={classes.success} role="status">
          {success}
        </p>
      )}
      {error && (
        <p className={classes.error} role="alert">
          {error}
        </p>
      )}

      {enabled ? (
        <>
          <p className={classes.lead}>
            Zwei-Faktor-Authentifizierung ist <strong>aktiv</strong>. Beim Login wird nach dem Passwort
            ein TOTP-Code verlangt.
          </p>
          <form onSubmit={disableTwoFactor}>
            <label htmlFor="disable-2fa-code">Code zum Deaktivieren</label>
            <input
              id="disable-2fa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={8}
              value={disableCode}
              onChange={(event) => setDisableCode(event.target.value)}
              required
            />
            <button type="submit" className="uwe-btn" disabled={busy}>
              {busy ? "Deaktiviere…" : "2FA deaktivieren"}
            </button>
          </form>
        </>
      ) : pendingSetup ? (
        <>
          <p className={classes.lead}>
            Scanne den Schlüssel in deiner Authenticator-App (Google Authenticator, Authy, 1Password …)
            oder trage ihn manuell ein.
          </p>
          <p>
            <strong>Geheimschlüssel:</strong>{" "}
            <code style={{ wordBreak: "break-all" }}>{pendingSetup.secret}</code>
          </p>
          <p className={classes.footer}>
            <a href={pendingSetup.otpauthUri}>otpauth-Link öffnen</a>
          </p>
          <form onSubmit={activateSetup}>
            <label htmlFor="confirm-2fa-code">Bestätigungscode aus der App</label>
            <input
              id="confirm-2fa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={8}
              value={confirmCode}
              onChange={(event) => setConfirmCode(event.target.value)}
              required
            />
            <button type="submit" className="uwe-btn uwe-btn-primary" disabled={busy}>
              {busy ? "Aktiviere…" : "2FA aktivieren"}
            </button>
            <button
              type="button"
              className="uwe-btn"
              disabled={busy}
              onClick={() => {
                setPendingSetup(null);
                setConfirmCode("");
              }}
            >
              Abbrechen
            </button>
          </form>
        </>
      ) : (
        <>
          <p className={classes.lead}>
            Schütze dein Konto mit TOTP (6-stelliger Code aus einer Authenticator-App).
          </p>
          <button type="button" className="uwe-btn uwe-btn-primary" disabled={busy} onClick={beginSetup}>
            {busy ? "Starte…" : "2FA einrichten"}
          </button>
        </>
      )}

      <p className={classes.footer}>
        <Link href={backHref}>Zurück</Link>
      </p>
    </div>
  );
}
