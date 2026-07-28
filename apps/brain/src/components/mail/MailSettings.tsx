"use client";

import * as React from "react";
import { NavIcon, RtxStatusBadge, type RtxConnectorState } from "@uwe/shared-ui";
import { MailAccountManager } from "./MailAccountManager";
import { MailRulesPanel } from "./MailRulesPanel";
import type { MailAccountVM, MailConfigVM, MailLogVM } from "./mail-types";

interface MailSettingsProps {
  accounts: MailAccountVM[];
  config: MailConfigVM;
  logs: MailLogVM[];
  rtxState: RtxConnectorState;
}

/**
 * Karte im Stil der übrigen Mail-Oberfläche.
 *
 * In Studio kam sie aus dem dortigen Design-Kit (`Card`/`CardHeader`/…). Das
 * Kit gibt es in Brain nicht, und es dafür herüberzuholen hieße, das halbe Kit
 * mitzunehmen — für vier Kästen. Die Mail-Oberfläche bringt ihre eigene
 * UI-Schicht ohnehin mit (`mail-ui.tsx`), also passt die Karte dort hinein.
 */
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
    <section className="rounded-[var(--radius)] border border-border bg-card text-card-foreground shadow-sm">
      <header className="flex flex-row items-center gap-2.5 px-5 pb-2 pt-4">
        <NavIcon name={icon} width={16} height={16} className="text-muted-foreground" />
        <h3 className="m-0 flex-1 whitespace-nowrap font-serif text-[15px] font-semibold">{title}</h3>
        {action}
      </header>
      <div className="px-5 pb-4 pt-0">{children}</div>
    </section>
  );
}

export function MailSettings({ accounts, config, logs, rtxState }: MailSettingsProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border/60 px-6 pb-4 pt-5">
        <h2 className="m-0 font-serif text-xl text-foreground">Mail — Einstellungen</h2>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6 pt-5">
        <SettingCard icon="at-sign" title="Konten">
          <MailAccountManager accounts={accounts} />
        </SettingCard>

        <SettingCard icon="filter" title="Regeln &amp; VIP-Absender">
          <MailRulesPanel />
        </SettingCard>

        {/*
          Hier standen drei Schalter — automatische Triage, lokale Entwürfe,
          Cloud-Fallback — und ein „Speichern"-Knopf. Alle vier waren Attrappe:
          reiner `useState`, nichts wurde je gespeichert, und der Cloud-Schalter
          versprach seit N.3 etwas, das es gar nicht mehr gibt. Ein Schalter, der
          nichts schaltet, ist schlimmer als kein Schalter — also stehen hier
          jetzt die Tatsachen.
        */}
        <SettingCard icon="cpu" title="KI &amp; RTX" action={<RtxStatusBadge state={rtxState} />}>
          <p className="m-0 text-xs text-muted-foreground">
            Zusammenfassung, Antwortentwurf, Priorisierung und Mail-Chat laufen über den RTX Host
            Connector — auf deiner eigenen GPU. Es gibt keinen Cloud-Anbieter und keinen Schalter
            dafür: läuft der Connector nicht, bleibt die Funktion aus, statt auszuweichen.
          </p>
          <p className="mb-0 mt-2 text-xs text-muted-foreground">
            Frisch synchronisierte Nachrichten stuft UWE beim Sync lokal ein — über deine Regeln und
            VIP-Absender, ohne Modell. Die KI-Einstufung stößt du in der Triage selbst an.
          </p>
        </SettingCard>

        <SettingCard icon="server-cog" title="SMTP &amp; Diagnose">
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
            <dt className="text-muted-foreground">Aktiv</dt>
            <dd className="m-0 text-foreground">{config.enabled ? "Ja" : "Nein"}</dd>
            <dt className="text-muted-foreground">Host</dt>
            <dd className="m-0 text-foreground">
              {config.host ?? "—"}
              {config.port ? `:${config.port}` : ""}
            </dd>
            <dt className="text-muted-foreground">From</dt>
            <dd className="m-0 text-foreground">{config.fromAddress ?? "—"}</dd>
            <dt className="text-muted-foreground">Mock-Modus</dt>
            <dd className="m-0 text-foreground">{config.useMock ? "Ja" : "Nein"}</dd>
            <dt className="text-muted-foreground">Diagnose</dt>
            <dd className="m-0 text-foreground">{config.message}</dd>
          </dl>
          {logs.length > 0 ? (
            <div className="mt-3 text-xs text-muted-foreground">
              Letzte Zustellung: {logs[0].subject} ·{" "}
              {new Date(logs[0].createdAt).toLocaleString("de-DE")}
            </div>
          ) : null}
          <p className="mt-2.5 text-xs text-muted-foreground">
            SMTP-Zugangsdaten werden serverseitig gelesen — nie im Frontend.
          </p>
        </SettingCard>
      </div>
    </div>
  );
}
