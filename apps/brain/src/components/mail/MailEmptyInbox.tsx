"use client";

import * as React from "react";
import { MailButton } from "./mail-ui";
import { NavIcon } from "@uwe/shared-ui";

interface MailEmptyInboxProps {
  hasAccounts: boolean;
  syncing: boolean;
  autoSyncEnabled?: boolean;
  syncProgress?: { processed: number; total: number; label: string } | null;
  onOpenTriage: () => void;
  onCompose: () => void;
  onSync: () => void;
}

export function MailEmptyInbox({
  hasAccounts,
  syncing,
  autoSyncEnabled = false,
  syncProgress,
  onOpenTriage,
  onCompose,
  onSync,
}: MailEmptyInboxProps) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--uwe-bg)",
        padding: 40,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 430 }}>
        <div
          style={{
            width: 66,
            height: 66,
            borderRadius: 999,
            margin: "0 auto 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "color-mix(in srgb, var(--uwe-success) 15%, transparent)",
            color: "var(--uwe-success)",
          }}
        >
          <NavIcon name="inbox" width={30} height={30} />
        </div>
        <h2 style={{ fontFamily: "var(--uwe-font-serif)", fontSize: 23, color: "var(--uwe-fg)", margin: "0 0 9px" }}>
          {hasAccounts ? "Posteingang leer — starke Arbeit." : "Noch kein Postfach verbunden."}
        </h2>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--uwe-fg-muted)", lineHeight: 1.6 }}>
          {hasAccounts
            ? "Keine offenen Nachrichten. Starte einen IMAP-Sync, um neue Mails zu laden, oder verfasse eine Nachricht."
            : "Lege unter Einstellungen ein IMAP/SMTP-Konto an, um Nachrichten zu synchronisieren."}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
          {hasAccounts ? (
            <MailButton variant="accent" icon="refresh-cw" onClick={onSync} disabled={syncing}>
              {syncing ? "Synchronisiere…" : "Jetzt synchronisieren"}
            </MailButton>
          ) : (
            <MailButton variant="accent" icon="sparkles" onClick={onOpenTriage}>
              KI-Triage öffnen
            </MailButton>
          )}
          <MailButton variant="secondary" icon="pen-line" onClick={onCompose}>
            Verfassen
          </MailButton>
        </div>
        {syncProgress ? (
          <div style={{ marginTop: 16, maxWidth: 320, marginInline: "auto" }}>
            <div style={{ fontSize: 12, color: "var(--uwe-fg-muted)", marginBottom: 6 }}>{syncProgress.label}</div>
            <div style={{ height: 4, borderRadius: 999, background: "var(--uwe-border-muted)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: "45%", background: "var(--uwe-accent)" }} />
            </div>
          </div>
        ) : null}
        <div style={{ marginTop: 18, fontSize: 11, color: "var(--uwe-fg-subtle)" }}>
          {/* Der Auto-Sync-Schalter sitzt in Studios Einstellungen, nicht hier —
              der Host-Timer gehört zum Betrieb. Also nur den Zustand nennen und
              nicht auf eine Stelle zeigen, die es in Brain nicht gibt. */}
          {autoSyncEnabled ? "Auto-Sync aktiv" : "Auto-Sync aus"} · nichts verlässt deinen Host
        </div>
      </div>
    </div>
  );
}
