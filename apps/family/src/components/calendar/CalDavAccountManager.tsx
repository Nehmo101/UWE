"use client";

import { useState } from "react";

/**
 * CalDAV-Zugänge für den iPhone-Kalender anlegen und widerrufen.
 *
 * Client-Komponente aus demselben Grund wie der `SubscriptionManager`: der
 * Klartext-Token existiert genau einmal — in der Antwort auf `POST` — und
 * bleibt im Speicher der Seite statt in einer URL.
 */

export interface CalDavAccountRow {
  id: string;
  label: string;
  tokenPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
}

export function CalDavAccountManager({
  initial,
  serverHost,
}: {
  initial: CalDavAccountRow[];
  /** Öffentlicher Hostname der Family-App, für die Einrichtungs-Anleitung. */
  serverHost: string;
}) {
  const [rows, setRows] = useState(initial);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const response = await fetch("/api/v1/calendar/caldav-accounts");
    if (!response.ok) return;
    const data = (await response.json()) as { accounts: CalDavAccountRow[] };
    setRows(data.accounts);
  }

  async function create(formData: FormData) {
    setBusy(true);
    setError(null);
    setFreshToken(null);
    try {
      const response = await fetch("/api/v1/calendar/caldav-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: String(formData.get("label") ?? "") }),
      });
      if (!response.ok) {
        setError("Der Zugang konnte nicht angelegt werden.");
        return;
      }
      const data = (await response.json()) as { token: string };
      setFreshToken(data.token);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/v1/calendar/caldav-accounts/${id}`, { method: "PATCH" });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form action={create} className="family-form family-card">
        <div className="family-form-row">
          <label>
            Bezeichnung
            <input name="label" placeholder="z. B. iPhone von Anna" required />
          </label>
        </div>
        <div>
          <button type="submit" className="family-btn family-btn-sm" disabled={busy}>
            Zugang anlegen
          </button>
        </div>
      </form>

      {error ? <p className="family-callout family-callout-warn">{error}</p> : null}

      {freshToken ? (
        <div className="family-callout">
          <p>
            <strong>Fertig.</strong> Dieses Passwort siehst du nur jetzt — richte den Account gleich
            auf dem Handy ein:
          </p>
          <p>
            <code style={{ wordBreak: "break-all" }}>{freshToken}</code>
          </p>
          <p className="family-muted">
            iPhone: Einstellungen → Apps → Kalender → Accounts → Account hinzufügen → Andere →
            CalDAV-Account hinzufügen. Server: <code>{serverHost}</code>, Benutzername:{" "}
            <code>familie</code>, Passwort: das Passwort oben. Danach ist es nicht mehr abrufbar;
            verloren heißt neu anlegen.
          </p>
        </div>
      ) : null}

      <ul className="family-list">
        {rows.map((row) => (
          <li key={row.id} className="family-row">
            <div className="family-row-head">
              <strong>{row.label}</strong>
              <code className="family-muted">{row.tokenPrefix}…</code>
              {row.isActive ? null : <span className="family-tag family-tag-warn">widerrufen</span>}
              <span className="family-muted">
                {row.lastUsedAt
                  ? `zuletzt benutzt ${new Date(row.lastUsedAt).toLocaleString("de-DE")}`
                  : "noch nie benutzt"}
              </span>
              {row.isActive ? (
                <button
                  type="button"
                  className="family-btn family-btn-ghost family-btn-sm"
                  style={{ marginLeft: "auto" }}
                  onClick={() => void revoke(row.id)}
                  disabled={busy}
                >
                  Widerrufen
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? (
        <p className="family-muted">
          Noch kein Zugang. Lege einen an, um Termine auf dem Handy anzulegen und zu ändern.
        </p>
      ) : null}
    </>
  );
}
