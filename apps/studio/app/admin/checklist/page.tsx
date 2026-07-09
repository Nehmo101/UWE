import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import { getAdminOnboardingChecklist, prisma } from "@uwe/database/server";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { requireAdminAccess } from "@/src/lib/auth";

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

function statusClass(status: string): string {
  switch (status) {
    case "done":
      return "uwe-badge uwe-badge-published";
    case "optional":
      return "uwe-badge uwe-badge-draft";
    case "warning":
      return "uwe-badge uwe-badge-secret";
    default:
      return "uwe-badge uwe-badge-player";
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

      <section className="uwe-v2-card" style={{ marginBottom: "1.5rem" }}>
        <h2 className="uwe-v2-section-title">Fortschritt</h2>
        <div className="uwe-jobs-progress" style={{ marginBottom: "0.75rem" }}>
          <div
            className="uwe-jobs-progress-bar"
            style={{ width: `${checklist.progressPercent}%` }}
          />
        </div>
        <p className="uwe-dashboard-muted">
          {checklist.completedCount} von {checklist.totalCount} Punkten erledigt ·{" "}
          {checklist.openCount} offen
          {checklist.warningCount > 0 ? ` · ${checklist.warningCount} mit Warnung` : ""}
        </p>
        <p className="uwe-hint">
          Basierend auf{" "}
          <Link href="/admin/setup">Owner-Einrichtung</Link>, Migrationen, Welten und Backup-Status.
          Punkte mit „Auto“ werden live aus der Datenbank bzw. Systemstatus ermittelt.
        </p>
      </section>

      {categories.map((category) => (
        <section key={category} className="uwe-v2-section">
          <h2 className="uwe-v2-section-title">{category}</h2>
          <ul className="uwe-list-cards">
            {checklist.items
              .filter((item) => item.category === category)
              .map((item) => (
                <li key={item.id} className="uwe-list-card">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                    <div>
                      <strong>{item.title}</strong>
                      {item.autoDetected ? (
                        <span className="uwe-badge uwe-badge-draft" style={{ marginLeft: "0.5rem" }}>
                          Auto
                        </span>
                      ) : null}
                      <p className="uwe-dashboard-muted" style={{ marginTop: "0.35rem" }}>
                        {item.description}
                      </p>
                    </div>
                    <span className={statusClass(item.status)}>{statusLabel(item.status)}</span>
                  </div>
                  {item.href ? (
                    <p style={{ marginTop: "0.5rem" }}>
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
