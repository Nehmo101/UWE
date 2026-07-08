"use client";

import * as React from "react";
import Link from "next/link";
import { NavIcon } from "@/src/components/ui/icon";
import { RtxStatusBadge, type RtxConnectorState } from "@uwe/shared-ui";
import { MailButton, Dot } from "./mail-ui";
import { MailRulesPanel } from "./MailRulesPanel";
import type { MailAccountVM, MailConfigVM, MailLogVM, MailWorldVM } from "./mail-types";

interface MailSettingsProps {
  accounts: MailAccountVM[];
  config: MailConfigVM;
  logs: MailLogVM[];
  worlds: MailWorldVM[];
  rtxState: RtxConnectorState;
}

function SettingCard({
  icon,
  title,
  action,
  children,
}: {
  icon: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--uwe-border)",
        borderRadius: 14,
        background: "var(--uwe-card-bg)",
        padding: "16px 18px",
        boxShadow: "var(--uwe-shadow-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <NavIcon name={icon} width={16} height={16} style={{ color: "var(--uwe-fg-muted)" }} />
        <h3 style={{ margin: 0, fontFamily: "var(--uwe-font-serif)", fontSize: 15, color: "var(--uwe-fg)", whiteSpace: "nowrap" }}>
          {title}
        </h3>
        {action ? (
          <>
            <span style={{ flex: 1 }} />
            {action}
          </>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      style={{
        width: 34,
        height: 20,
        borderRadius: 999,
        flex: "none",
        position: "relative",
        border: "none",
        cursor: "pointer",
        background: on ? "var(--uwe-accent)" : "color-mix(in srgb, var(--uwe-fg) 22%, transparent)",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 16 : 2,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,.3)",
          transition: "left .12s ease",
        }}
      />
    </button>
  );
}

function SettingRow({
  title,
  hint,
  control,
}: {
  title: string;
  hint: string;
  control: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0", borderBottom: "1px solid var(--uwe-border-muted)" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "var(--uwe-fg)" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--uwe-fg-subtle)" }}>{hint}</div>
      </div>
      {control}
    </div>
  );
}

export function MailSettings({ accounts, config, logs, worlds, rtxState }: MailSettingsProps) {
  const [autoTriage, setAutoTriage] = React.useState(true);
  const [localDrafts, setLocalDrafts] = React.useState(true);
  const [cloudFallback, setCloudFallback] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  return (
    <div style={{ flex: 1, minWidth: 0, background: "var(--uwe-bg)", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "18px 26px 15px",
          borderBottom: "1px solid var(--uwe-border-muted)",
        }}
      >
        <h2 style={{ margin: 0, fontFamily: "var(--uwe-font-serif)", fontSize: 20, color: "var(--uwe-fg)" }}>
          Mail — Einstellungen
        </h2>
        <span style={{ flex: 1 }} />
        {saved ? <span style={{ fontSize: 12, color: "var(--uwe-success)" }}>Für diese Sitzung übernommen</span> : null}
        <MailButton variant="accent" size="sm" icon="check" onClick={() => setSaved(true)}>
          Speichern
        </MailButton>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 26px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <SettingCard icon="at-sign" title="Konten">
          {accounts.length === 0 ? (
            <p style={{ margin: "4px 0 12px", fontSize: 12.5, color: "var(--uwe-fg-subtle)" }}>
              Noch kein Konto verbunden.
            </p>
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
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11.5,
                    color: account.ok ? "var(--uwe-fg-muted)" : "var(--uwe-danger)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {account.imapSyncError
                    ? "Fehler · Sync"
                    : account.lastImapSyncAt
                      ? `Sync ${new Date(account.lastImapSyncAt).toLocaleDateString("de-DE")}`
                      : "Noch kein Sync"}
                </span>
                <Link
                  href="/admin/mail"
                  aria-label="Konto bearbeiten"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--uwe-fg-muted)",
                    border: "1px solid var(--uwe-border-muted)",
                  }}
                >
                  <NavIcon name="pencil" width={14} height={14} />
                </Link>
              </div>
            ))
          )}
          <div style={{ marginTop: 12 }}>
            <Link href="/admin/mail" className="uwe-v2-btn uwe-v2-btn-subtle uwe-v2-btn-sm">
              <NavIcon name="plus" width={14} height={14} />
              Konto hinzufügen
            </Link>
          </div>
        </SettingCard>

        <SettingCard icon="filter" title="Regeln &amp; VIP-Absender">
          <MailRulesPanel />
        </SettingCard>

        <SettingCard icon="cpu" title="KI &amp; RTX" action={<RtxStatusBadge state={rtxState} />}>
          <SettingRow
            title="Automatische Triage neuer Mails"
            hint="RTX fasst zusammen und schlägt Aktionen vor."
            control={<Toggle on={autoTriage} onChange={() => setAutoTriage((v) => !v)} label="Automatische Triage" />}
          />
          <SettingRow
            title="Antwortentwürfe lokal generieren"
            hint="Entwürfe entstehen auf deiner GPU — nicht in der Cloud."
            control={<Toggle on={localDrafts} onChange={() => setLocalDrafts((v) => !v)} label="Lokale Entwürfe" />}
          />
          <SettingRow
            title="Cloud-Fallback erlauben"
            hint="Nur Allgemeiner Chat, ohne Brain- &amp; Weltwissen."
            control={<Toggle on={cloudFallback} onChange={() => setCloudFallback((v) => !v)} label="Cloud-Fallback" />}
          />
          <p style={{ margin: "12px 0 2px", fontSize: 11.5, color: "var(--uwe-fg-subtle)" }}>
            Lokales Modell über RTX Host Connector — siehe Badge oben.
          </p>
        </SettingCard>

        <SettingCard icon="server-cog" title="SMTP &amp; Diagnose">
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: 12.5 }}>
            <dt style={{ color: "var(--uwe-fg-subtle)" }}>Aktiv</dt>
            <dd style={{ margin: 0, color: "var(--uwe-fg)" }}>{config.enabled ? "Ja" : "Nein"}</dd>
            <dt style={{ color: "var(--uwe-fg-subtle)" }}>Host</dt>
            <dd style={{ margin: 0, color: "var(--uwe-fg)" }}>{config.host ?? "—"}{config.port ? `:${config.port}` : ""}</dd>
            <dt style={{ color: "var(--uwe-fg-subtle)" }}>From</dt>
            <dd style={{ margin: 0, color: "var(--uwe-fg)" }}>{config.fromAddress ?? "—"}</dd>
            <dt style={{ color: "var(--uwe-fg-subtle)" }}>Mock-Modus</dt>
            <dd style={{ margin: 0, color: "var(--uwe-fg)" }}>{config.useMock ? "Ja" : "Nein"}</dd>
            <dt style={{ color: "var(--uwe-fg-subtle)" }}>Diagnose</dt>
            <dd style={{ margin: 0, color: "var(--uwe-fg)" }}>{config.message}</dd>
          </dl>
          {logs.length > 0 ? (
            <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--uwe-fg-subtle)" }}>
              Letzte Zustellung: {logs[0].subject} · {new Date(logs[0].createdAt).toLocaleString("de-DE")}
            </div>
          ) : null}
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--uwe-fg-subtle)" }}>
            SMTP-Zugangsdaten werden serverseitig gelesen — nie im Frontend.
          </p>
        </SettingCard>

        <SettingCard icon="workflow" title="Kommunikations-Flows">
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--uwe-fg-subtle)" }}>
            Jeder Flow erzeugt einen bearbeitbaren Entwurf mit Vorschau — Versand nur nach expliziter Freigabe.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link href="/mail/compose?kind=backup_warning" className="uwe-v2-btn uwe-v2-btn-subtle uwe-v2-btn-sm">
              Backup-Warnung
            </Link>
            <Link
              href="/mail/compose?kind=system_warning&title=Systempr%C3%BCfung&message=Bitte%20Admin-Status%20pr%C3%BCfen."
              className="uwe-v2-btn uwe-v2-btn-subtle uwe-v2-btn-sm"
            >
              Systemwarnung
            </Link>
            <Link href="/contracts" className="uwe-v2-btn uwe-v2-btn-subtle uwe-v2-btn-sm">
              Vertragserinnerung
            </Link>
            <Link href="/workshop" className="uwe-v2-btn uwe-v2-btn-subtle uwe-v2-btn-sm">
              Terrain-Verleih
            </Link>
          </div>
          {worlds.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--uwe-fg-subtle)", marginBottom: 6 }}>
                Welten — Compose
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {worlds.map((world) => (
                  <Link
                    key={world.id}
                    href={`/mail/compose?worldSlug=${world.slug}`}
                    className="uwe-v2-btn uwe-v2-btn-subtle uwe-v2-btn-sm"
                  >
                    {world.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </SettingCard>
      </div>
    </div>
  );
}
