"use client";

import Link from "next/link";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface MailAccountOption {
  id: string;
  label: string;
  lastImapSyncAt: string | null;
  imapSyncError: string | null;
}

interface InboxMessage {
  id: string;
  accountId: string;
  accountLabel: string;
  subject: string;
  fromAddress: string;
  snippet: string | null;
  receivedAt: string;
  isRead: boolean;
}

interface MailCenterInboxProps {
  accounts: MailAccountOption[];
  initialMessages: InboxMessage[];
}

export function MailCenterInbox({ accounts, initialMessages }: MailCenterInboxProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");

  async function syncInbox() {
    if (!accountId) {
      setStatus("Zuerst ein IMAP-Konto unter Einrichtung anlegen.");
      return;
    }
    setStatus(null);
    const response = await fetch(studioApiUrl("/api/mail/inbox/sync"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, limit: 50 }),
    });
    const payload = (await response.json()) as { error?: string; jobId?: string };
    if (!response.ok) {
      setStatus(payload.error ?? "Sync fehlgeschlagen.");
      return;
    }
    setStatus(`Sync-Job ${payload.jobId ?? ""} gestartet — Seite wird aktualisiert.`);
    startTransition(() => router.refresh());
  }

  if (accounts.length === 0) {
    return (
      <section className="uwe-card">
        <h2 className="uwe-section-title">Posteingang</h2>
        <p className="uwe-dashboard-muted">
          Noch kein IMAP-Konto konfiguriert. Lege unter{" "}
          <Link href="/mail?tab=setup">Einrichtung</Link> oder im{" "}
          <Link href="/admin/mail">Mail Portal</Link> ein Konto an.
        </p>
      </section>
    );
  }

  return (
    <section className="uwe-card">
      <h2 className="uwe-section-title">Posteingang</h2>
      <p className="uwe-hint">
        Synchronisierte IMAP-Nachrichten. Für KI-Zusammenfassung und Smart Inbox:{" "}
        <Link href="/admin/mail">Mail Portal</Link>.
      </p>

      <div className="uwe-inline-actions" style={{ marginBottom: "1rem" }}>
        <label>
          Konto
          <select
            className="uwe-input"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="uwe-btn uwe-btn-primary"
          disabled={pending}
          onClick={() => void syncInbox()}
        >
          {pending ? "Synchronisiere…" : "IMAP synchronisieren"}
        </button>
      </div>

      {status ? <p className="uwe-notice">{status}</p> : null}

      {initialMessages.length === 0 ? (
        <p className="uwe-empty">Noch keine Nachrichten — IMAP-Sync starten.</p>
      ) : (
        <ul className="uwe-list-cards">
          {initialMessages.map((message) => (
            <li key={message.id} className="uwe-list-card">
              <div className="uwe-inline-actions">
                <strong>{message.subject || "(Ohne Betreff)"}</strong>
                {!message.isRead ? <span className="uwe-badge">Neu</span> : null}
              </div>
              <p className="uwe-dashboard-muted">
                {message.fromAddress} · {message.accountLabel}
              </p>
              {message.snippet ? (
                <p className="uwe-dashboard-muted">{message.snippet.slice(0, 160)}</p>
              ) : null}
              <time className="uwe-hint" dateTime={message.receivedAt}>
                {new Date(message.receivedAt).toLocaleString("de-DE")}
              </time>
              <p>
                <Link href={`/admin/mail?message=${message.id}`}>Im Mail Portal öffnen</Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
