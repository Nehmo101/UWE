import Link from "next/link";
import { getCurrentAuthUser, requireOwner } from "@/src/lib/auth";
import { getSystemStatus, prisma } from "@uwe/database/server";
import { SystemShell } from "@/src/components/shell/SystemShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Alert } from "@/src/components/ui/states";
import { HostRestartPanel } from "@/components/HostRestartPanel";

export const dynamic = "force-dynamic";

const yn = (v: boolean) => (v ? "Ja" : "Nein");

export default async function SystemHostControlPage() {
  await requireOwner();
  const [status, user] = await Promise.all([getSystemStatus(prisma), getCurrentAuthUser()]);
  const canTriggerHostRestart = user?.role === "owner";

  const overview = [
    { label: "Gesamtstatus", value: status.ok ? "OK" : "Aufmerksamkeit nötig" },
    { label: "Version", value: status.version },
    { label: "Commit", value: status.commit ?? "—" },
    { label: "Node-Umgebung", value: status.app.nodeEnv },
  ];

  const database = [
    { label: "Datenbank erreichbar", value: yn(status.database.ok) },
    { label: "Meldung", value: status.database.message },
    { label: "Migrationen angewendet", value: String(status.migrations.appliedCount) },
    { label: "Migrationen ausstehend", value: String(status.migrations.pendingMigrations.length) },
    { label: "Migrationen fehlgeschlagen", value: String(status.migrations.failedMigrations.length) },
  ];

  const storage = [
    { label: "Uploads beschreibbar", value: yn(status.storage.uploadsWritable) },
    { label: "Backups beschreibbar", value: yn(status.storage.backupsWritable) },
    { label: "Exports beschreibbar", value: yn(status.storage.exportsWritable) },
    {
      label: "DB-Datei vorhanden",
      value: status.storage.databaseFileExists === null ? "—" : yn(status.storage.databaseFileExists),
    },
  ];

  const security = [
    { label: "Studio-Login", value: status.trust.studioLogin },
    { label: "AUTH_SECRET konfiguriert", value: yn(status.trust.authSecretConfigured) },
    { label: "AUTH_SECRET schwach", value: yn(status.trust.authSecretLooksWeak) },
    { label: "Studio-API-Token konfiguriert", value: yn(status.trust.studioApiTokenConfigured) },
    { label: "Öffentliches Portal-Sharing", value: yn(status.trust.publicPortalSharingEnabled) },
  ];

  const services = [
    { label: "Mail aktiviert", value: yn(status.mail.enabled) },
    { label: "Mail konfiguriert", value: yn(status.mail.configured) },
    { label: "Mail Mock-Modus", value: yn(status.mail.useMock) },
    { label: "Rate-Limiter", value: status.rateLimiter.mode },
  ];

  return (
    <SystemShell breadcrumb={<span>System / Host Control</span>}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Host Control</h1>
          <p className="text-sm text-muted-foreground">
            Owner-Übersicht des Systemzustands. Status ohne geheime Werte — fehlende Konfiguration
            wird angezeigt. Kritische Aktionen (Backup/Restore, Migrationen, Host-Neustart) erfordern
            Bestätigung und werden im Audit-Log protokolliert.
          </p>
        </header>

        {status.ok ? (
          <Alert tone="success" icon="shield-check" title="System gesund">
            Datenbank, Migrationen und Storage sind in Ordnung.
          </Alert>
        ) : (
          <Alert tone="warning" icon="server-cog" title="System braucht Aufmerksamkeit">
            Mindestens ein Bereich (Datenbank, Migrationen oder Storage) ist nicht OK — siehe unten.
          </Alert>
        )}

        {status.trust.authSecretConfigured ? null : (
          <Alert tone="danger" icon="shield" title="AUTH_SECRET fehlt">
            Es ist kein <code>AUTH_SECRET</code>/<code>SESSION_SECRET</code> gesetzt. In Produktion
            ist das erforderlich.
          </Alert>
        )}

        <StatusCard title="Überblick" rows={overview} />
        <StatusCard title="Datenbank & Migrationen" rows={database} />
        <StatusCard title="Storage" rows={storage} />
        <StatusCard title="Sicherheit" rows={security} />
        <StatusCard title="Dienste" rows={services} />

        <HostRestartPanel canTrigger={canTriggerHostRestart} />

        <Card>
          <CardHeader>
            <CardTitle>Diagnose</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">
              Healthcheck-Endpunkt:{" "}
              <Link href="/api/health" className="underline">
                /api/health
              </Link>
            </p>
            <p className="text-muted-foreground">
              Audit-Log:{" "}
              <Link href="/admin/audit-log" className="underline">
                /admin/audit-log
              </Link>{" "}
              · Cloudflare:{" "}
              <Link href="/system/cloudflare" className="underline">
                /system/cloudflare
              </Link>{" "}
              · Backup:{" "}
              <Link href="/backup" className="underline">
                /backup
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </SystemShell>
  );
}

function StatusCard({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[16rem_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-mono break-all">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
