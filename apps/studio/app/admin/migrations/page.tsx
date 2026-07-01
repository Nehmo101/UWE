import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import { getMigrationStatus, prisma } from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { StatusCard } from "@/src/components/AdminStatusDashboard";

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
        summary="Prüft, ob alle Prisma-Migrationen aus diesem Build auf der Datenbank angewendet wurden — ohne Schema- oder Secret-Details."
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

      {status.failedMigrations.length > 0 && (
        <section className="uwe-v2-card" style={{ marginTop: "1rem" }}>
          <h2 className="uwe-v2-section-title">Fehlerhafte Migrationen</h2>
          <ul className="uwe-dashboard-list">
            {status.failedMigrations.map((name) => (
              <li key={name}>
                <code>{name}</code>
                <p className="uwe-dashboard-muted">
                  Migration gestartet, aber nicht abgeschlossen — Datenbank kann inkonsistent sein.
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="uwe-dashboard-muted" style={{ marginTop: "1.5rem" }}>
        Nur für Owner/Admin im geschützten Studio. Siehe auch{" "}
        <Link href="/admin/status">Systemstatus</Link> und{" "}
        <Link href="/admin/setup?tab=diagnose">Einrichtung → Diagnose</Link>.
      </p>
    </SystemShell>
  );
}
