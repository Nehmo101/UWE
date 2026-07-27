import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import {
  getProductionSafetyWarnings,
  prisma,
  type ProductionSafetyWarning,
} from "@uwe/database/server";
import { resolveUweAppUrls } from "@uwe/auth";
import { getAdminDashboardStatus } from "@uwe/host-cockpit";
import { ADMIN_HUB_SECTIONS } from "@/src/navigation/system-nav";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { Alert, buttonVariants, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

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
        <Alert tone="danger" role="alert" className="mb-4" title="Kritische Hinweise:">
          <ul className="mt-1 list-disc pl-5">
            {criticalWarnings.map((warning: ProductionSafetyWarning) => (
              <li key={warning.id}>
                {warning.href ? (
                  <Link href={warning.href}>
                    <strong>{warning.title}</strong>
                  </Link>
                ) : (
                  <strong>{warning.title}</strong>
                )}{" "}
                <span className="text-muted-foreground">{warning.description}</span>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Bereiche</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {ADMIN_HUB_SECTIONS.map((section) => (
              <Card key={section.title}>
                <CardHeader>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {section.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={buttonVariants({
                        variant: "primary" in link && link.primary ? "default" : "secondary",
                        size: "sm",
                      })}
                    >
                      {link.label}
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {appUrls.portalUrl ? (
              <a
                className={buttonVariants({ variant: "secondary" })}
                href={appUrls.portalUrl}
                target="_blank"
                rel="noreferrer"
              >
                Portal öffnen
              </a>
            ) : (
              <Link className={buttonVariants({ variant: "secondary" })} href="/settings?tab=portal">
                Portal konfigurieren
              </Link>
            )}
            {appUrls.studioUrl ? (
              <a className={buttonVariants({ variant: "secondary" })} href={appUrls.studioUrl}>
                Studio öffnen
              </a>
            ) : null}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">System &amp; Betrieb</h2>
          <p className="text-sm text-muted-foreground">
            Status, Homelab und Diagnose liegen in <strong>Brain &rarr; System</strong>. Host-Setup,
            Cloudflare, RTX-Verbindung, Drucker, Secrets, Migrationen, Tokens und Backups laufen
            über die <strong>Kommandozentrale</strong> auf dem UWE-Host.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link className={buttonVariants({ variant: "default" })} href="/hardware">
              Hardware-Cockpit
            </Link>
          </div>
        </section>
      </div>
    </SystemShell>
  );
}
