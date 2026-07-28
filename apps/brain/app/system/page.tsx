import Link from "next/link";
import { prisma, UWE_VERSION } from "@uwe/database/server";
import { getAdminDashboardStatus, getHomelabCockpitData } from "@uwe/host-cockpit";
import { getBrainOwner } from "@/src/lib/page-owner";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";

/**
 * System — Status, Homelab und Diagnose des UWE-Hosts.
 *
 * Der Hub lag früher in Studio (`/system`). Studio ist die DM-App; der
 * Betriebsblick auf den eigenen Host gehört zum Owner-Bereich und damit nach
 * Brain (Notiz Lasse, Abschnitt D1). Die Datenbeschaffung liegt in
 * `@uwe/host-cockpit` — dieselbe Quelle, die auch `/api/admin/status` liest.
 *
 * Alles hier ist Lesezugriff. Was verändert wird — Secrets, Migrationen, Tokens,
 * Einstellungen — läuft über die Kommandozentrale auf dem Host.
 */

export const dynamic = "force-dynamic";

const TABS = [
  { id: "overview", label: "Übersicht" },
  { id: "homelab", label: "Homelab" },
  { id: "diagnose", label: "Diagnose" },
] as const;

type SystemTabId = (typeof TABS)[number]["id"];

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

function isSystemTabId(value: string | undefined): value is SystemTabId {
  return TABS.some((tab) => tab.id === value);
}

/** Brain kennt nur zwei Zustände in der Optik: neutral und Warnung. */
function tagClass(ok: boolean): string {
  return ok ? "brain-tag" : "brain-tag brain-tag-warn";
}

function severityOk(severity: string, ok: boolean): boolean {
  return ok || severity === "ok";
}

function StatusRow({
  label,
  ok,
  state,
  message,
  details,
}: {
  label: string;
  ok: boolean;
  state: string;
  message?: string;
  details?: Array<{ label: string; value: string | number | boolean | null | undefined }>;
}) {
  return (
    <li className="brain-row">
      <div className="brain-row-head">
        <strong>{label}</strong>
        <span className={tagClass(ok)}>{state}</span>
        {message ? <span className="brain-muted">{message}</span> : null}
      </div>
      {details && details.length > 0 ? (
        <div className="brain-kpis">
          {details.map((detail) => (
            <div key={detail.label} className="brain-kpi">
              <strong>{formatValue(detail.value)}</strong>
              <span>{detail.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function formatValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "ja" : "nein";
  return String(value);
}

export default async function BrainSystemPage({ searchParams }: Props) {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/system" title="System">
        <BrainDenied />
      </BrainShell>
    );
  }

  const { tab: tabParam } = await searchParams;
  const activeTab: SystemTabId = isSystemTabId(tabParam) ? tabParam : "overview";
  const useMockInference = process.env.AI_USE_MOCK === "true";

  const status = await getAdminDashboardStatus(prisma, {
    rateLimiterMode: "none (Brain: vertrauenswürdiges Netz)",
    useMockInference,
  });
  const cockpit = await getHomelabCockpitData(prisma, {
    useMockInference,
    adminStatus: status,
  });

  const { system, jobs, auth, studioSecurity, envValidation } = status;
  const envErrors = envValidation.filter((issue) => issue.severity === "error");
  const envWarnings = envValidation.filter((issue) => issue.severity === "warning");

  return (
    <BrainShell
      active="/system"
      title="System"
      lede={`UWE ${UWE_VERSION}${system.commit ? ` · ${system.commit.slice(0, 7)}` : ""} · ${
        status.ok ? "Betrieb ohne Auffälligkeiten" : "Einschränkungen vorhanden"
      }`}
      actions={<span className={tagClass(status.ok)}>{status.ok ? "System OK" : "Einschränkungen"}</span>}
    >
      <nav className="brain-form-row" aria-label="System-Bereiche">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.id === "overview" ? "/system" : `/system?tab=${tab.id}`}
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={
              activeTab === tab.id ? "brain-btn brain-btn-sm" : "brain-btn brain-btn-ghost brain-btn-sm"
            }
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeTab === "overview" ? (
        <>
          <section className="brain-section">
            <h2>Kurzstatus</h2>
            <ul className="brain-list">
              <StatusRow
                label="UWE App"
                ok={system.app.ok && system.database.ok}
                state={system.database.ok ? "Online" : "Fehler"}
                message={system.database.message}
                details={[
                  { label: "Umgebung", value: system.app.nodeEnv },
                  { label: "Migrationen", value: system.migrations.ok ? "OK" : "Ausstehend" },
                ]}
              />
              <StatusRow
                label="RTX-Host"
                ok={status.rtx.ready}
                state={status.rtx.ready ? "Bereit" : "Offline"}
                message={status.rtx.message}
                details={[
                  { label: "Quelle", value: status.rtx.source },
                  { label: "Connectoren online", value: status.rtx.connectorOnlineCount },
                ]}
              />
              <StatusRow
                label="Jobs"
                ok={jobs.failedCount === 0}
                state={jobs.queueImplemented ? "Queue aktiv" : "Nicht verfügbar"}
                message={jobs.message}
                details={[
                  { label: "Wartend", value: jobs.pendingCount },
                  { label: "Fehlgeschlagen", value: jobs.failedCount },
                ]}
              />
              <StatusRow
                label="Cloudflare / Proxy"
                ok={!system.proxy.publicExposureConfigured || system.proxy.trustProxy}
                state={
                  system.proxy.cloudflareTunnel
                    ? "Tunnel aktiv"
                    : system.proxy.publicExposureConfigured
                      ? "Öffentlich"
                      : "Nur lokal"
                }
                message={
                  system.proxy.cloudflareTunnel
                    ? "Cloudflare Tunnel ist konfiguriert."
                    : system.proxy.publicAppUrl
                      ? `Öffentliche URL: ${system.proxy.publicAppUrl}`
                      : "Keine öffentliche URL konfiguriert."
                }
                details={[
                  { label: "TRUST_PROXY", value: system.proxy.trustProxy },
                  { label: "Netzwerk-Schutz", value: studioSecurity.proxyIndicators.networkProtectionLikely },
                ]}
              />
            </ul>
          </section>

          {cockpit.alerts.messages.length > 0 ? (
            <section className="brain-section">
              <h2>Offene Punkte · {cockpit.alerts.messages.length}</h2>
              <p className="brain-muted">
                {cockpit.alerts.criticalCount} kritisch · {cockpit.alerts.serviceIssueCount} Dienste ·{" "}
                {cockpit.alerts.securityIssueCount} Sicherheit
              </p>
              <ul className="brain-list">
                {cockpit.alerts.messages.map((message) => (
                  <li key={message} className="brain-row">
                    <div className="brain-row-head">
                      <span>{message}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="brain-section">
            <h2>Weiter</h2>
            <p className="brain-muted">
              Geräte und Fehlerhistorie: <Link href="/hardware">Hardware / Homelab →</Link>
              {" · "}
              Rohdaten: <Link href="/api/health">/api/health</Link>
            </p>
            <p className="brain-muted">
              Secrets, Migrationen, API-Tokens, Webhooks, Einstellungen und Backups laufen über die
              Kommandozentrale auf dem Host — nicht über den Browser.
            </p>
          </section>
        </>
      ) : null}

      {activeTab === "homelab" ? (
        <>
          {cockpit.urlWarnings.length > 0 ? (
            <div className="brain-callout brain-callout-warn" role="alert">
              <strong>Sicherheitswarnungen — der RTX-Host gehört nie ins öffentliche Netz:</strong>
              <ul>
                {cockpit.urlWarnings.map((warning) => (
                  <li key={`${warning.deviceId}-${warning.field}`}>
                    {warning.deviceName}: {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <section className="brain-section">
            <h2>Service-Status</h2>
            <ul className="brain-list">
              {cockpit.serviceStatuses.map((service) => (
                <StatusRow
                  key={service.id}
                  label={service.label}
                  ok={severityOk(service.severity, service.ok)}
                  state={service.ok ? "OK" : service.severity}
                  message={service.message}
                />
              ))}
            </ul>
          </section>

          <section className="brain-section">
            <h2>Security-Checkliste</h2>
            <ul className="brain-list">
              {cockpit.securityChecks.map((check) => (
                <StatusRow
                  key={check.id}
                  label={`${check.label}${check.manual ? " (manuell)" : ""}`}
                  ok={severityOk(check.severity, check.ok)}
                  state={check.ok ? "OK" : check.severity}
                  message={check.message}
                />
              ))}
            </ul>
          </section>

          <section className="brain-section">
            <h2>Runbooks</h2>
            {cockpit.runbooks.map((runbook) => (
              <details key={runbook.id} className="brain-edit">
                <summary>
                  <strong>{runbook.title}</strong> — {runbook.summary}
                </summary>
                <ol>
                  {runbook.steps.map((step) => (
                    <li key={`${runbook.id}-${step.order}`}>
                      {step.instruction}
                      {step.command ? <code>{step.command}</code> : null}
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </section>
        </>
      ) : null}

      {activeTab === "diagnose" ? (
        <>
          <section className="brain-section">
            <h2>Umgebung</h2>
            {envValidation.length === 0 ? (
              <p className="brain-muted">Keine Umgebungsprobleme erkannt.</p>
            ) : (
              <ul className="brain-list">
                {envValidation.map((issue) => (
                  <li key={issue.id} className="brain-row">
                    <div className="brain-row-head">
                      <strong>{issue.envKey ?? issue.id}</strong>
                      <span className={tagClass(issue.severity !== "error")}>{issue.severity}</span>
                      <span className="brain-muted">{issue.message}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="brain-muted">
              {envErrors.length} Fehler · {envWarnings.length} Hinweise — ohne Secret-Werte.
            </p>
          </section>

          <section className="brain-section">
            <h2>Dienste</h2>
            <ul className="brain-list">
              <StatusRow
                label="Datenbank"
                ok={system.database.ok}
                state={system.database.ok ? "OK" : "Fehler"}
                message={system.database.message}
                details={[
                  { label: "Version", value: system.version },
                  { label: "Migrationen", value: system.migrations.ok ? "OK" : "Ausstehend" },
                ]}
              />
              <StatusRow
                label="Storage"
                ok={system.storage.ok}
                state={system.storage.ok ? "OK" : "Fehler"}
                message={system.storage.message}
                details={[
                  { label: "Uploads", value: system.storage.uploadsWritable },
                  { label: "Backups", value: system.storage.backupsWritable },
                  { label: "DB-Datei", value: system.storage.databaseFileExists },
                ]}
              />
              <StatusRow
                label="Auth"
                ok={auth.ok}
                state={auth.portalAuthRequired ? "Portal aktiv" : "Optional"}
                message={auth.message}
                details={[
                  { label: "AUTH_SECRET gesetzt", value: auth.authSecretConfigured },
                  { label: "Secret schwach", value: auth.authSecretLooksWeak },
                ]}
              />
              <StatusRow
                label="Inferenz"
                ok={!status.inference.enabled || status.inference.online || status.rtx.ready}
                state={status.inference.enabled ? status.inference.provider : "Aus"}
                message={status.inference.message}
              />
            </ul>
          </section>
        </>
      ) : null}
    </BrainShell>
  );
}
