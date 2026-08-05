"use client";

import { useState } from "react";
import { MemberChecklist } from "../members/MemberChecklist";

/**
 * Kalender-Abos anlegen und widerrufen.
 *
 * Client-Komponente, weil der Klartext-Token genau einmal existiert: er kommt
 * aus der Antwort auf `POST` und bleibt im Speicher der Seite. Über eine
 * Server Action ginge er nur über die URL zurück und stünde damit im
 * Browser-Verlauf und in jedem Zugriffsprotokoll dazwischen.
 */

export interface SubscriptionRow {
  id: string;
  label: string;
  tokenPrefix: string;
  /** Leer = ganzer Haushalt; sonst genau diese Personen. */
  members: { id: string; displayName: string; colour: string }[];
  isActive: boolean;
  lastUsedAt: string | null;
}

export interface SubscriptionMember {
  id: string;
  displayName: string;
  colour: string;
}

export function SubscriptionManager({
  initial,
  members,
  baseUrl,
}: {
  initial: SubscriptionRow[];
  members: SubscriptionMember[];
  /** Öffentliche Adresse der Family-App, für die fertige Abo-URL. */
  baseUrl: string;
}) {
  const [rows, setRows] = useState(initial);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const response = await fetch("/api/v1/calendar/subscriptions");
    if (!response.ok) return;
    const data = (await response.json()) as { subscriptions: SubscriptionRow[] };
    setRows(data.subscriptions);
  }

  async function create(formData: FormData) {
    setBusy(true);
    setError(null);
    setFreshToken(null);
    try {
      const response = await fetch("/api/v1/calendar/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: String(formData.get("label") ?? ""),
          memberIds: formData.getAll("memberIds").map(String),
        }),
      });
      if (!response.ok) {
        setError("Das Abo konnte nicht angelegt werden.");
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
      await fetch(`/api/v1/calendar/subscriptions/${id}`, { method: "PATCH" });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const feedUrl = freshToken ? `${baseUrl}/api/calendar/feed/${freshToken}.ics` : null;

  return (
    <>
      <form action={create} className="family-form family-card">
        <div className="family-form-row">
          <label>
            Bezeichnung
            <input name="label" placeholder="z. B. iPhone von Anna" required />
          </label>
        </div>
        <MemberChecklist
          members={members}
          name="memberIds"
          legend="Auf welche Personen? (nichts angekreuzt = ganzer Haushalt)"
        />
        <div>
          <button type="submit" className="family-btn family-btn-sm" disabled={busy}>
            Abo anlegen
          </button>
        </div>
      </form>

      {error ? <p className="family-callout family-callout-warn">{error}</p> : null}

      {feedUrl ? (
        <div className="family-callout">
          <p>
            <strong>Fertig.</strong> Diese Adresse siehst du nur jetzt — trage sie gleich auf dem
            Handy ein:
          </p>
          <p>
            <code style={{ wordBreak: "break-all" }}>{feedUrl}</code>
          </p>
          <p className="family-muted">
            iPhone: Einstellungen → Apps → Kalender → Accounts → Account hinzufügen → Andere →
            Kalenderabo hinzufügen. Danach ist die Adresse nicht mehr abrufbar; verloren heißt neu
            anlegen.
          </p>
        </div>
      ) : null}

      <ul className="family-list">
        {rows.map((row) => (
          <li key={row.id} className="family-row">
            <div className="family-row-head">
              <strong>{row.label}</strong>
              <span className="family-tag">
                {row.members.length > 0
                  ? row.members.map((member) => member.displayName).join(", ")
                  : "ganzer Haushalt"}
              </span>
              <code className="family-muted">{row.tokenPrefix}…</code>
              {row.isActive ? null : <span className="family-tag family-tag-warn">widerrufen</span>}
              <span className="family-muted">
                {row.lastUsedAt
                  ? `zuletzt abgerufen ${new Date(row.lastUsedAt).toLocaleString("de-DE")}`
                  : "noch nie abgerufen"}
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
        <p className="family-muted">Noch kein Abo. Lege eins an, um den Kalender aufs Handy zu holen.</p>
      ) : null}
    </>
  );
}
