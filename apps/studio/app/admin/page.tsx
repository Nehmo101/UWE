import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import {
  getProductionSafetyWarnings,
  prisma,
  type ProductionSafetyWarning,
} from "@uwe/database/server";
import { resolveUweAppUrls } from "@uwe/auth";
import { getAdminDashboardStatus } from "@/src/lib/admin-dashboard-status";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";

export default async function AdminOverviewPage() {
  const [dashboard, productionWarnings] = await Promise.all([
    getAdminDashboardStatus(prisma),
    getProductionSafetyWarnings(prisma),
  ]);

  const appUrls = resolveUweAppUrls();
  const criticalWarnings = productionWarnings.filter(
    (w: ProductionSafetyWarning) => w.severity === "critical",
  );

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
            <h2 className="uwe-v2-section-title">Schnellaktionen</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
              <Link className="uwe-v2-btn uwe-v2-btn-primary" href="/worlds">
                Welten verwalten
              </Link>
              <Link className="uwe-v2-btn" href="/backup">
                Backup erstellen
              </Link>
              <Link className="uwe-v2-btn" href="/admin/setup">
                Einrichtung
              </Link>
              <Link className="uwe-v2-btn" href="/admin/checklist">
                Aufgabenliste
              </Link>
              <Link className="uwe-v2-btn" href="/admin/roles">
                Rollen & Rechte
              </Link>
              <Link className="uwe-v2-btn" href="/settings">
                Einstellungen
              </Link>
              <Link className="uwe-v2-btn" href="/mail">
                Mail Center
              </Link>
              <Link className="uwe-v2-btn" href="/admin/secrets">
                Secrets-Status
              </Link>
              <Link className="uwe-v2-btn" href="/admin/cockpit">
                Owner Cockpit
              </Link>
              <Link className="uwe-v2-btn" href="/admin/activity">
                Verlauf
              </Link>
              <Link className="uwe-v2-btn" href="/system?tab=diagnose">
                Systemstatus
              </Link>
              <Link className="uwe-v2-btn" href="/admin/reviews">
                Reviews
              </Link>
              <Link className="uwe-v2-btn" href="/admin/ai-gateway">
                KI-Gateway
              </Link>
              <Link className="uwe-v2-btn" href="/admin/agent-jobs">
                Agent Jobs
              </Link>
              {appUrls.portalUrl ? (
                <a className="uwe-v2-btn" href={appUrls.portalUrl} target="_blank" rel="noreferrer">
                  Portal öffnen
                </a>
              ) : (
                <Link className="uwe-v2-btn" href="/settings?tab=portal">
                  Portal konfigurieren
                </Link>
              )}
              {appUrls.studioUrl ? (
                <a className="uwe-v2-btn" href={appUrls.studioUrl}>
                  Studio öffnen
                </a>
              ) : null}
            </div>
          </section>

          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">System & Betrieb</h2>
            <p className="uwe-dashboard-muted">
              Status, Diagnose und Cloudflare zentral im System-Hub — erweiterte Karten für RTX, Mail
              und Brain.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", marginTop: "0.75rem" }}>
              <Link className="uwe-v2-btn uwe-v2-btn-primary" href="/system">
                System-Hub
              </Link>
              <Link className="uwe-v2-btn" href="/system?tab=diagnose">
                Diagnose
              </Link>
              <Link className="uwe-v2-btn" href="/system/cloudflare">
                Cloudflare
              </Link>
              <Link className="uwe-v2-btn" href="/admin/status">
                Erweiterte Karten
              </Link>
            </div>
          </section>
    </SystemShell>
  );
}
