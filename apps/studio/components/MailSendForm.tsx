"use client";

import { sanitizeHtml } from "@/src/lib/sanitize-html";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Input, Label, Textarea } from "@/src/components/ui";

/** TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */
const CHECKBOX_ROW_CLASS = "flex items-center gap-2 text-sm";
const CHECKBOX_CLASS = "size-4 rounded border-input";

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
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl flex-col gap-4">
      {warnings.length > 0 && (
        <Alert tone="warning" role="alert">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </Alert>
      )}

      {draftStorageKey ? (
        <p className="text-sm text-muted-foreground">
          Entwurf wird lokal gespeichert{draftSavedAt ? ` (zuletzt ${draftSavedAt})` : ""}.
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mail-send-subject">Betreff</Label>
        <Input
          id="mail-send-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mail-send-body">Nachricht (Text)</Label>
        <Textarea
          id="mail-send-body"
          rows={10}
          value={bodyText}
          onChange={(event) => setBodyText(event.target.value)}
          required
        />
      </div>

      {previewHtml && (
        <details className="rounded-[var(--radius)] border border-border bg-card px-3 py-2">
          <summary className="cursor-pointer font-semibold">HTML-Vorschau</summary>
          <div
            className="mt-3 rounded-[var(--radius)] border border-border p-3 text-sm"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </details>
      )}

      <fieldset className="flex flex-col gap-3 rounded-[var(--radius)] border border-border p-4">
        <legend className="px-1 text-sm text-muted-foreground">Empfänger</legend>
        {recipients.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">Keine Empfänger mit E-Mail-Adresse gefunden.</p>
        ) : (
          recipients.map((recipient) => (
            <label key={recipient.email} className={CHECKBOX_ROW_CLASS}>
              <input
                type="checkbox"
                checked={selected.has(recipient.email)}
                onChange={() => toggleRecipient(recipient.email)}
                className={CHECKBOX_CLASS}
              />
              {recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email}
            </label>
          ))
        )}
      </fieldset>

      {containsDmOnlyHint && (
        <label className={CHECKBOX_ROW_CLASS}>
          <input
            type="checkbox"
            checked={confirmDmOnly}
            onChange={(event) => setConfirmDmOnly(event.target.checked)}
            className={CHECKBOX_CLASS}
          />
          Ich bestätige, dass DM-only Inhalte bewusst an die ausgewählten Empfänger gehen dürfen.
        </label>
      )}

      <Button type="submit" disabled={loading || selected.size === 0} className="self-start">
        {loading ? "Sende…" : "Mail jetzt senden"}
      </Button>

      {status && <Alert tone="success">{status}</Alert>}
    </form>
  );
}
