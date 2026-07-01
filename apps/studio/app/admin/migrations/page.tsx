import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import { getMigrationStatus, prisma } from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { StatusCard } from "@/src/components/AdminStatusDashboard";

function formatMigrationTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("de-DE");
}

export default async function AdminMigrationsPage() {
  const status = await getMigrationStatus(prisma);

  const level = status.ok
    ? "ok"
    : status.failedMigrations.length > 0
      ? "error"
      : "degraded";

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Migrationen" },
          ]}
        />
      }
    >
      <PageHeader
        title="Migration-Inspector"
        summary="Read-only Übersicht angewendeter, ausstehender und fehlerhafter Prisma-Migrationen — Reparatur erfolgt per CLI (`db:deploy`), nicht in der UI."
        actions={
          <HealthBadge
            status={status.ok ? "ok" : level === "error" ? "error" : "degraded"}
            label={status.ok ? "Schema aktuell" : "Handlungsbedarf"}
          />
        }
      />

      <div className="uwe-dashboard-grid">
        <StatusCard
          title="Migration-Status"
          level={level}
          statusLabel={status.ok ? "OK" : "Ausstehend oder fehlerhaft"}
          message={status.message}
          details={[
            { label: "Angewendet", value: status.appliedCount },
            { label: "Ausstehend", value: status.pendingMigrations.length },
            { label: "Fehlerhaft", value: status.failedMigrations.length },
          ]}
          nextSteps={
            status.ok
              ? []
              : [
                  "Stoppe UWE und führe `pnpm --filter @uwe/database db:deploy` auf dem Host aus.",
                  "Bei fehlerhaften Migrationen: Backup prüfen und Prisma-Migrationsdokumentation konsultieren.",
                  "Nach dem Deploy Studio neu starten und diese Seite erneut öffnen.",
                ]
          }
          wide
        />
      </div>

      {status.pendingMigrations.length > 0 && (
        <section className="uwe-v2-card" style={{ marginTop: "1rem" }}>
          <h2 className="uwe-v2-section-title">Ausstehende Migrationen</h2>
          <ul className="uwe-dashboard-list">
            {status.pendingMigrations.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
        </section>
      )}

      {status.failedDetails.length > 0 && (
        <section className="uwe-v2-card" style={{ marginTop: "1rem" }}>
          <h2 className="uwe-v2-section-title">Fehlerhafte Migrationen</h2>
          <ul className="uwe-dashboard-list">
            {status.failedDetails.map((entry) => (
              <li key={entry.name}>
                <code>{entry.name}</code>
                <p className="uwe-dashboard-muted">
                  Gestartet: {formatMigrationTimestamp(entry.startedAt)} — Migration nicht
                  abgeschlossen; Datenbank kann inkonsistent sein.
                </p>
              </li>
            ))}
          </ul>
          <p className="uwe-dashboard-muted">
            Deploy-Befehl:{" "}
            <code>pnpm --filter @uwe/database db:deploy</code>
          </p>
        </section>
      )}

      {status.appliedMigrations.length > 0 && (
        <details className="uwe-v2-card" style={{ marginTop: "1rem" }}>
          <summary className="uwe-v2-section-title" style={{ cursor: "pointer" }}>
            Angewendete Migrationen ({status.appliedMigrations.length})
          </summary>
          <ul className="uwe-dashboard-list" style={{ marginTop: "0.75rem" }}>
            {status.appliedMigrations.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="uwe-dashboard-muted" style={{ marginTop: "1.5rem" }}>
        Nur für Owner/Admin im geschützten Studio. Siehe auch{" "}
        <Link href="/admin/status">Systemstatus</Link> und{" "}
        <Link href="/admin/setup?tab=diagnose">Einrichtung → Diagnose</Link>.
      </p>
    </SystemShell>
  );
}
