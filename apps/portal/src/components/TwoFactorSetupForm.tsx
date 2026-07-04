"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/src/components/ui/states";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

interface TwoFactorSetupFormProps {
  backHref?: string;
}

interface SetupPayload {
  secret: string;
  otpauthUri: string;
}

export function TwoFactorSetupForm({ backHref = "/" }: TwoFactorSetupFormProps) {
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
    return <p className="text-sm text-muted-foreground">Lade Sicherheitseinstellungen…</p>;
  }

  return (
    <div className="space-y-4">
      {success ? <Alert tone="success">{success}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {enabled ? (
        <>
          <p className="text-sm text-muted-foreground">
            Zwei-Faktor-Authentifizierung ist <strong>aktiv</strong>. Beim Login wird nach dem
            Passwort ein TOTP-Code verlangt.
          </p>
          <form className="space-y-4" onSubmit={disableTwoFactor}>
            <div className="space-y-2">
              <Label htmlFor="disable-2fa-code">Code zum Deaktivieren</Label>
              <Input
                id="disable-2fa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={8}
                value={disableCode}
                onChange={(event) => setDisableCode(event.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? "Deaktiviere…" : "2FA deaktivieren"}
            </Button>
          </form>
        </>
      ) : pendingSetup ? (
        <>
          <p className="text-sm text-muted-foreground">
            Scanne den Barcode mit deiner Authenticator-App (Google Authenticator, Authy,
            1Password …) oder trage den Schlüssel manuell ein.
          </p>
          <div className="inline-block rounded-lg border bg-white p-3">
            <QRCodeSVG value={pendingSetup.otpauthUri} size={200} />
          </div>
          <p className="text-sm">
            <strong>Geheimschlüssel:</strong>{" "}
            <code className="break-all">{pendingSetup.secret}</code>
          </p>
          <p className="text-sm">
            <a href={pendingSetup.otpauthUri} className="text-primary hover:underline">
              otpauth-Link öffnen
            </a>
          </p>
          <form className="space-y-4" onSubmit={activateSetup}>
            <div className="space-y-2">
              <Label htmlFor="confirm-2fa-code">Bestätigungscode aus der App</Label>
              <Input
                id="confirm-2fa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={8}
                value={confirmCode}
                onChange={(event) => setConfirmCode(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Aktiviere…" : "2FA aktivieren"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setPendingSetup(null);
                  setConfirmCode("");
                }}
              >
                Abbrechen
              </Button>
            </div>
          </form>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Schütze dein Konto mit TOTP (6-stelliger Code aus einer Authenticator-App).
          </p>
          <Button type="button" disabled={busy} onClick={beginSetup}>
            {busy ? "Starte…" : "2FA einrichten"}
          </Button>
        </>
      )}

      <p className="text-sm text-muted-foreground">
        <Link href={backHref} className="text-primary hover:underline">
          Zurück
        </Link>
      </p>
    </div>
  );
}
