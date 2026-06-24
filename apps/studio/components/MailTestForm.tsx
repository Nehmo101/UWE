"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useState } from "react";

interface MailTestFormProps {
  defaultEmail?: string;
}

export function MailTestForm({ defaultEmail = "" }: MailTestFormProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch(studioApiUrl("/api/mail/test"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      setStatus(
        data.ok
          ? "Testmail gesendet (oder im Mock-Modus protokolliert)."
          : data.error ?? "Testmail fehlgeschlagen.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Anfrage fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="uwe-form">
      <h2>Testmail senden</h2>
      <p className="uwe-hint">
        Versand nur nach explizitem Klick. Keine automatischen Mails.
      </p>
      <label>
        Empfänger
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          placeholder="dm@example.org"
        />
      </label>
      <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary" disabled={loading}>
        {loading ? "Sende…" : "Testmail senden"}
      </button>
      {status && <p className="uwe-notice">{status}</p>}
    </form>
  );
}
