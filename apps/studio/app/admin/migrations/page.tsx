import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import { getMigrationStatus, prisma } from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { StatusCard } from "@/src/components/AdminStatusDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Ausstehende Migrationen</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {status.pendingMigrations.map((name) => (
                <li key={name}>
                  <code>{name}</code>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {status.failedDetails.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Fehlerhafte Migrationen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2 text-sm">
              {status.failedDetails.map((entry) => (
                <li key={entry.name}>
                  <code>{entry.name}</code>
                  <p className="text-sm text-muted-foreground">
                    Gestartet: {formatMigrationTimestamp(entry.startedAt)} — Migration nicht
                    abgeschlossen; Datenbank kann inkonsistent sein.
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Deploy-Befehl:{" "}
              <code>pnpm --filter @uwe/database db:deploy</code>
            </p>
          </CardContent>
        </Card>
      )}

      {status.appliedMigrations.length > 0 && (
        <details className="mt-4 rounded-[var(--radius)] border border-border bg-card p-6 text-card-foreground shadow-sm">
          {/* TODO(design-kit): Card hat kein natives <details>-Äquivalent; Radix Collapsible wäre die kit-konforme Lösung für aufklappbare Sections. */}
          <summary className="cursor-pointer list-none font-semibold leading-none tracking-tight">
            Angewendete Migrationen ({status.appliedMigrations.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {status.appliedMigrations.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        Nur für Owner/Admin im geschützten Studio. Siehe auch{" "}
        <Link href="/system?tab=diagnose">System-Diagnose</Link> und{" "}
        <Link href="/admin/setup?tab=diagnose">Einrichtung → Diagnose</Link>.
      </p>
    </SystemShell>
  );
}
