"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useState } from "react";

interface RecipientOption {
  email: string;
  name: string;
}

interface MailSendFormProps {
  worldId?: string;
  initialSubject: string;
  initialBodyText: string;
  initialBodyHtml?: string;
  sourceType?: string;
  sourceId?: string;
  recipients: RecipientOption[];
  warnings?: string[];
  containsDmOnlyHint?: boolean;
}

export function MailSendForm({
  worldId,
  initialSubject,
  initialBodyText,
  initialBodyHtml,
  sourceType,
  sourceId,
  recipients,
  warnings = [],
  containsDmOnlyHint = false,
}: MailSendFormProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [bodyText, setBodyText] = useState(initialBodyText);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(recipients.map((recipient) => recipient.email)),
  );
  const [confirmDmOnly, setConfirmDmOnly] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleRecipient(email: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    const to = recipients
      .filter((recipient) => selected.has(recipient.email))
      .map((recipient) => ({
        email: recipient.email,
        name: recipient.name || undefined,
      }));

    try {
      const response = await fetch(studioApiUrl("/api/mail/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          bodyText,
          bodyHtml: initialBodyHtml ?? bodyText,
          worldId,
          sourceType,
          sourceId,
          confirmDmOnly,
          containsDmOnlyHint,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      setStatus(
        data.ok ? "Mail gesendet (oder im Mock-Modus protokolliert)." : data.error ?? "Versand fehlgeschlagen.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Anfrage fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="uwe-form">
      {warnings.length > 0 && (
        <div className="uwe-notice" role="alert">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      <label>
        Betreff
        <input value={subject} onChange={(event) => setSubject(event.target.value)} required />
      </label>

      <label>
        Nachricht (Text)
        <textarea
          rows={10}
          value={bodyText}
          onChange={(event) => setBodyText(event.target.value)}
          required
        />
      </label>

      {initialBodyHtml && (
        <details className="uwe-fieldset">
          <summary>HTML-Vorschau</summary>
          <div
            className="uwe-mail-preview"
            dangerouslySetInnerHTML={{ __html: initialBodyHtml }}
          />
        </details>
      )}

      <fieldset className="uwe-fieldset">
        <legend>Empfänger</legend>
        {recipients.length === 0 ? (
          <p className="uwe-empty">Keine Empfänger mit E-Mail-Adresse gefunden.</p>
        ) : (
          recipients.map((recipient) => (
            <label key={recipient.email} className="uwe-checkbox">
              <input
                type="checkbox"
                checked={selected.has(recipient.email)}
                onChange={() => toggleRecipient(recipient.email)}
              />
              {recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email}
            </label>
          ))
        )}
      </fieldset>

      {containsDmOnlyHint && (
        <label className="uwe-checkbox">
          <input
            type="checkbox"
            checked={confirmDmOnly}
            onChange={(event) => setConfirmDmOnly(event.target.checked)}
          />
          Ich bestätige, dass DM-only Inhalte bewusst an die ausgewählten Empfänger gehen dürfen.
        </label>
      )}

      <button
        type="submit"
        className="uwe-btn uwe-btn-primary"
        disabled={loading || selected.size === 0}
      >
        {loading ? "Sende…" : "Mail jetzt senden"}
      </button>

      {status && <p className="uwe-notice">{status}</p>}
    </form>
  );
}
