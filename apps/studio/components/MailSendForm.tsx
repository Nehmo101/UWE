"use client";

import { sanitizeHtml } from "@/src/lib/sanitize-html";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useEffect, useMemo, useRef, useState } from "react";

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
  /** When set, subject/body are auto-saved to localStorage under this key. */
  draftStorageKey?: string;
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
  draftStorageKey,
}: MailSendFormProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [bodyText, setBodyText] = useState(initialBodyText);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(recipients.map((recipient) => recipient.email)),
  );
  const [confirmDmOnly, setConfirmDmOnly] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const previewHtml = useMemo(
    () => (initialBodyHtml ? sanitizeHtml(initialBodyHtml) : ""),
    [initialBodyHtml],
  );

  useEffect(() => {
    if (!draftStorageKey) return;
    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as { subject?: string; bodyText?: string };
      if (typeof draft.subject === "string") setSubject(draft.subject);
      if (typeof draft.bodyText === "string") setBodyText(draft.bodyText);
    } catch {
      // ignore corrupt draft
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftStorageKey) return;
    dirtyRef.current =
      subject !== initialSubject.trim() || bodyText !== initialBodyText.trim();
  }, [draftStorageKey, subject, bodyText, initialSubject, initialBodyText]);

  useEffect(() => {
    if (!draftStorageKey) return;

    const saveDraft = () => {
      try {
        window.localStorage.setItem(
          draftStorageKey,
          JSON.stringify({ subject, bodyText, savedAt: new Date().toISOString() }),
        );
        setDraftSavedAt(new Date().toLocaleTimeString("de-DE"));
      } catch {
        // ignore quota errors
      }
    };

    const interval = window.setInterval(saveDraft, 30_000);
    return () => window.clearInterval(interval);
  }, [draftStorageKey, subject, bodyText]);

  useEffect(() => {
    if (!draftStorageKey) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [draftStorageKey]);

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

      {draftStorageKey ? (
        <p className="uwe-hint">
          Entwurf wird lokal gespeichert{draftSavedAt ? ` (zuletzt ${draftSavedAt})` : ""}.
        </p>
      ) : null}

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

      {previewHtml && (
        <details className="uwe-fieldset">
          <summary>HTML-Vorschau</summary>
          <div
            className="uwe-mail-preview"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </details>
      )}

      <fieldset className="uwe-fieldset">
        <legend>Empfänger</legend>
        {recipients.length === 0 ? (
          <p className="uwe-v2-empty">Keine Empfänger mit E-Mail-Adresse gefunden.</p>
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
        className="uwe-v2-btn uwe-v2-btn-primary"
        disabled={loading || selected.size === 0}
      >
        {loading ? "Sende…" : "Mail jetzt senden"}
      </button>

      {status && <p className="uwe-notice">{status}</p>}
    </form>
  );
}
