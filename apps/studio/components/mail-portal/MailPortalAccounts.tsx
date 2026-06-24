"use client";

import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MAIL_PROVIDER_PRESETS, type MailProviderPreset } from "@uwe/mail/portal-types";

interface MailAccountRow {
  id: string;
  label: string;
  providerPreset: string;
  username: string;
  lastImapSyncAt: Date | string | null;
  imapSyncError: string | null;
}

export function MailPortalAccountForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<MailProviderPreset>("generic");
  const defaults = MAIL_PROVIDER_PRESETS[preset];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    const response = await fetch(studioApiUrl("/api/admin/mail/accounts"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: form.get("label"),
        providerPreset: preset,
        username: form.get("username"),
        password: form.get("password"),
        imapHost: form.get("imapHost") || defaults.imapHost,
        imapPort: Number(form.get("imapPort") || defaults.imapPort),
        smtpHost: form.get("smtpHost") || defaults.smtpHost,
        smtpPort: Number(form.get("smtpPort") || defaults.smtpPort),
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Konto konnte nicht angelegt werden.");
      return;
    }

    startTransition(() => router.refresh());
    event.currentTarget.reset();
  }

  return (
    <form className="uwe-form uwe-v2-card" onSubmit={handleSubmit}>
      <h3 className="uwe-v2-section-title">Mailkonto hinzufügen</h3>
      {error ? (
        <p className="uwe-form-error" role="alert">
          {error}
        </p>
      ) : null}

      <label>
        Provider
        <select
          className="uwe-input"
          value={preset}
          onChange={(e) => setPreset(e.target.value as MailProviderPreset)}
        >
          {Object.entries(MAIL_PROVIDER_PRESETS).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Bezeichnung
        <input className="uwe-input" name="label" required placeholder="Privat / Firma" />
      </label>

      <label>
        Benutzername / E-Mail
        <input className="uwe-input" name="username" type="email" required autoComplete="username" />
      </label>

      <label>
        Passwort / App-Passwort
        <input
          className="uwe-input"
          name="password"
          type="password"
          required
          autoComplete="new-password"
        />
      </label>

      <div className="uwe-form-grid">
        <label>
          IMAP-Host
          <input
            className="uwe-input"
            name="imapHost"
            defaultValue={defaults.imapHost}
            placeholder="imap.example.com"
          />
        </label>
        <label>
          IMAP-Port
          <input className="uwe-input" name="imapPort" type="number" defaultValue={defaults.imapPort} />
        </label>
        <label>
          SMTP-Host
          <input
            className="uwe-input"
            name="smtpHost"
            defaultValue={defaults.smtpHost}
            required
            placeholder="smtp.example.com"
          />
        </label>
        <label>
          SMTP-Port
          <input className="uwe-input" name="smtpPort" type="number" defaultValue={defaults.smtpPort} />
        </label>
      </div>

      <button className="uwe-v2-btn uwe-v2-btn-primary" type="submit" disabled={pending}>
        {pending ? "Speichern…" : "Konto speichern"}
      </button>
    </form>
  );
}

interface MailPortalAccountsPanelProps {
  accounts: MailAccountRow[];
}

export function MailPortalAccountsPanel({ accounts }: MailPortalAccountsPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function runAction(path: string, method: "POST" | "DELETE" = "POST") {
    setMessage(null);
    const response = await fetch(studioApiUrl(path), { method });
    const payload = (await response.json()) as { message?: string; error?: string };
    setMessage(payload.message ?? payload.error ?? (response.ok ? "OK" : "Fehler"));
    startTransition(() => router.refresh());
  }

  return (
    <section className="uwe-v2-section">
      <h2 className="uwe-v2-section-title">Konten</h2>
      {message ? <p className="uwe-dashboard-muted">{message}</p> : null}
      {accounts.length === 0 ? (
        <p className="uwe-dashboard-muted">Noch keine Mailkonten verbunden.</p>
      ) : (
        <ul className="uwe-list-cards">
          {accounts.map((account) => (
            <li key={account.id} className="uwe-v2-card">
              <strong>{account.label}</strong>
              <span className="uwe-dashboard-muted">{account.username}</span>
              <span className="uwe-dashboard-muted">
                Sync:{" "}
                {account.lastImapSyncAt
                  ? new Date(account.lastImapSyncAt).toLocaleString("de-DE")
                  : "nie"}
                {account.imapSyncError ? ` — Fehler: ${account.imapSyncError}` : ""}
              </span>
              <div className="uwe-inline-actions">
                <button
                  type="button"
                  className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
                  disabled={pending}
                  onClick={() => runAction(`/api/admin/mail/accounts/${account.id}/test`)}
                >
                  Verbindung testen
                </button>
                <button
                  type="button"
                  className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
                  disabled={pending}
                  onClick={async () => {
                    setMessage(null);
                    const response = await fetch(studioApiUrl("/api/admin/mail/sync"), {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ accountId: account.id }),
                    });
                    const payload = (await response.json()) as {
                      imported?: number;
                      error?: string;
                    };
                    setMessage(
                      response.ok
                        ? `${payload.imported ?? 0} Nachrichten synchronisiert`
                        : (payload.error ?? "Sync fehlgeschlagen"),
                    );
                    startTransition(() => router.refresh());
                  }}
                >
                  Sync
                </button>
                <button
                  type="button"
                  className="uwe-v2-btn uwe-v2-btn-danger uwe-v2-btn-sm"
                  disabled={pending}
                  onClick={() => runAction(`/api/admin/mail/accounts/${account.id}`, "DELETE")}
                >
                  Löschen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
