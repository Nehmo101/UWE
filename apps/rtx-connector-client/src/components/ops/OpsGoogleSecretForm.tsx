import { useState } from "react";

import { opsInvoke } from "../../lib/tauri";
import { toMessage } from "../../lib/connector-runtime-labels";
import { Button } from "../ui/button";

/**
 * Google-Client-Secret — das eine Feld des Google-Logins, das nicht über die
 * generische Einstellungen-Form laufen darf: es wird verschlüsselt abgelegt
 * und nie wieder zurückgelesen. Gleiche Ops-Mechanik wie das SMTP-Passwort;
 * Schalter und Client-ID stehen daneben in der Gruppe „Anmeldung".
 */
export function OpsGoogleSecretForm() {
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(payload: Record<string, unknown>, ok: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await opsInvoke("google-login-set", payload);
      setSecret("");
      setMessage(ok);
    } catch (nextError) {
      setError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="connector-stack">
      {message ? <div className="connector-banner connector-banner-success">{message}</div> : null}
      {error ? <div className="connector-banner connector-banner-error">{error}</div> : null}
      <div className="connector-form-grid">
        <label className="connector-field connector-field-full">
          <span>Google Client-Secret</span>
          <input
            className="connector-input"
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder="aus dem Google-Cloud-Projekt (OAuth-Client)"
          />
          <small>Wird verschlüsselt gespeichert und nie wieder angezeigt.</small>
        </label>
      </div>
      <div className="connector-actions">
        <Button
          variant="primary"
          disabled={busy || secret.trim().length === 0}
          onClick={() => void submit({ googleClientSecret: secret }, "Client-Secret gespeichert.")}
        >
          Secret speichern
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void submit({ clearGoogleClientSecret: true }, "Client-Secret entfernt.")}
        >
          Secret entfernen
        </Button>
      </div>
    </div>
  );
}
