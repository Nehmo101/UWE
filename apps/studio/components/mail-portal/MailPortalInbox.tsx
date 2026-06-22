"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { MAIL_PRIORITY_LABELS, MAIL_REPLY_TONE_LABELS, type MailReplyTone } from "@uwe/mail/portal-types";

interface MailMessageSummary {
  id: string;
  subject: string;
  fromAddress: string;
  snippet: string | null;
  receivedAt: string;
  isRead: boolean;
  accountLabel?: string;
  priority?: {
    category: keyof typeof MAIL_PRIORITY_LABELS;
    priority: number;
    explanation: string;
  } | null;
}

interface MailPortalInboxProps {
  messages: MailMessageSummary[];
  selectedId?: string | null;
  selectedMessage?: {
    id: string;
    subject: string;
    fromAddress: string;
    bodyText: string | null;
    bodyHtml: string | null;
    attachments: Array<{ id: string; filename: string; sizeBytes: number }>;
    aiActions: Array<{ kind: string; outputText: string | null; tone: string | null }>;
    priority?: {
      category: keyof typeof MAIL_PRIORITY_LABELS;
      priority: number;
      explanation: string;
    } | null;
  } | null;
}

export function MailPortalInbox({ messages, selectedId, selectedMessage }: MailPortalInboxProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [tone, setTone] = useState<MailReplyTone>("professional");

  function openMessage(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("message", id);
    router.push(`/admin/mail?${params.toString()}`);
  }

  async function runAi(path: string, body: Record<string, unknown>) {
    setStatus(null);
    const response = await fetch(studioApiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(payload.error ?? "Aktion fehlgeschlagen.");
      return;
    }
    setStatus("Fertig — Seite wird aktualisiert.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="uwe-mail-portal-layout">
      <section className="uwe-mail-portal-list uwe-card">
        <h2 className="uwe-section-title">Smart Inbox</h2>
        <form
          className="uwe-inline-actions"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const q = String(form.get("q") ?? "");
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            router.push(`/admin/mail?${params.toString()}`);
          }}
        >
          <input className="uwe-input" name="q" placeholder="Suche…" defaultValue={searchParams.get("q") ?? ""} />
          <button className="uwe-btn uwe-btn-secondary uwe-btn-sm" type="submit">
            Suchen
          </button>
        </form>

        <ul className="uwe-mail-message-list">
          {messages.length === 0 ? (
            <li className="uwe-dashboard-muted">Keine Nachrichten — Konto verbinden und Sync starten.</li>
          ) : (
            messages.map((message) => (
              <li key={message.id}>
                <button
                  type="button"
                  className={`uwe-mail-message-item${selectedId === message.id ? " active" : ""}${message.isRead ? "" : " unread"}`}
                  onClick={() => openMessage(message.id)}
                >
                  <span className="uwe-mail-message-subject">{message.subject || "(Ohne Betreff)"}</span>
                  <span className="uwe-dashboard-muted">{message.fromAddress}</span>
                  {message.priority ? (
                    <span className="uwe-badge">
                      {MAIL_PRIORITY_LABELS[message.priority.category]} ({message.priority.priority})
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="uwe-mail-portal-reader uwe-card">
        {!selectedMessage ? (
          <p className="uwe-dashboard-muted">Wähle eine Nachricht zum Lesen.</p>
        ) : (
          <>
            <header className="uwe-mail-reader-header">
              <h2>{selectedMessage.subject || "(Ohne Betreff)"}</h2>
              <p className="uwe-dashboard-muted">{selectedMessage.fromAddress}</p>
              {selectedMessage.priority ? (
                <p className="uwe-mail-priority-explain">
                  <strong>{MAIL_PRIORITY_LABELS[selectedMessage.priority.category]}</strong> —{" "}
                  {selectedMessage.priority.explanation}
                </p>
              ) : null}
            </header>

            <article className="uwe-mail-reader-body">
              {selectedMessage.bodyText ? (
                <pre className="uwe-mail-plain">{selectedMessage.bodyText}</pre>
              ) : selectedMessage.bodyHtml ? (
                <pre className="uwe-mail-plain">{selectedMessage.bodyHtml}</pre>
              ) : (
                <p className="uwe-dashboard-muted">Kein Inhalt synchronisiert.</p>
              )}
            </article>

            {selectedMessage.attachments.length > 0 ? (
              <ul className="uwe-mail-attachments">
                {selectedMessage.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    {attachment.filename} ({Math.round(attachment.sizeBytes / 1024)} KB)
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="uwe-inline-actions">
              <button
                type="button"
                className="uwe-btn uwe-btn-secondary uwe-btn-sm"
                disabled={pending}
                onClick={() => runAi("/api/admin/mail/prioritize", { messageId: selectedMessage.id })}
              >
                Priorisieren
              </button>
              <button
                type="button"
                className="uwe-btn uwe-btn-secondary uwe-btn-sm"
                disabled={pending}
                onClick={() => runAi("/api/admin/mail/ai/summarize", { messageId: selectedMessage.id })}
              >
                KI-Zusammenfassung
              </button>
              <select
                className="uwe-input uwe-input-inline"
                value={tone}
                onChange={(e) => setTone(e.target.value as MailReplyTone)}
                aria-label="Tonalität"
              >
                {Object.entries(MAIL_REPLY_TONE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="uwe-btn uwe-btn-primary uwe-btn-sm"
                disabled={pending}
                onClick={() =>
                  runAi("/api/admin/mail/ai/reply-draft", {
                    messageId: selectedMessage.id,
                    tone,
                  })
                }
              >
                Antwortentwurf
              </button>
            </div>

            {selectedMessage.aiActions.length > 0 ? (
              <section className="uwe-section">
                <h3 className="uwe-section-title">KI-Aktionen</h3>
                <ul className="uwe-list-plain">
                  {selectedMessage.aiActions.map((action, index) => (
                    <li key={`${action.kind}-${index}`}>
                      <strong>{action.kind}</strong>
                      {action.outputText ? <p>{action.outputText}</p> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {status ? <p className="uwe-dashboard-muted">{status}</p> : null}
          </>
        )}
      </section>
    </div>
  );
}
