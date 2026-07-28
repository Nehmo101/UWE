"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MAIL_PROVIDER_PRESETS, type MailProviderPreset } from "@uwe/mail/portal-types";
import { MailButton, IconButton, Dot } from "./mail-ui";
import type { MailAccountVM } from "./mail-types";

/**
 * Full IMAP/SMTP account management, embedded in the Mail Center settings so the
 * whole flow lives under /mail (replaces the standalone /admin/mail portal).
 * Uses the existing /api/mail/accounts routes.
 */
export function MailAccountManager({ accounts }: { accounts: MailAccountVM[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = React.useState(accounts.length === 0);
  const [preset, setPreset] = React.useState<MailProviderPreset>("generic");
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const defaults = MAIL_PROVIDER_PRESETS[preset];

  async function runAccountAction(path: string, method: "POST" | "DELETE", body?: Record<string, unknown>) {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(path, {
        method,
        ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string; imported?: number };
      setStatus(
        response.ok
          ? (payload.message ?? (typeof payload.imported === "number" ? `${payload.imported} Nachrichten synchronisiert` : "OK"))
          : (payload.error ?? "Aktion fehlgeschlagen."),
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/mail/accounts", {
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
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setStatus(payload.error ?? "Konto konnte nicht angelegt werden.");
        return;
      }
      (event.target as HTMLFormElement).reset();
      setShowForm(false);
      setStatus("Konto gespeichert.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    fontSize: 12.5,
    color: "var(--uwe-fg)",
    background: "var(--uwe-card-bg)",
    border: "1px solid var(--uwe-border)",
    borderRadius: 8,
    padding: "6px 9px",
    fontFamily: "inherit",
    width: "100%",
  };

  return (
    <div>
      {accounts.length === 0 ? (
        <p style={{ margin: "4px 0 12px", fontSize: 12.5, color: "var(--uwe-fg-subtle)" }}>Noch kein Konto verbunden.</p>
      ) : (
        accounts.map((account) => (
          <div
            key={account.id}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--uwe-border-muted)" }}
          >
            <Dot color={account.ok ? "var(--uwe-success)" : "var(--uwe-danger)"} size={9} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: "var(--uwe-fg)" }}>{account.email}</div>
              <div style={{ fontSize: 11.5, color: "var(--uwe-fg-subtle)" }}>
                IMAP · SMTP · {account.imapHost ?? account.smtpHost ?? "—"}
                {account.imapSyncError ? ` · Fehler: ${account.imapSyncError}` : ""}
              </div>
            </div>
            <MailButton
              variant="subtle"
              size="sm"
              onClick={() => void runAccountAction(`/api/mail/accounts/${account.id}/test`, "POST")}
              disabled={busy}
            >
              Test
            </MailButton>
            <MailButton
              variant="subtle"
              size="sm"
              onClick={() => void runAccountAction("/api/mail/sync", "POST", { accountId: account.id })}
              disabled={busy}
            >
              Sync
            </MailButton>
            <IconButton
              icon="trash-2"
              size={14}
              tone="danger"
              title="Konto löschen"
              onClick={() => void runAccountAction(`/api/mail/accounts/${account.id}`, "DELETE")}
              disabled={busy}
            />
          </div>
        ))
      )}

      {status ? <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--uwe-fg-muted)" }}>{status}</div> : null}

      <div style={{ marginTop: 12 }}>
        {showForm ? (
          <form onSubmit={createAccount} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <select value={preset} onChange={(e) => setPreset(e.target.value as MailProviderPreset)} style={inputStyle}>
              {Object.entries(MAIL_PROVIDER_PRESETS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
            <input name="label" required placeholder="Bezeichnung (Privat / Firma)" style={inputStyle} />
            <input name="username" type="email" required autoComplete="username" placeholder="E-Mail / Benutzername" style={inputStyle} />
            <input name="password" type="password" required autoComplete="new-password" placeholder="Passwort / App-Passwort" style={inputStyle} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input name="imapHost" defaultValue={defaults.imapHost} placeholder="IMAP-Host" style={inputStyle} />
              <input name="imapPort" type="number" defaultValue={defaults.imapPort} placeholder="IMAP-Port" style={inputStyle} />
              <input name="smtpHost" defaultValue={defaults.smtpHost} required placeholder="SMTP-Host" style={inputStyle} />
              <input name="smtpPort" type="number" defaultValue={defaults.smtpPort} placeholder="SMTP-Port" style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <MailButton variant="accent" size="sm" icon="check" disabled={busy}>
                {busy ? "…" : "Konto speichern"}
              </MailButton>
              {accounts.length > 0 ? (
                <MailButton variant="subtle" size="sm" onClick={() => setShowForm(false)} disabled={busy}>
                  Abbrechen
                </MailButton>
              ) : null}
            </div>
          </form>
        ) : (
          <MailButton variant="subtle" size="sm" icon="plus" onClick={() => setShowForm(true)}>
            Konto hinzufügen
          </MailButton>
        )}
      </div>
    </div>
  );
}
