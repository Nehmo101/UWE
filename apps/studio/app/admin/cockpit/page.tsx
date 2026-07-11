import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import {
  formatUsdAmount,
  getOwnerCockpitSnapshot,
  OWNER_COCKPIT_ERROR_SOURCE_LABELS,
  prisma,
  UNIFIED_ACTIVITY_SOURCE_LABELS,
} from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { buttonVariants, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";
import { formatStudioDateTime } from "@/src/lib/format";
import { OwnerCockpitRefresh } from "./OwnerCockpitRefresh";

export default async function OwnerCockpitPage() {
  const snapshot = await getOwnerCockpitSnapshot(prisma);

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail items={[{ label: "Admin", href: "/admin" }, { label: "Owner Cockpit" }]} />
      }
    >
      <PageHeader
        title="Owner Cockpit"
        summary="Aktive Welten, Nutzer, letzte Fehler, AI-Kosten und letzte Änderungen — read-only, ohne Secrets."
        actions={
          <HealthBadge
            status={snapshot.ok ? "ok" : "degraded"}
            label={snapshot.ok ? "Alles OK" : "Aufmerksamkeit nötig"}
          />
        }
      />

      <div className="flex flex-col gap-6">
        <OwnerCockpitRefresh />

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Nutzer</h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{snapshot.users.total} aktive Rollen-Zählung</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">
                Owner {snapshot.users.byRole.owner} · Admin {snapshot.users.byRole.admin} · DM{" "}
                {snapshot.users.byRole.dm} · Spieler {snapshot.users.byRole.player}
              </p>
              <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href="/admin/users">
                Benutzerverwaltung
              </Link>
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Welten ({snapshot.worlds.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {snapshot.worlds.map((world) => (
              <Card key={world.id}>
                <CardHeader>
                  <CardTitle className="text-base">{world.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-start gap-3">
                  <p className="text-sm text-muted-foreground">
                    {world.pageCount} Seiten · {world.memberCount} Mitglieder
                  </p>
                  <Link
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                    href={`/worlds/${world.slug}`}
                  >
                    Welt öffnen
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Letzte Fehler</h2>
          {snapshot.errors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine offenen Fehler.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {snapshot.errors.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-start gap-3">
                    <p className="text-sm text-muted-foreground">
                      {OWNER_COCKPIT_ERROR_SOURCE_LABELS[item.source]} · {item.detail}
                    </p>
                    <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href={item.href}>
                      Details
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">AI-Kosten</h2>
          <p className="text-sm">
            Heute {formatUsdAmount(snapshot.aiUsage.todayCostUsd)} · 7 Tage{" "}
            {formatUsdAmount(snapshot.aiUsage.last7DaysCostUsd)}
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Letzte Änderungen</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {snapshot.recentActivity.map((entry) => (
              <Card key={entry.id}>
                <CardHeader>
                  <CardTitle className="text-base">{entry.actionLabel}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
                  <p className="text-sm">{entry.summary}</p>
                  <p className="text-sm text-muted-foreground">
                    {UNIFIED_ACTIVITY_SOURCE_LABELS[
                      entry.source as keyof typeof UNIFIED_ACTIVITY_SOURCE_LABELS
                    ] ?? entry.source}{" "}
                    · {formatStudioDateTime(entry.timestamp.toISOString())}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </SystemShell>
  );
}
