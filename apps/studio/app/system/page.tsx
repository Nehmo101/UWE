import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import { prisma, UWE_VERSION } from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { StatusCard, type StatusLevel } from "@/src/components/AdminStatusDashboard";
import { getAdminDashboardStatus } from "@/src/lib/admin-dashboard-status";
import { formatStudioDateTime } from "@/src/lib/format";
import { getHomelabCockpitData } from "@/src/lib/homelab-dashboard";
import {
  Alert,
  badgeVariants,
  buttonVariants,
  Card,
  CardContent,
  cn,
} from "@/src/components/ui";

const TABS = [
  { id: "overview", label: "Übersicht" },
  { id: "homelab", label: "Homelab" },
  { id: "diagnose", label: "Diagnose" },
  { id: "cloudflare", label: "Cloudflare" },
] as const;

type SystemTabId = (typeof TABS)[number]["id"];

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

type Severity = "ok" | "warn" | "error";

const STATUS_DOT_CLASS: Record<Severity, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  error: "bg-destructive",
};

const STATUS_BORDER_CLASS: Record<Severity, string> = {
  ok: "border-success/40",
  warn: "border-warning/40",
  error: "border-destructive/40",
};

function isSystemTabId(value: string | undefined): value is SystemTabId {
  return TABS.some((tab) => tab.id === value);
}

function overallLevel(ok: boolean): StatusLevel {
  return ok ? "ok" : "error";
}

function severityStatus(severity: string, ok: boolean): Severity {
  if (severity === "ok" || ok) return "ok";
  if (severity === "warn" || severity === "unknown") return "warn";
  return "error";
}

export default async function SystemHubPage({ searchParams }: Props) {
  const { tab: tabParam } = await searchParams;
  const activeTab: SystemTabId = isSystemTabId(tabParam) ? tabParam : "overview";
  const useMockInference = process.env.AI_USE_MOCK === "true";

  const [status, cockpit] = await Promise.all([
    getAdminDashboardStatus(prisma, {
      rateLimiterMode: "none (Studio: vertrauenswürdiges Netz)",
      useMockInference,
    }),
    getHomelabCockpitData(prisma, { useMockInference }),
  ]);

  const { system, jobs, auth, studioSecurity, envValidation } = status;
  const overallBadge = status.ok ? "ok" : "degraded";

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Heute", href: "/today" }, { label: "System" }]}
        />
      }
    >
      <PageHeader
        title="System"
        summary="Status, Homelab, Diagnose und Cloudflare — zentraler Hub für Betrieb und Selfhosting."
        actions={
          <HealthBadge
            status={overallBadge}
            label={status.ok ? "System OK" : "Einschränkungen"}
          />
        }
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Stand: {formatStudioDateTime(new Date(status.timestamp))} · UWE {UWE_VERSION}
        {system.commit ? ` · ${system.commit.slice(0, 7)}` : ""}
      </p>

      <Card className="mb-4" aria-label="System-Kurzstatus">
        <CardContent className="flex flex-col gap-3 pt-6">
          <p className="m-0 text-sm text-muted-foreground">
            <strong>System</strong> = Infrastruktur &amp; Host (RTX, Cloudflare, Diagnose).{" "}
            <strong>Admin</strong> = Nutzer, Rollen, Sicherheit &amp; KI-Governance.{" "}
            <Link href="/admin">Admin-Übersicht →</Link>
          </p>
          <p className="m-0 flex flex-wrap items-center gap-3">
            <HealthBadge
              status={status.rtx.ready ? "ok" : "degraded"}
              label={status.rtx.ready ? "RTX bereit" : "RTX offline"}
            />
            <HealthBadge
              status={status.ok ? "ok" : "degraded"}
              label={status.ok ? "Health OK" : "Health eingeschränkt"}
            />
            <HealthBadge
              status={
                system.proxy.cloudflare.tunnelConfigured || !system.proxy.publicExposureConfigured
                  ? "ok"
                  : "degraded"
              }
              label={
                system.proxy.cloudflare.tunnelConfigured
                  ? "Cloudflare Tunnel"
                  : system.proxy.publicExposureConfigured
                    ? "Öffentlich (ohne Tunnel-Flag)"
                    : "Nur lokal"
              }
            />
            <Link href="/system/health">Health-Ampel →</Link>
            <Link href="/system/rtx-connector">RTX Connector →</Link>
            <Link href="/system?tab=cloudflare">Cloudflare →</Link>
          </p>
        </CardContent>
      </Card>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="System-Bereiche">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.id === "overview" ? "/system" : `/system?tab=${tab.id}`}
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={cn(
              badgeVariants({ variant: activeTab === tab.id ? "accent" : "default" }),
              "px-3 py-1.5 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeTab === "overview" && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatusCard
              title="UWE App"
              level={overallLevel(system.app.ok && system.database.ok)}
              statusLabel={system.database.ok ? "Online" : "Fehler"}
              message={system.database.message}
              details={[
                { label: "Umgebung", value: system.app.nodeEnv },
                { label: "Migrationen", value: system.migrations.ok ? "OK" : "Ausstehend" },
              ]}
            />
            <StatusCard
              title="Jobs"
              level={jobs.failedCount > 0 ? "degraded" : "ok"}
              statusLabel={jobs.queueImplemented ? "Queue aktiv" : "Nicht verfügbar"}
              message={jobs.message}
              details={[
                { label: "Wartend", value: jobs.pendingCount },
                { label: "Fehlgeschlagen", value: jobs.failedCount },
              ]}
            />
            <StatusCard
              title="Cloudflare / Proxy"
              level={
                system.proxy.publicExposureConfigured && !system.proxy.trustProxy
                  ? "degraded"
                  : "ok"
              }
              statusLabel={
                system.proxy.cloudflareTunnel
                  ? "Tunnel aktiv"
                  : system.proxy.publicExposureConfigured
                    ? "Öffentlich"
                    : "Lokal"
              }
              message={
                system.proxy.cloudflareTunnel
                  ? "Cloudflare Tunnel ist konfiguriert."
                  : system.proxy.publicAppUrl
                    ? `Öffentliche URL: ${system.proxy.publicAppUrl}`
                    : "Keine öffentliche URL konfiguriert."
              }
            />
          </div>

          <section className="mt-6 flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Homelab — Kurzüberblick</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
              {cockpit.serviceStatuses.slice(0, 6).map((service) => {
                const severity = severityStatus(service.severity, service.ok);
                return (
                  <Card key={service.id} className={cn("p-3", STATUS_BORDER_CLASS[severity])}>
                    <h3 className="mb-1 flex items-center gap-2 text-sm font-medium">
                      <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT_CLASS[severity])} />
                      {service.label}
                    </h3>
                    <p className="m-0 text-xs text-muted-foreground">{service.message}</p>
                  </Card>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">
              <Link href="/system?tab=homelab">Homelab-Details →</Link>
              {" · "}
              <Link href="/hardware">Hardware verwalten →</Link>
            </p>
          </section>

          <section className="mt-6 flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Schnellzugriff</h2>
            <p className="m-0 flex flex-wrap gap-2">
              <Link className={buttonVariants({ variant: "default" })} href="/system?tab=diagnose">
                Vollständige Diagnose
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/system/rtx-connector">
                RTX Connector
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/system/printers">
                Drucker
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/system/command-center">
                Kommandozentrale
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/settings?tab=status">
                Einstellungen → Status
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/jobs">
                Jobs
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/backup">
                Backup
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/settings">
                Einstellungen
              </Link>
            </p>
          </section>
        </>
      )}

      {activeTab === "homelab" && (
        <>
          {cockpit.urlWarnings.length > 0 && (
            <Alert
              tone="danger"
              role="alert"
              className="mb-4"
              title="Sicherheitswarnungen (RTX niemals öffentlich):"
            >
              <ul className="mt-1 list-disc pl-5">
                {cockpit.urlWarnings.map((warning) => (
                  <li key={`${warning.deviceId}-${warning.field}`}>
                    {warning.deviceName}: {warning.message}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          <section className="mb-6 flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Service-Status</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
              {cockpit.serviceStatuses.map((service) => {
                const severity = severityStatus(service.severity, service.ok);
                return (
                  <Card key={service.id} className={cn("p-3", STATUS_BORDER_CLASS[severity])}>
                    <h3 className="mb-1 flex items-center gap-2 text-sm font-medium">
                      <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT_CLASS[severity])} />
                      {service.label}
                    </h3>
                    <p className="m-0 text-xs text-muted-foreground">{service.message}</p>
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="mb-6 flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Security Checklist</h2>
            <ul className="grid gap-2">
              {cockpit.securityChecks.map((check) => {
                const severity = severityStatus(check.severity, check.ok);
                return (
                  <li
                    key={check.id}
                    className={cn("rounded-[var(--radius)] border p-3 text-sm", STATUS_BORDER_CLASS[severity])}
                  >
                    <span className="flex items-center gap-2">
                      <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT_CLASS[severity])} />
                      <strong>{check.label}</strong>
                      {check.manual ? " (manuell)" : ""}
                    </span>
                    <span className="mt-1 block text-muted-foreground">{check.message}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mb-6 flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Runbooks</h2>
            <div className="grid gap-2">
              {cockpit.runbooks.map((runbook) => (
                <details
                  key={runbook.id}
                  className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
                >
                  <summary className="cursor-pointer">
                    <strong>{runbook.title}</strong> — {runbook.summary}
                  </summary>
                  <ol className="mt-2 list-decimal pl-5 text-sm">
                    {runbook.steps.map((step) => (
                      <li key={`${runbook.id}-${step.order}`}>
                        {step.instruction}
                        {step.command ? (
                          <code className="mt-1 block rounded bg-muted px-2 py-1 text-xs">
                            {step.command}
                          </code>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          </section>

          <p className="text-sm text-muted-foreground">
            Geräte, Fehlerhistorie und Setup:{" "}
            <Link href="/hardware">Hardware / Homelab →</Link>
          </p>
        </>
      )}

      {activeTab === "diagnose" && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Vollständige Diagnose für UWE, Datenbank, Storage, Auth, Mail, Brain, RTX-Inference,
            Embeddings und Jobs — ohne Secrets.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatusCard
              title="Env Validation"
              level={
                envValidation.some((issue) => issue.severity === "error")
                  ? "error"
                  : envValidation.some((issue) => issue.severity === "warning")
                    ? "degraded"
                    : "ok"
              }
              statusLabel={envValidation.length === 0 ? "OK" : `${envValidation.length} Hinweise`}
              message={
                envValidation.length === 0
                  ? "Keine Umgebungsprobleme erkannt."
                  : "Prüfe .env — Details ohne Secret-Werte."
              }
              details={envValidation.slice(0, 6).map((issue) => ({
                label: issue.envKey ?? issue.id,
                value: `${issue.severity}: ${issue.message}`,
              }))}
              wide
            />

            <StatusCard
              title="UWE App"
              level={overallLevel(system.app.ok && system.database.ok)}
              statusLabel={system.database.ok ? "Online" : "Fehler"}
              message={system.database.message}
              details={[
                { label: "Version", value: system.version },
                { label: "Migrationen", value: system.migrations.ok ? "OK" : "Ausstehend" },
              ]}
            />

            <StatusCard
              title="Storage"
              level={overallLevel(system.storage.ok)}
              statusLabel={system.storage.ok ? "OK" : "Fehler"}
              message={system.storage.message}
              details={[
                { label: "Uploads", value: system.storage.uploadsWritable },
                { label: "Backups", value: system.storage.backupsWritable },
                { label: "DB-Datei", value: system.storage.databaseFileExists ?? "n/a" },
              ]}
            />

            <StatusCard
              title="Auth"
              level={auth.ok ? "ok" : "degraded"}
              statusLabel={auth.portalAuthRequired ? "Portal aktiv" : "Optional"}
              message={auth.message}
              details={[
                { label: "AUTH_SECRET gesetzt", value: auth.authSecretConfigured },
                { label: "Secret schwach", value: auth.authSecretLooksWeak },
              ]}
            />

            <StatusCard
              title="Jobs"
              level={jobs.failedCount > 0 ? "degraded" : "ok"}
              statusLabel={jobs.queueImplemented ? "Queue aktiv" : "Nicht verfügbar"}
              message={jobs.message}
              details={[
                { label: "Wartend", value: jobs.pendingCount },
                { label: "Fehlgeschlagen", value: jobs.failedCount },
              ]}
            />
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            JSON-API: <Link href="/api/admin/status">/api/admin/status</Link>
          </p>
        </>
      )}

      {activeTab === "cloudflare" && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Cloudflare Tunnel, Proxy-Header und Netzwerk-Schutz — relevant für Selfhosting auf{" "}
            <code>uweandragons.org</code>.
          </p>

          <StatusCard
            title="Cloudflare / Proxy"
            level={
              system.proxy.publicExposureConfigured && !system.proxy.trustProxy
                ? "degraded"
                : system.proxy.cloudflare.tunnelConfigured || !system.proxy.publicExposureConfigured
                  ? "ok"
                  : "degraded"
            }
            statusLabel={
              system.proxy.cloudflare.tunnelConfigured
                ? "Tunnel aktiv"
                : system.proxy.publicExposureConfigured
                  ? "Öffentlich ohne Tunnel-Flag"
                  : "Lokal"
            }
            message={
              system.proxy.deploymentModel === "split-hostname"
                ? "Split-Hostnames: Portal und Studio auf getrennten Subdomains."
                : system.proxy.cloudflareTunnel
                  ? "Cloudflare Tunnel ist konfiguriert."
                  : system.proxy.publicAppUrl
                    ? `Öffentliche URL: ${system.proxy.publicAppUrl}`
                    : "Keine öffentliche URL konfiguriert — UWE nur lokal erreichbar."
            }
            details={[
              { label: "TRUST_PROXY", value: system.proxy.trustProxy },
              { label: "CLOUDFLARE_TUNNEL", value: system.proxy.cloudflareTunnel },
              { label: "Netzwerk-Schutz", value: studioSecurity.proxyIndicators.networkProtectionLikely },
              { label: "Public Base URL", value: system.proxy.publicAppUrl ?? "—" },
            ]}
            nextSteps={
              system.proxy.publicExposureConfigured && !system.proxy.trustProxy
                ? ["Setze TRUST_PROXY=true hinter Cloudflare oder Reverse-Proxy."]
                : []
            }
            wide
          />

          <p className="mt-4 flex flex-wrap gap-2">
            <Link className={buttonVariants({ variant: "default" })} href="/system/cloudflare">
              Cloudflare & Deployment bearbeiten
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} href="/admin/setup?tab=cloudflare">
              Einrichtung → Cloudflare
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} href="/system?tab=diagnose">
              System-Diagnose
            </Link>
          </p>
        </>
      )}
    </SystemShell>
  );
}
