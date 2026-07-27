"use client";

import * as React from "react";
import Link from "next/link";
import { NavIcon } from "@/src/components/ui/icon";
import { RtxStatusBadge, type RtxConnectorState } from "@uwe/shared-ui";
import { buttonVariants, Card, CardContent, CardHeader, CardTitle, cn } from "@/src/components/ui";
import { MailButton } from "./mail-ui";
import { MailAccountManager } from "./MailAccountManager";
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
    <Card>
      <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-2">
        <NavIcon name={icon} width={16} height={16} className="text-muted-foreground" />
        <CardTitle className="flex-1 whitespace-nowrap font-serif text-[15px]">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

/** Toggle-Switch: kein Kit-Component vorhanden — natives button[role=switch] + Tailwind.
 * TODO(design-kit): durch Kit-Switch ersetzen, sobald verfügbar. */
function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "relative h-5 w-[34px] flex-none rounded-full border-0",
        on ? "bg-primary" : "bg-foreground/20",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-[left] duration-150",
          on ? "left-4" : "left-0.5",
        )}
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
    <div className="flex items-center gap-3 border-b border-border/60 py-3">
      <div className="flex-1">
        <div className="text-sm text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
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
    <div className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border/60 px-6 pb-4 pt-5">
        <h2 className="m-0 font-serif text-xl text-foreground">Mail — Einstellungen</h2>
        <span className="flex-1" />
        {saved ? <span className="text-xs text-success">Für diese Sitzung übernommen</span> : null}
        <MailButton variant="accent" size="sm" icon="check" onClick={() => setSaved(true)}>
          Speichern
        </MailButton>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-6 pt-5">
        <SettingCard icon="at-sign" title="Konten">
          <MailAccountManager accounts={accounts} />
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
          <p className="mb-0.5 mt-3 text-xs text-muted-foreground">
            Lokales Modell über RTX Host Connector — siehe Badge oben.
          </p>
        </SettingCard>

        <SettingCard icon="server-cog" title="SMTP &amp; Diagnose">
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
            <dt className="text-muted-foreground">Aktiv</dt>
            <dd className="m-0 text-foreground">{config.enabled ? "Ja" : "Nein"}</dd>
            <dt className="text-muted-foreground">Host</dt>
            <dd className="m-0 text-foreground">{config.host ?? "—"}{config.port ? `:${config.port}` : ""}</dd>
            <dt className="text-muted-foreground">From</dt>
            <dd className="m-0 text-foreground">{config.fromAddress ?? "—"}</dd>
            <dt className="text-muted-foreground">Mock-Modus</dt>
            <dd className="m-0 text-foreground">{config.useMock ? "Ja" : "Nein"}</dd>
            <dt className="text-muted-foreground">Diagnose</dt>
            <dd className="m-0 text-foreground">{config.message}</dd>
          </dl>
          {logs.length > 0 ? (
            <div className="mt-3 text-xs text-muted-foreground">
              Letzte Zustellung: {logs[0].subject} · {new Date(logs[0].createdAt).toLocaleString("de-DE")}
            </div>
          ) : null}
          <p className="mt-2.5 text-xs text-muted-foreground">
            SMTP-Zugangsdaten werden serverseitig gelesen — nie im Frontend.
          </p>
        </SettingCard>

        <SettingCard icon="workflow" title="Kommunikations-Flows">
          <p className="mb-2.5 text-xs text-muted-foreground">
            Jeder Flow erzeugt einen bearbeitbaren Entwurf mit Vorschau — Versand nur nach expliziter Freigabe.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/mail/compose?kind=backup_warning" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Backup-Warnung
            </Link>
            <Link
              href="/mail/compose?kind=system_warning&title=Systempr%C3%BCfung&message=Bitte%20Admin-Status%20pr%C3%BCfen."
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Systemwarnung
            </Link>
            <Link href="/contracts" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Vertragserinnerung
            </Link>
            <Link
              href="/mail/compose?kind=terrain_rental"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Terrain-Verleih
            </Link>
          </div>
          {worlds.length > 0 ? (
            <div className="mt-3">
              <div className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                Welten — Compose
              </div>
              <div className="flex flex-wrap gap-2">
                {worlds.map((world) => (
                  <Link
                    key={world.id}
                    href={`/mail/compose?worldSlug=${world.slug}`}
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
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
