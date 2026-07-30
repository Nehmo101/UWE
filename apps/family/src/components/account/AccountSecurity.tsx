"use client";

import { useCallback, useEffect, useState } from "react";
import { isPasskeySupported, registerPasskey } from "@uwe/shared-ui";

/**
 * Konto-Sicherheit in Family: Passwort, Zwei-Faktor, FaceID/Passkey.
 *
 * Die Abläufe dahinter sind dieselben wie in Portal und Studio — die
 * Route-Handler kommen aus `@uwe/auth` und `@uwe/passkeys`, der Client-Helfer
 * aus `@uwe/shared-ui`. Nur die Oberfläche ist eigen: Family baut nicht auf
 * den shadcn-Primitives der anderen Apps, sondern auf eigenen CSS-Klassen, und
 * diese Duplikation ist im Repo bewusst eingefroren
 * (`scripts/ui-primitive-sync.test.ts`).
 *
 * Der Punkt der ganzen Seite: wer ausschliesslich Family nutzt, richtet hier
 * alles ein — ohne je Portal oder Studio zu öffnen.
 */

interface TwoFactorStatus {
  enabled: boolean;
}

interface PasskeyCredential {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function Notice({ kind, children }: { kind: "ok" | "warn"; children: React.ReactNode }) {
  return (
    <p className={kind === "warn" ? "family-callout family-callout-warn" : "family-callout"}>
      {children}
    </p>
  );
}

export function AccountSecurity({ passkeysEnabled }: { passkeysEnabled: boolean }) {
  return (
    <>
      <PasswordSection />
      <TwoFactorSection />
      {passkeysEnabled ? (
        <PasskeySection />
      ) : (
        <section className="family-section">
          <h2>FaceID und Fingerabdruck</h2>
          <p className="family-muted">
            Passkeys sind in den Systemeinstellungen abgeschaltet. Der Owner kann sie im Command
            Center freischalten.
          </p>
        </section>
      )}
    </>
  );
}

function PasswordSection() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);

  async function submit(formData: FormData) {
    const newPassword = String(formData.get("newPassword") ?? "");
    const repeat = String(formData.get("repeatPassword") ?? "");

    if (newPassword !== repeat) {
      setMessage({ kind: "warn", text: "Die beiden neuen Passwörter stimmen nicht überein." });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          currentPassword: String(formData.get("currentPassword") ?? ""),
          newPassword,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      setMessage(
        response.ok
          ? { kind: "ok", text: "Passwort geändert." }
          : { kind: "warn", text: payload?.error ?? "Das Passwort konnte nicht geändert werden." },
      );
    } catch {
      setMessage({ kind: "warn", text: "Keine Verbindung zum Server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="family-section">
      <h2>Passwort</h2>
      <form action={submit} className="family-form family-card">
        <label>
          Aktuelles Passwort
          <input type="password" name="currentPassword" autoComplete="current-password" required />
        </label>
        <div className="family-form-row">
          <label>
            Neues Passwort
            <input type="password" name="newPassword" autoComplete="new-password" required />
          </label>
          <label>
            Neues Passwort wiederholen
            <input type="password" name="repeatPassword" autoComplete="new-password" required />
          </label>
        </div>
        <div>
          <button type="submit" className="family-btn family-btn-sm" disabled={busy}>
            Passwort ändern
          </button>
        </div>
      </form>
      {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}
    </section>
  );
}

function TwoFactorSection() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/auth/two-factor", { credentials: "same-origin" });
    if (!response.ok) return;
    setStatus((await response.json()) as TwoFactorStatus);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function start() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/two-factor/setup", {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as {
        secret?: string;
        otpauthUri?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.secret || !payload.otpauthUri) {
        setMessage({ kind: "warn", text: payload?.error ?? "Einrichtung fehlgeschlagen." });
        return;
      }
      setSetup({ secret: payload.secret, otpauthUri: payload.otpauthUri });
    } finally {
      setBusy(false);
    }
  }

  async function activate(formData: FormData) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/two-factor/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code: String(formData.get("code") ?? "") }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage({ kind: "warn", text: payload?.error ?? "Der Code stimmt nicht." });
        return;
      }
      setSetup(null);
      setMessage({ kind: "ok", text: "Zwei-Faktor-Anmeldung ist aktiv." });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function disable(formData: FormData) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/two-factor/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code: String(formData.get("code") ?? "") }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage({ kind: "warn", text: payload?.error ?? "Der Code stimmt nicht." });
        return;
      }
      setMessage({ kind: "ok", text: "Zwei-Faktor-Anmeldung ist abgeschaltet." });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="family-section">
      <h2>Zwei-Faktor-Anmeldung</h2>
      <p className="family-muted">
        Zusätzlich zum Passwort ein Zahlencode aus einer App wie Aegis, 2FAS oder Google
        Authenticator. Schützt das Konto, auch wenn jemand das Passwort kennt.
      </p>

      {status === null ? (
        <p className="family-muted">Wird geladen …</p>
      ) : status.enabled ? (
        <form action={disable} className="family-form family-card">
          <p>
            <span className="family-tag">aktiv</span>
          </p>
          <label>
            Zum Abschalten den aktuellen Code eingeben
            <input name="code" inputMode="numeric" autoComplete="one-time-code" required />
          </label>
          <div>
            <button type="submit" className="family-btn family-btn-ghost family-btn-sm" disabled={busy}>
              Abschalten
            </button>
          </div>
        </form>
      ) : setup ? (
        <form action={activate} className="family-form family-card">
          <p>Diesen Schlüssel in der App eintragen:</p>
          <p>
            <code style={{ wordBreak: "break-all" }}>{setup.secret}</code>
          </p>
          <p className="family-muted">
            Oder die Adresse aus <code>otpauth://</code> scannen, wenn die App das anbietet.
          </p>
          <label>
            Code aus der App
            <input name="code" inputMode="numeric" autoComplete="one-time-code" required />
          </label>
          <div>
            <button type="submit" className="family-btn family-btn-sm" disabled={busy}>
              Aktivieren
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="family-btn family-btn-sm" onClick={start} disabled={busy}>
          Einrichten
        </button>
      )}

      {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}
    </section>
  );
}

function PasskeySection() {
  const [credentials, setCredentials] = useState<PasskeyCredential[]>([]);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);
  const [message, setMessage] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/auth/passkey/credentials", { credentials: "same-origin" });
    if (!response.ok) return;
    const payload = (await response.json()) as { credentials?: PasskeyCredential[] };
    setCredentials(payload.credentials ?? []);
  }, []);

  useEffect(() => {
    setSupported(isPasskeySupported());
    void load();
  }, [load]);

  async function add(formData: FormData) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await registerPasskey({ name: String(formData.get("name") ?? "") });
      setMessage(
        result.ok
          ? { kind: "ok", text: "Passkey gespeichert. Beim nächsten Anmelden reicht FaceID." }
          : { kind: "warn", text: result.error ?? "Der Passkey konnte nicht gespeichert werden." },
      );
      if (result.ok) await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/auth/passkey/credentials/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="family-section">
      <h2>FaceID, Fingerabdruck, Passkey</h2>
      <p className="family-muted">
        Anmelden ohne Passwort — mit dem Gesicht, dem Fingerabdruck oder der Geräte-PIN. Der
        Schlüssel bleibt auf dem Gerät und verlässt es nie.
      </p>

      {!supported ? (
        <Notice kind="warn">
          Dieser Browser unterstützt keine Passkeys. Auf dem iPhone geht es mit Safari.
        </Notice>
      ) : (
        <form action={add} className="family-form family-card">
          <label>
            Name des Geräts
            <input name="name" placeholder="z. B. iPhone von Anna" required />
          </label>
          <div>
            <button type="submit" className="family-btn family-btn-sm" disabled={busy}>
              Dieses Gerät hinzufügen
            </button>
          </div>
        </form>
      )}

      {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}

      <ul className="family-list">
        {credentials.map((credential) => (
          <li key={credential.id} className="family-row">
            <div className="family-row-head">
              <strong>{credential.name}</strong>
              <span className="family-muted">
                {credential.lastUsedAt
                  ? `zuletzt ${new Date(credential.lastUsedAt).toLocaleDateString("de-DE")}`
                  : "noch nie benutzt"}
              </span>
              <button
                type="button"
                className="family-btn family-btn-ghost family-btn-sm"
                style={{ marginLeft: "auto" }}
                onClick={() => void remove(credential.id)}
                disabled={busy}
              >
                Entfernen
              </button>
            </div>
          </li>
        ))}
      </ul>
      {credentials.length === 0 ? (
        <p className="family-muted">Noch kein Gerät hinterlegt.</p>
      ) : null}
    </section>
  );
}
