import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import {
  getOwnerCockpitSnapshot,
  prisma,
  UNIFIED_ACTIVITY_SOURCE_LABELS,
} from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { formatStudioDateTime } from "@/src/lib/format";

export default async function OwnerCockpitPage() {
  const snapshot = await getOwnerCockpitSnapshot(prisma);

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Owner Cockpit" },
          ]}
        />
      }
    >
      <PageHeader
        title="Owner Cockpit"
        summary="Aktive Welten, Nutzer, Fehler und letzte Änderungen — read-only, ohne Secrets."
        actions={
          <HealthBadge
            status={snapshot.ok ? "ok" : "degraded"}
            label={snapshot.ok ? "Alles OK" : "Aufmerksamkeit nötig"}
          />
        }
      />

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Nutzer</h2>
        <div className="uwe-today-card-list">
          <article className="uwe-today-card">
            <h3>{snapshot.users.total} aktive Rollen-Zählung</h3>
            <p className="uwe-dashboard-muted">
              Owner {snapshot.users.byRole.owner} · Admin {snapshot.users.byRole.admin} · DM{" "}
              {snapshot.users.byRole.dm} · Spieler {snapshot.users.byRole.player}
            </p>
            <p className="uwe-dashboard-muted">{snapshot.users.inactive} deaktivierte Konten</p>
            <Link className="uwe-v2-btn uwe-v2-btn-sm uwe-v2-btn-secondary" href="/admin/users">
              Benutzerverwaltung
            </Link>
          </article>
        </div>
      </section>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Welten ({snapshot.worlds.length})</h2>
        <div className="uwe-today-card-list">
          {snapshot.worlds.map((world) => (
            <article key={world.id} className="uwe-today-card">
              <h3>
                {world.name}
                {world.isSandbox ? " (Sandbox)" : ""}
              </h3>
              <p className="uwe-dashboard-muted">
                {world.pageCount} Seiten · {world.memberCount} Mitglieder
                {world.lastActivityAt
                  ? ` · letzte Aktivität ${formatStudioDateTime(world.lastActivityAt)}`
                  : ""}
              </p>
              <Link className="uwe-v2-btn uwe-v2-btn-sm uwe-v2-btn-secondary" href={`/worlds/${world.slug}`}>
                Welt öffnen
              </Link>
            </article>
          ))}
        </div>
      </section>

      {snapshot.errors.length > 0 && (
        <section className="uwe-v2-section">
          <h2 className="uwe-v2-section-title">Fehler & Warnungen</h2>
          <div className="uwe-today-card-list">
            {snapshot.errors.map((item) => (
              <article key={item.id} className="uwe-today-card">
                <h3>{item.title}</h3>
                <p className="uwe-dashboard-muted">{item.detail}</p>
                <p className="uwe-dashboard-muted">{formatStudioDateTime(item.timestamp)}</p>
                <Link className="uwe-v2-btn uwe-v2-btn-sm uwe-v2-btn-secondary" href={item.href}>
                  Details
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="uwe-v2-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <h2 className="uwe-v2-section-title">Letzte Änderungen</h2>
          <Link className="uwe-v2-btn uwe-v2-btn-secondary" href="/admin/activity">
            Vollständiger Verlauf
          </Link>
        </div>
        <div className="uwe-today-card-list">
          {snapshot.recentActivity.map((entry) => (
            <article key={entry.id} className="uwe-today-card">
              <h3>{entry.actionLabel}</h3>
              <p>{entry.summary}</p>
              <p className="uwe-dashboard-muted">
                {UNIFIED_ACTIVITY_SOURCE_LABELS[entry.source as keyof typeof UNIFIED_ACTIVITY_SOURCE_LABELS] ?? entry.source} · {formatStudioDateTime(entry.timestamp.toISOString())}
              </p>
            </article>
          ))}
        </div>
      </section>
    </SystemShell>
  );
}
