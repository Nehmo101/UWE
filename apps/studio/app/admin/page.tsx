import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import {
  getProductionSafetyWarnings,
  prisma,
  type ProductionSafetyWarning,
} from "@uwe/database/server";
import { resolveUweAppUrls } from "@uwe/auth";
import { getAdminDashboardStatus } from "@/src/lib/admin-dashboard-status";
import { ADMIN_HUB_SECTIONS } from "@/src/navigation/system-nav";
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", marginTop: "0.75rem" }}>
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
          Status, Diagnose und Cloudflare zentral im System-Hub — erweiterte Karten für RTX, Mail und
          Brain.
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
          <Link className="uwe-v2-btn" href="/system?tab=diagnose">
            Erweiterte Karten
          </Link>
        </div>
      </section>
    </SystemShell>
  );
}
