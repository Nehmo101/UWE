"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface MailDraftRow {
  id: string;
  subject: string;
  status: string;
  updatedAt: string;
  worldId: string | null;
}

interface MailCenterDraftsProps {
  drafts: MailDraftRow[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  pending_review: "Zur Prüfung",
  sent: "Gesendet",
};

export function MailCenterDrafts({ drafts }: MailCenterDraftsProps) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createDraft(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(studioApiUrl("/api/mail/drafts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyText }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus(payload.error ?? "Entwurf konnte nicht gespeichert werden.");
        return;
      }
      setSubject("");
      setBodyText("");
      setStatus("Entwurf gespeichert.");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="uwe-mail-center-drafts">
      <section className="uwe-card">
        <h2 className="uwe-section-title">Gespeicherte Entwürfe</h2>
        {drafts.length === 0 ? (
          <p className="uwe-empty">Noch keine Mail-Entwürfe.</p>
        ) : (
          <table className="uwe-table">
            <thead>
              <tr>
                <th>Aktualisiert</th>
                <th>Status</th>
                <th>Betreff</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft) => (
                <tr key={draft.id}>
                  <td>{new Date(draft.updatedAt).toLocaleString("de-DE")}</td>
                  <td>{STATUS_LABELS[draft.status] ?? draft.status}</td>
                  <td>{draft.subject}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="uwe-card uwe-form" style={{ marginTop: "1.5rem" }}>
        <h2 className="uwe-section-title">Neuer Entwurf</h2>
        <p className="uwe-hint">
          Freier Entwurf — Versand über Compose-Flows oder Mail Portal nach Prüfung.
        </p>
        <form onSubmit={(event) => void createDraft(event)}>
          <label>
            Betreff
            <input
              className="uwe-input"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              required
            />
          </label>
          <label>
            Text
            <textarea
              className="uwe-input"
              rows={6}
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
            />
          </label>
          <button type="submit" className="uwe-btn uwe-btn-primary" disabled={loading}>
            {loading ? "Speichern…" : "Entwurf speichern"}
          </button>
        </form>
        {status ? <p className="uwe-notice">{status}</p> : null}
      </section>
    </div>
  );
}
