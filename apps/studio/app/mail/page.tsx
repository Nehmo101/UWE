import Link from "next/link";
import {
  AppShell,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import {
  createMailLogService,
  createMailService,
  createMailTemplateService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import { MailTestForm } from "@/components/MailTestForm";
import { formatStudioDate } from "@/src/lib/format";

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  pending: "Ausstehend",
  sent: "Gesendet",
  failed: "Fehlgeschlagen",
};

export default async function MailCenterPage() {
  const mail = createMailService(prisma);
  const [status, logs, templates, worlds] = await Promise.all([
    mail.getConfigStatus(),
    createMailLogService(prisma).list({ limit: 20 }),
    createMailTemplateService(prisma).listTemplates(),
    getAppRepository().listWorlds(),
  ]);

  return (
    <AppShell
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Mail Center" href="/studio" />}
      sidebar={
        <>
          <SidebarSection title="Navigation">
            <SidebarNav
              items={[
                { label: "← Dashboard", href: "/studio" },
                { label: "Mail Center", href: "/mail", active: true },
                { label: "Einstellungen", href: "/settings?tab=mail" },
              ]}
            />
          </SidebarSection>
          <SidebarSection title="Welten">
            <SidebarNav
              items={worlds.map((world) => ({
                label: world.name,
                href: `/mail/compose?worldSlug=${world.slug}`,
              }))}
            />
          </SidebarSection>
        </>
      }
      main={
        <>
          <PageHeader
            title="Mail Center"
            summary="SMTP-Diagnose, Testmail, Templates, Logs und Compose-Flows. Versand nur nach expliziter Aktion."
          />

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
              SMTP-Zugangsdaten werden nur serverseitig aus <code>.env</code> gelesen — nie im Frontend.
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

          <p className="uwe-hint" style={{ marginTop: "2rem" }}>
            Compose-Flows: Session-Recap, Handout oder Share-Link über{" "}
            <Link href="/worlds">Welten</Link> → Session/Handout/Freigabe → „Mail vorbereiten“.
          </p>
        </>
      }
    />
  );
}
