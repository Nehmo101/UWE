import Link from "next/link";
import {
  AdminStatusCard,
  AdminStatusGrid,
  HealthBadge,
} from "@uwe/shared-ui";
import {
  getAppRepository,
  getBackupFreshnessStatus,
  getProductionSafetyWarnings,
  getSystemStatus,
  prisma,
  assessStudioSecurity,
  type ProductionSafetyWarning,
} from "@uwe/database/server";
import { getAdminDashboardStatus } from "@/src/lib/admin-dashboard-status";
import { ADMIN_HUB_SECTIONS } from "@/src/navigation/system-nav";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";

export default async function AdminOverviewPage() {
  const [dashboard, system, backup, productionWarnings, settings] = await Promise.all([
    getAdminDashboardStatus(prisma),
    getSystemStatus(prisma),
    Promise.resolve(getBackupFreshnessStatus()),
    getProductionSafetyWarnings(prisma),
    getAppRepository().getSystemSettings(),
  ]);

  const studioSecurity = assessStudioSecurity(system);
  const criticalWarnings = productionWarnings.filter(
    (w: ProductionSafetyWarning) => w.severity === "critical",
  );

  const securityBadge =
    studioSecurity.severity === "ok"
      ? "ok"
      : studioSecurity.severity === "warning"
        ? "degraded"
        : "error";

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Heute", href: "/today" }, { label: "Admin" }]}
        />
      }
    >
      <PageHeader
        title="Admin-Übersicht"
        summary="Systemstatus, Cloudflare/Proxy, Auth, Backup und schnelle Aktionen — ohne Secrets."
        actions={
          <HealthBadge
            status={dashboard.ok ? "ok" : "degraded"}
            label={dashboard.ok ? "System OK" : "Einschränkungen"}
          />
        }
      />
          {criticalWarnings.length > 0 && (
            <div className="uwe-form-error" role="alert" style={{ marginBottom: "1rem" }}>
              <strong>Kritische Hinweise:</strong>
              <ul className="uwe-inspector-findings">
                {criticalWarnings.map((warning: ProductionSafetyWarning) => (
                  <li key={warning.id}>
                    {warning.href ? (
                      <Link href={warning.href}>
                        <strong>{warning.title}</strong>
                      </Link>
                    ) : (
                      <strong>{warning.title}</strong>
                    )}{" "}
                    <span className="uwe-dashboard-muted">{warning.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Bereiche</h2>
            <div className="uwe-admin-hub-sections">
              {ADMIN_HUB_SECTIONS.map((section) => (
                <div key={section.title} className="uwe-v2-card uwe-v2-card-padded">
                  <h3 className="uwe-section-subtitle">{section.title}</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
                    {section.links.map((link) => (
                      <Link
                        key={link.href}
                        className={
                          "primary" in link && link.primary
                            ? "uwe-v2-btn uwe-v2-btn-primary"
                            : "uwe-v2-btn"
                        }
                        href={link.href}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <AdminStatusGrid>
            <AdminStatusCard title="Studio Security">
              <HealthBadge status={securityBadge} label={studioSecurity.label} />
              <p className="uwe-dashboard-muted" style={{ marginTop: "0.75rem" }}>
                {studioSecurity.message}
              </p>
            </AdminStatusCard>

            <AdminStatusCard title="Cloudflare / Proxy">
              <dl className="uwe-dl">
                <div>
                  <dt>Public Base URL</dt>
                  <dd>{system.proxy.publicAppUrl ?? "—"}</dd>
                </div>
                <div>
                  <dt>Studio URL</dt>
                  <dd>{system.proxy.studioUrl ?? "—"}</dd>
                </div>
                <div>
                  <dt>Portal URL</dt>
                  <dd>{system.proxy.portalUrl ?? "—"}</dd>
                </div>
                <div>
                  <dt>TRUST_PROXY</dt>
                  <dd>{system.proxy.trustProxy ? "ja" : "nein"}</dd>
                </div>
                <div>
                  <dt>CLOUDFLARE_TUNNEL</dt>
                  <dd>{system.proxy.cloudflareTunnel ? "ja" : "nein"}</dd>
                </div>
                <div>
                  <dt>STUDIO_API_TOKEN</dt>
                  <dd>{system.trust.studioApiTokenConfigured ? "gesetzt" : "fehlt"}</dd>
                </div>
              </dl>
            </AdminStatusCard>

            <AdminStatusCard title="Auth &amp; Portal">
              <dl className="uwe-dl">
                <div>
                  <dt>Portal AUTH_REQUIRED</dt>
                  <dd>{system.proxy.authRequired ? "ja" : "nein"}</dd>
                </div>
                <div>
                  <dt>Portal aktiv</dt>
                  <dd>{settings.portal.portalEnabled ? "ja" : "nein"}</dd>
                </div>
                <div>
                  <dt>Öffentliche Portal-Freigabe</dt>
                  <dd>{system.trust.publicPortalSharingEnabled ? "aktiv" : "inaktiv"}</dd>
                </div>
                <div>
                  <dt>Benutzer (Studio)</dt>
                  <dd>
                    <Link href="/admin/users">Benutzer verwalten</Link>
                  </dd>
                </div>
                <div>
                  <dt>2FA / Sicherheit</dt>
                  <dd>
                    <Link href="/account/security">Konto-Sicherheit</Link>
                  </dd>
                </div>
              </dl>
            </AdminStatusCard>

            <AdminStatusCard
              title="Backup"
              actions={
                <Link className="uwe-v2-btn uwe-v2-btn-ghost" href="/backup">
                  Backup verwalten
                </Link>
              }
            >
              <dl className="uwe-dl">
                <div>
                  <dt>Anzahl Backups</dt>
                  <dd>{backup.backupCount}</dd>
                </div>
                <div>
                  <dt>Letztes Backup</dt>
                  <dd>
                    {backup.latestBackupAt
                      ? backup.latestBackupAt.toLocaleString("de-DE")
                      : "keines gefunden"}
                  </dd>
                </div>
                <div>
                  <dt>Verzeichnis lesbar</dt>
                  <dd>{backup.readable ? "ja" : "nein"}</dd>
                </div>
              </dl>
            </AdminStatusCard>
          </AdminStatusGrid>
    </SystemShell>
  );
}
