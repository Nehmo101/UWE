import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import { getAdminOnboardingChecklist, prisma } from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { requireAdminAccess } from "@/src/lib/auth";
import { Badge, type BadgeProps, Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";

function statusLabel(status: string): string {
  switch (status) {
    case "done":
      return "Erledigt";
    case "optional":
      return "Optional";
    case "warning":
      return "Handlung nötig";
    default:
      return "Offen";
  }
}

function statusVariant(status: string): BadgeProps["variant"] {
  switch (status) {
    case "done":
      return "success";
    case "optional":
      return "secondary";
    case "warning":
      return "warning";
    default:
      return "default";
  }
}

export default async function AdminChecklistPage() {
  await requireAdminAccess();
  const checklist = await getAdminOnboardingChecklist(prisma);

  const categories = [...new Set(checklist.items.map((item) => item.category))];

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Aufgabenliste" },
          ]}
        />
      }
    >
      <PageHeader
        title="Admin-Aufgabenliste"
        summary="Einheitliche Owner-Checkliste mit Fortschritt — System, Zugriff, Mail, RTX, Welten, Migrationen und Backup."
        actions={
          <HealthBadge
            status={checklist.progressPercent >= 80 ? "ok" : "degraded"}
            label={`${checklist.progressPercent}%`}
          />
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Fortschritt</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={checklist.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${checklist.progressPercent}%` }} />
          </div>
          <p className="text-sm text-muted-foreground">
            {checklist.completedCount} von {checklist.totalCount} Punkten erledigt ·{" "}
            {checklist.openCount} offen
            {checklist.warningCount > 0 ? ` · ${checklist.warningCount} mit Warnung` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            Basierend auf{" "}
            <Link href="/admin/setup">Owner-Einrichtung</Link>, Migrationen, Welten und Backup-Status.
            Punkte mit „Auto“ werden live aus der Datenbank bzw. Systemstatus ermittelt.
          </p>
        </CardContent>
      </Card>

      {categories.map((category) => (
        <section key={category} className="mb-6 flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">{category}</h2>
          <ul className="grid gap-2">
            {checklist.items
              .filter((item) => item.category === category)
              .map((item) => (
                <li
                  key={item.id}
                  className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <strong>{item.title}</strong>
                      {item.autoDetected ? (
                        <Badge variant="secondary" className="ml-2">
                          Auto
                        </Badge>
                      ) : null}
                      <p className="mt-1.5 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                  </div>
                  {item.href ? (
                    <p className="mt-2">
                      <Link href={item.href}>Öffnen →</Link>
                    </p>
                  ) : null}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </SystemShell>
  );
}
