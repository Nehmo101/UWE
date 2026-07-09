import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import { prisma, UWE_VERSION } from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { StatusCard, type StatusLevel } from "@/src/components/AdminStatusDashboard";
import { getAdminDashboardStatus } from "@/src/lib/admin-dashboard-status";
import { formatStudioDateTime } from "@/src/lib/format";
import { getHomelabCockpitData } from "@/src/lib/homelab-dashboard";

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

function isSystemTabId(value: string | undefined): value is SystemTabId {
  return TABS.some((tab) => tab.id === value);
}

function overallLevel(ok: boolean): StatusLevel {
  return ok ? "ok" : "error";
}

function severityStatus(severity: string, ok: boolean): "ok" | "warn" | "error" {
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

  const { system, jobs, auth, studioSecurity, envValidation, publicLeaks } = status;
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
      <p className="uwe-dashboard-muted" style={{ marginBottom: "1rem" }}>
        Stand: {formatStudioDateTime(new Date(status.timestamp))} · UWE {UWE_VERSION}
        {system.commit ? ` · ${system.commit.slice(0, 7)}` : ""}
      </p>

      <section
        className="uwe-v2-card uwe-v2-card-padded"
        style={{ marginBottom: "1rem" }}
        aria-label="System-Kurzstatus"
      >
        <p className="uwe-dashboard-muted" style={{ margin: "0 0 0.75rem" }}>
          <strong>System</strong> = Infrastruktur &amp; Host (RTX, Cloudflare, Diagnose).{" "}
          <strong>Admin</strong> = Nutzer, Rollen, Sicherheit &amp; KI-Governance.{" "}
          <Link href="/admin">Admin-Übersicht →</Link>
        </p>
        <p
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "center",
            margin: 0,
          }}
        >
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
      </section>

      <nav className="uwe-settings-tabs" aria-label="System-Bereiche">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.id === "overview" ? "/system" : `/system?tab=${tab.id}`}
            className={activeTab === tab.id ? "active" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeTab === "overview" && (
        <>
          <div className="uwe-dashboard-grid" style={{ marginTop: "1rem" }}>
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

          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Homelab — Kurzüberblick</h2>
            <div className="uwe-homelab-service-grid">
              {cockpit.serviceStatuses.slice(0, 6).map((service) => (
                <article
                  key={service.id}
                  className="uwe-homelab-service-card"
                  data-status={severityStatus(service.severity, service.ok)}
                >
                  <h3>{service.label}</h3>
                  <p>{service.message}</p>
                </article>
              ))}
            </div>
            <p style={{ marginTop: "0.75rem" }}>
              <Link href="/system?tab=homelab">Homelab-Details →</Link>
              {" · "}
              <Link href="/hardware">Hardware verwalten →</Link>
            </p>
          </section>

          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Schnellzugriff</h2>
            <p style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
              <Link className="uwe-v2-btn uwe-v2-btn-primary" href="/system?tab=diagnose">
                Vollständige Diagnose
              </Link>
              <Link className="uwe-v2-btn" href="/system/rtx-connector">
                RTX Connector
              </Link>
              <Link className="uwe-v2-btn" href="/system/printers">
                Drucker
              </Link>
              <Link className="uwe-v2-btn" href="/system/command-center">
                Kommandozentrale
              </Link>
              <Link className="uwe-v2-btn" href="/settings?tab=status">
                Einstellungen → Status
              </Link>
              <Link className="uwe-v2-btn" href="/jobs">
                Jobs
              </Link>
              <Link className="uwe-v2-btn" href="/backup">
                Backup
              </Link>
              <Link className="uwe-v2-btn" href="/settings">
                Einstellungen
              </Link>
            </p>
          </section>
        </>
      )}

      {activeTab === "homelab" && (
        <>
          {cockpit.urlWarnings.length > 0 && (
            <section className="uwe-form-error uwe-v2-section" role="alert">
              <strong>Sicherheitswarnungen (RTX niemals öffentlich):</strong>
              <ul>
                {cockpit.urlWarnings.map((warning) => (
                  <li key={`${warning.deviceId}-${warning.field}`}>
                    {warning.deviceName}: {warning.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Service-Status</h2>
            <div className="uwe-homelab-service-grid">
              {cockpit.serviceStatuses.map((service) => (
                <article
                  key={service.id}
                  className="uwe-homelab-service-card"
                  data-status={severityStatus(service.severity, service.ok)}
                >
                  <h3>{service.label}</h3>
                  <p>{service.message}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Security Checklist</h2>
            <ul className="uwe-homelab-checklist">
              {cockpit.securityChecks.map((check) => (
                <li key={check.id} data-status={severityStatus(check.severity, check.ok)}>
                  <strong>{check.label}</strong>
                  {check.manual ? " (manuell)" : ""}
                  <span>{check.message}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">Runbooks</h2>
            <div className="uwe-homelab-runbook-list">
              {cockpit.runbooks.map((runbook) => (
                <details key={runbook.id} className="uwe-v2-card uwe-homelab-runbook">
                  <summary>
                    <strong>{runbook.title}</strong> — {runbook.summary}
                  </summary>
                  <ol>
                    {runbook.steps.map((step) => (
                      <li key={`${runbook.id}-${step.order}`}>
                        {step.instruction}
                        {step.command ? (
                          <code className="uwe-homelab-command">{step.command}</code>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          </section>

          <p className="uwe-dashboard-muted">
            Geräte, Fehlerhistorie und Setup:{" "}
            <Link href="/hardware">Hardware / Homelab →</Link>
          </p>
        </>
      )}

      {activeTab === "diagnose" && (
        <>
          <p className="uwe-dashboard-muted" style={{ marginBottom: "1rem" }}>
            Vollständige Diagnose für UWE, Datenbank, Storage, Auth, Mail, Brain, RTX-Inference,
            Embeddings und Jobs — ohne Secrets.
          </p>

          <div className="uwe-dashboard-grid">
            <StatusCard
              title="Public Leak Scanner"
              level={
                publicLeaks.criticalCount > 0
                  ? "error"
                  : publicLeaks.warningCount > 0
                    ? "degraded"
                    : "ok"
              }
              statusLabel={
                publicLeaks.findingCount === 0
                  ? "Keine Befunde"
                  : `${publicLeaks.criticalCount} kritisch, ${publicLeaks.warningCount} Warnungen`
              }
              message={
                publicLeaks.findingCount === 0
                  ? "Keine verdächtigen Portal-Leaks gefunden."
                  : `${publicLeaks.findingCount} potenzielle Leak-Befunde.`
              }
              wide
            />

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

          <p className="uwe-dashboard-muted" style={{ marginTop: "1.5rem" }}>
            JSON-API: <Link href="/api/admin/status">/api/admin/status</Link>
          </p>
        </>
      )}

      {activeTab === "cloudflare" && (
        <>
          <p className="uwe-dashboard-muted" style={{ marginBottom: "1rem" }}>
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

          <p style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
            <Link className="uwe-v2-btn uwe-v2-btn-primary" href="/system/cloudflare">
              Cloudflare & Deployment bearbeiten
            </Link>
            <Link className="uwe-v2-btn" href="/admin/setup?tab=cloudflare">
              Einrichtung → Cloudflare
            </Link>
            <Link className="uwe-v2-btn" href="/system?tab=diagnose">
              System-Diagnose
            </Link>
          </p>
        </>
      )}
    </SystemShell>
  );
}
