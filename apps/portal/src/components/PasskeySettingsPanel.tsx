"use client";

import { useCallback, useEffect, useState } from "react";
import { isPasskeySupported, registerPasskey } from "@uwe/shared-ui";
import { Alert } from "@/src/components/ui/states";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

interface PasskeyCredential {
  id: string;
  name: string;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

interface PasskeySettingsPanelProps {
  /** Whether passkey login is enabled in the system settings. */
  enabled: boolean;
  /** Hint shown when the feature toggle is off (differs per app audience). */
  disabledHint?: string;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("de-DE");
}

export function PasskeySettingsPanel({
  enabled,
  // Spielersicht: kein Verweis auf die Kommandozentrale — die steht auf dem Host
  // und geht Spieler nichts an. Wer es einschalten kann, ist die Spielleitung.
  disabledHint = "Passkey-Login ist derzeit deaktiviert. Wende dich an deine Spielleitung.",
}: PasskeySettingsPanelProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [credentials, setCredentials] = useState<PasskeyCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(isPasskeySupported());
  }, []);

  const loadCredentials = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/passkey/credentials", {
        credentials: "same-origin",
      });
      if (!response.ok) {
        setError("Passkeys konnten nicht geladen werden.");
        return;
      }
      const payload = (await response.json()) as { credentials?: PasskeyCredential[] };
      setCredentials(payload.credentials ?? []);
    } catch {
      setError("Passkeys konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void loadCredentials();
    } else {
      setLoading(false);
    }
  }, [enabled, loadCredentials]);

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await registerPasskey({ name: name.trim() || "Passkey" });
      if (!result.ok) {
        if (!result.cancelled) {
          setError(result.error ?? "Der Passkey konnte nicht erstellt werden.");
        }
        return;
      }
      setName("");
      setSuccess("Passkey wurde registriert. Du kannst dich jetzt damit anmelden.");
      await loadCredentials();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(credential: PasskeyCredential) {
    if (!window.confirm(`Passkey „${credential.name}“ wirklich entfernen?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/auth/passkey/credentials/${credential.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Der Passkey konnte nicht entfernt werden.");
        return;
      }
      setSuccess("Passkey wurde entfernt.");
      await loadCredentials();
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return <p className="text-sm text-muted-foreground">{disabledHint}</p>;
  }

  if (supported === false) {
    return (
      <p className="text-sm text-muted-foreground">
        Dieser Browser unterstützt keine Passkeys. Passkeys benötigen HTTPS (oder localhost) und
        ein Gerät mit Face ID, Touch ID, Fingerabdruck oder Windows Hello.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Mit einem Passkey meldest du dich per Face ID, Touch ID, Fingerabdruck oder
        Sicherheitsschlüssel an — ohne Passwort.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Lade Passkeys…</p>
      ) : credentials.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Passkeys registriert.</p>
      ) : (
        <ul className="space-y-2">
          {credentials.map((credential) => (
            <li
              key={credential.id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{credential.name}</p>
                <p className="text-xs text-muted-foreground">
                  Registriert am {formatDate(credential.createdAt)}
                  {credential.lastUsedAt
                    ? ` · Zuletzt verwendet am ${formatDate(credential.lastUsedAt)}`
                    : ""}
                  {credential.backedUp ? " · Synchronisiert" : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void handleDelete(credential)}
              >
                Entfernen
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form className="flex flex-wrap items-end gap-2" onSubmit={handleRegister}>
        <div className="space-y-1.5">
          <Label htmlFor="passkey-name">Name des neuen Passkeys</Label>
          <Input
            id="passkey-name"
            name="passkey-name"
            placeholder="z. B. iPhone, YubiKey"
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy || supported !== true}>
          {busy ? "Registriere…" : "Passkey registrieren"}
        </Button>
      </form>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
    </div>
  );
}
