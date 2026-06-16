import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import { SECURITY_ROLE_LABELS } from "@uwe/auth";
import { getSecurityDashboardStatus, prisma } from "@uwe/database/server";
import { AdminModuleShell } from "@/components/AdminModuleShell";
import { StatusCard, type StatusLevel } from "@/src/components/AdminStatusDashboard";
import { resolveSecurityDashboardAccess } from "@/src/lib/security-dashboard-access";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function warningLevel(severity: string): StatusLevel {
  if (severity === "critical") return "error";
  if (severity === "warning") return "degraded";
  return "ok";
}

function boolLevel(ok: boolean): StatusLevel {
  return ok ? "ok" : "error";
}

export default async function AdminSecurityPage() {
  const access = await resolveSecurityDashboardAccess(prisma);

  if (!access.allowed) {
    return (
      <AdminModuleShell
        activePath="/admin/security"
        title="Security"
        summary="Sicherheitsübersicht für UWE Admins"
      >
        <section className="uwe-card">
          <h2 className="uwe-section-title">Zugriff verweigert</h2>
          <p className="uwe-notice uwe-notice-warn">{access.reason}</p>
          {access.userRole && (
            <p className="uwe-dashboard-muted">
              Angemeldet als {access.displayName} ({SECURITY_ROLE_LABELS[access.userRole] ?? access.userRole})
            </p>
          )}
          <p className="uwe-dashboard-muted" style={{ marginTop: "1rem" }}>
            Melde dich im Portal mit einem OWNER- oder ADMIN-Account an und öffne diese Seite erneut.
          </p>
        </section>
      </AdminModuleShell>
    );
  }

  const status = await getSecurityDashboardStatus(prisma);
  const criticalWarnings = status.warnings.filter((w) => w.severity === "critical").length;

  return (
    <AdminModuleShell
      activePath="/admin/security"
      title="Security Dashboard"
      summary="Prüft Auth, Rollen, ENV, Routen, Backups, Audit-Log und KI-/Upload-Policies — ohne Secrets."
      actions={
        <HealthBadge
          status={criticalWarnings === 0 ? "ok" : "error"}
          label={criticalWarnings === 0 ? "Keine kritischen Warnungen" : `${criticalWarnings} kritisch`}
        />
      }
    >
      <p className="uwe-dashboard-muted" style={{ marginBottom: "1rem" }}>
        Stand: {DATE_FORMAT.format(new Date(status.timestamp))} · Angemeldet: {access.displayName} (
        {SECURITY_ROLE_LABELS[access.userRole ?? ""] ?? access.userRole})
      </p>

      {status.warnings.length > 0 && (
        <section className="uwe-card" style={{ marginBottom: "1rem" }}>
          <h2 className="uwe-section-title">Warnungen</h2>
          <ul className="uwe-dashboard-list">
            {status.warnings.map((warning) => (
              <li key={warning.id}>
                <strong>{warning.title}</strong>
                <span className="uwe-badge">{warning.severity}</span>
                <p>{warning.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="uwe-dashboard-grid">
        <StatusCard
          title="Auth"
          level={boolLevel(status.auth.active)}
          statusLabel={status.auth.active ? "Aktiv" : "Inaktiv"}
          message={status.auth.message}
          details={[
            { label: "Portal AUTH_REQUIRED", value: status.auth.portalAuthRequired },
            { label: "Session-Secret", value: status.env.sessionSecret.strong },
          ]}
        />

        <StatusCard
          title="Benutzer-Rollen"
          level="ok"
          statusLabel="Zählung"
          message="Globale User-Rollen in der Datenbank (OWNER/ADMIN/DM/PLAYER)."
          details={[
            { label: "OWNER", value: status.roleCounts.owner },
            { label: "ADMIN", value: status.roleCounts.admin },
            { label: "DM", value: status.roleCounts.dm },
            { label: "PLAYER", value: status.roleCounts.player },
          ]}
        />

        <StatusCard
          title="Cloudflare Access"
          level="degraded"
          statusLabel="Manuell prüfen"
          message={status.cloudflareAccess.note}
          details={status.cloudflareAccess.checklist.map((item, index) => ({
            label: `Check ${index + 1}`,
            value: item,
          }))}
          wide
        />

        <StatusCard
          title="ENV Status"
          level={
            status.env.sessionSecret.strong && (!status.env.setupToken.active || status.env.setupToken.secure)
              ? "ok"
              : "error"
          }
          statusLabel="Konfiguration"
          message="Secrets werden nicht angezeigt — nur Status."
          details={[
            { label: status.env.sessionSecret.envKey, value: status.env.sessionSecret.message },
            { label: "UWE_SETUP_TOKEN", value: status.env.setupToken.message },
            { label: status.env.rtxServiceToken.envKey, value: status.env.rtxServiceToken.message },
          ]}
        />

        <StatusCard
          title="Public Routes"
          level={status.publicRoutes.studioAdminProtected ? "ok" : "error"}
          statusLabel={
            status.publicRoutes.studioAdminProtected ? "Studio geschützt" : "Studio exponiert"
          }
          message={`Player-Routen öffentlich: ${status.publicRoutes.playerRoutesPublic ? "ja" : "nein"}`}
          details={status.publicRoutes.details.map((detail) => {
            const [label, value] = detail.split(": ");
            return { label, value: value ?? detail };
          })}
        />

        <StatusCard
          title="Backup"
          level={status.backup.backupCount > 0 ? "ok" : "degraded"}
          statusLabel={status.backup.restoreAvailable ? "Restore verfügbar" : "Kein Backup"}
          message={status.backup.message}
          details={[
            { label: "Backups", value: status.backup.backupCount },
            {
              label: "Letztes Backup",
              value: status.backup.lastBackupAt
                ? DATE_FORMAT.format(new Date(status.backup.lastBackupAt))
                : null,
            },
            { label: "Datei", value: status.backup.lastBackupFilename },
          ]}
          nextSteps={
            status.backup.backupCount === 0
              ? ["Erstelle ein Vollbackup unter /backup."]
              : []
          }
        />

        <StatusCard
          title="Upload Policy"
          level="ok"
          statusLabel="Aktiv"
          message={status.uploadPolicy.note}
          details={[
            { label: "Max. Größe", value: status.uploadPolicy.maxSizeLabel },
            { label: "Erlaubte Typen", value: status.uploadPolicy.allowedTypes.join(", ") },
          ]}
        />

        <StatusCard
          title="AI Policy"
          level={status.aiPolicy.enabled ? "ok" : "disabled"}
          statusLabel={status.aiPolicy.enabled ? "Aktiv" : "Deaktiviert"}
          message={status.aiPolicy.message}
          details={[
            { label: "Local Only", value: status.aiPolicy.localOnly },
            { label: "Modelle", value: status.aiPolicy.allowedModels.join(", ") },
            ...status.aiPolicy.rateLimits.map((limit, index) => ({
              label: `Rate Limit ${index + 1}`,
              value: limit,
            })),
          ]}
        />
      </div>

      {status.auditLog.length > 0 && (
        <section className="uwe-card" style={{ marginTop: "1rem" }}>
          <h2 className="uwe-section-title">Audit Log (Sicherheit)</h2>
          <ul className="uwe-dashboard-list">
            {status.auditLog.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.action}</strong>
                {entry.worldSlug ? ` · ${entry.worldSlug}` : ""}
                <p>
                  {DATE_FORMAT.format(new Date(entry.createdAt))}
                  {" — "}
                  {entry.summary}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="uwe-dashboard-muted" style={{ marginTop: "1.5rem" }}>
        JSON-API: <Link href="/api/admin/security">/api/admin/security</Link>
      </p>
    </AdminModuleShell>
  );
}
