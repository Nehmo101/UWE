import Link from "next/link";
import {
  createMailAccountService,
  createMailLogService,
  createMailService,
  createMailTemplateService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import { MailCenterDrafts } from "@/components/mail/MailCenterDrafts";
import { MailCenterInbox } from "@/components/mail/MailCenterInbox";
import { MailCenterSetup } from "@/components/mail/MailCenterSetup";
import { MailCenterTabs } from "@/components/mail/MailCenterTabs";
import { MailTestForm } from "@/components/MailTestForm";
import { formatStudioDate } from "@/src/lib/format";

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  pending: "Ausstehend",
  sent: "Gesendet",
  failed: "Fehlgeschlagen",
};

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function MailCenterPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const mail = createMailService(prisma);
  const accountService = createMailAccountService(prisma);
  const [status, logs, templates, worlds, accounts, inboxMessages, drafts] = await Promise.all([
    mail.getConfigStatus(),
    createMailLogService(prisma).list({ limit: 20 }),
    createMailTemplateService(prisma).listTemplates(),
    getAppRepository().listWorlds(),
    accountService.listAccounts(),
    accountService.listInbox(undefined, 50),
    accountService.listDrafts(),
  ]);

  const defaultTab =
    tab === "inbox" || tab === "drafts" || tab === "setup" ? tab : "overview";

  const overview = (
    <>
      <section className="uwe-form" style={{ marginBottom: "2rem" }}>
        <h2>SMTP-Status</h2>
        <dl className="uwe-kv-list">
          <div>
            <dt>Aktiv</dt>
            <dd>{status.enabled ? "Ja" : "Nein"}</dd>
          </div>
          <div>
            <dt>Konfiguriert</dt>
            <dd>{status.configured ? "Ja" : "Nein"}</dd>
          </div>
          <div>
            <dt>Host</dt>
            <dd>{status.host ?? "—"}</dd>
          </div>
          <div>
            <dt>Port</dt>
            <dd>{status.port ?? "—"}</dd>
          </div>
          <div>
            <dt>From</dt>
            <dd>{status.fromAddress ?? "—"}</dd>
          </div>
          <div>
            <dt>Mock-Modus</dt>
            <dd>{status.useMock ? "Ja (MAIL_USE_MOCK)" : "Nein"}</dd>
          </div>
          <div>
            <dt>Diagnose</dt>
            <dd>{status.message}</dd>
          </div>
        </dl>
        <p className="uwe-hint">
          SMTP-Zugangsdaten werden serverseitig aus Admin Portal oder <code>.env</code> gelesen — nie im
          Frontend.
        </p>
      </section>

      <MailTestForm />

      <section style={{ marginTop: "2rem" }}>
        <h2>Kommunikations-Flows</h2>
        <p className="uwe-hint">
          Alle Flows erzeugen einen bearbeitbaren Entwurf mit Vorschau — Versand nur nach expliziter Freigabe.
        </p>
        <ul className="uwe-linked-list">
          <li>
            <Link href="/mail/compose?kind=backup_warning">Backup-Warnung vorbereiten</Link>
          </li>
          <li>
            <Link href="/mail/compose?kind=system_warning&title=Systempr%C3%BCfung&message=Bitte%20Admin-Status%20pr%C3%BCfen.">
              Systemwarnung vorbereiten
            </Link>
          </li>
          <li>
            <Link href="/contracts">Vertragserinnerung (von Vertragsseite)</Link>
          </li>
          <li>
            <Link href="/workshop">Terrain-Verleih (von Werkstatt-Projekt)</Link>
          </li>
        </ul>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>System-Templates</h2>
        <ul className="uwe-linked-list">
          {templates.map((template) => (
            <li key={template.id}>
              <strong>{template.name}</strong>
              <span className="uwe-badge">{template.kind}</span>
              <span className="uwe-hint">{template.subject}</span>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Letzte Mail-Logs</h2>
        {logs.length === 0 ? (
          <p className="uwe-empty">Noch keine Mails protokolliert.</p>
        ) : (
          <table className="uwe-table">
            <thead>
              <tr>
                <th>Zeit</th>
                <th>Status</th>
                <th>Betreff</th>
                <th>Empfänger</th>
                <th>Fehler</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatStudioDate(log.createdAt)}</td>
                  <td>{STATUS_LABELS[log.status] ?? log.status}</td>
                  <td>{log.subject}</td>
                  <td>{log.toAddresses.join(", ")}</td>
                  <td>{log.errorMessage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Welten — Compose</h2>
        <ul className="uwe-linked-list">
          {worlds.map((world) => (
            <li key={world.id}>
              <Link href={`/mail/compose?worldSlug=${world.slug}`}>{world.name}</Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="uwe-hint" style={{ marginTop: "2rem" }}>
        Session-Recap, Handout oder Share-Link: <Link href="/worlds">Welten</Link> → Session/Handout → „Mail
        vorbereiten“.
      </p>
    </>
  );

  return (
    <AdminModuleShell
      activePath="/mail"
      title="Mail Center"
      summary="SMTP, Posteingang, Entwürfe und Compose-Flows — Versand nur nach expliziter Aktion."
      actions={
        <Link href="/settings?tab=mail" className="uwe-btn uwe-btn-secondary">
          Einstellungen
        </Link>
      }
    >
      <MailCenterTabs
        defaultTab={defaultTab}
        overview={overview}
        inbox={
          <MailCenterInbox
            accounts={accounts.map((account) => ({
              id: account.id,
              label: account.label,
              lastImapSyncAt: account.lastImapSyncAt?.toISOString() ?? null,
              imapSyncError: account.imapSyncError,
            }))}
            initialMessages={inboxMessages.map((message) => ({
              ...message,
              receivedAt: message.receivedAt.toISOString(),
            }))}
          />
        }
        drafts={
          <MailCenterDrafts
            drafts={drafts.map((draft) => ({
              id: draft.id,
              subject: draft.subject,
              status: draft.status,
              updatedAt: draft.updatedAt.toISOString(),
              worldId: draft.worldId,
            }))}
          />
        }
        setup={<MailCenterSetup smtpStatus={status} accountCount={accounts.length} />}
      />
    </AdminModuleShell>
  );
}
