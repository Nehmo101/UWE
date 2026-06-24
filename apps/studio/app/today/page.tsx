import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import { formatEuroFromCents, prisma } from "@uwe/database/server";
import { StudioCockpitAppShell } from "@/components/StudioCockpitAppShell";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";
import { getTodayDashboardData } from "@/src/lib/today-dashboard";
import { TodayDashboardClient } from "./TodayDashboardClient";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function TodayPage() {
  const useMockInference = process.env.AI_USE_MOCK === "true";
  const data = await getTodayDashboardData(prisma, { useMockInference });

  return (
    <StudioCockpitAppShell
      variant="module"
      activePath="/today"
      showRail
      railActiveId="today"
      title="Heute"
      summary="Dein Daily Cockpit — DnD, Projekte, Capture, Technik und System auf einen Blick."
      actions={
        <Link href="/capture?quick=1" className="uwe-btn uwe-btn-primary">
          + Capture
        </Link>
      }
      bottomNav={studioGlobalBottomNav("today")}
    >
      <TodayDashboardClient data={data} />

      <div className="uwe-dashboard-grid">
        <section className="uwe-card uwe-dashboard-card">
          <h2 className="uwe-section-title">Kalender — Heute</h2>
          {data.calendarToday.length > 0 ? (
            <div className="uwe-today-card-list">
              {data.calendarToday.map((item) => (
                <article key={item.id} className="uwe-today-card">
                  <h3>{item.title}</h3>
                  <p>
                    {item.moduleLabel}
                    {item.allDay ? "" : ` · ${DATE_FORMAT.format(item.startAt)}`}
                    {item.urgency === "overdue" ? " · überfällig" : ""}
                  </p>
                  {item.href && (
                    <p>
                      <Link href={item.href}>Details →</Link>
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="uwe-dashboard-muted">Keine Termine oder Fristen für heute.</p>
          )}
          {data.calendarThisWeek.length > 0 && (
            <>
              <h3 className="uwe-section-subtitle">Diese Woche</h3>
              <div className="uwe-today-card-list">
                {data.calendarThisWeek.slice(0, 5).map((item) => (
                  <article key={item.id} className="uwe-today-card">
                    <h3>{item.title}</h3>
                    <p>
                      {item.moduleLabel} · {DATE_FORMAT.format(item.startAt)}
                    </p>
                  </article>
                ))}
              </div>
            </>
          )}
          <p>
            <Link href="/calendar">Kalender öffnen →</Link>
          </p>
        </section>

        <section className="uwe-card uwe-dashboard-card">
          <h2 className="uwe-section-title">Mail Center</h2>
          {data.mailSummary.recentFailed > 0 ? (
            <p className="uwe-form-error">
              {data.mailSummary.recentFailed} fehlgeschlagenen Sendung(en)
              {data.mailSummary.latestFailedSubject
                ? `: ${data.mailSummary.latestFailedSubject}`
                : ""}
            </p>
          ) : (
            <p className="uwe-dashboard-muted">Keine fehlgeschlagenen Mails.</p>
          )}
          {data.mailSummary.pendingCount > 0 && (
            <p className="uwe-dashboard-muted">
              {data.mailSummary.pendingCount} ausstehende Log-Einträge
            </p>
          )}
          <div className="uwe-today-card-list">
            {data.nextSession && data.nextSession.date && (
              <p>
                <Link
                  href={`/mail/compose?kind=session_reminder&worldSlug=${data.nextSession.worldSlug}&sourceId=${data.nextSession.id}`}
                >
                  Session-Erinnerung vorbereiten
                </Link>
              </p>
            )}
            <p>
              <Link href="/mail/compose?kind=backup_warning">Backup-Warnung vorbereiten</Link>
            </p>
          </div>
          <p>
            <Link href="/mail">Mail Center →</Link>
          </p>
        </section>

        <section className="uwe-card uwe-dashboard-card">
          <h2 className="uwe-section-title">Werkstatt</h2>
          <p>{data.lifeAdmin.activeWorkshopCount} in Arbeit / geplant</p>
          {data.lifeAdmin.workshopOpenTasks.length > 0 ? (
            <div className="uwe-today-card-list">
              {data.lifeAdmin.workshopOpenTasks.map((task) => (
                <article key={task.id} className="uwe-today-card">
                  <h3>
                    <Link href={task.href}>{task.title}</Link>
                  </h3>
                  <p>{task.nextAction}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="uwe-today-card-list">
              {data.lifeAdmin.activeWorkshops.map((workshop) => (
                <article key={workshop.id} className="uwe-today-card">
                  <h3>
                    <Link href={`/workshop/${workshop.id}`}>{workshop.title}</Link>
                  </h3>
                  <p>{workshop.nextAction || workshop.status}</p>
                </article>
              ))}
            </div>
          )}
          <p>
            <Link href="/workshop">Werkstatt öffnen →</Link>
          </p>
        </section>

        <section className="uwe-card uwe-dashboard-card">
          <h2 className="uwe-section-title">Verträge & Ausgaben</h2>
          <p>
            {data.lifeAdmin.contractsNeedingReview > 0
              ? `${data.lifeAdmin.contractsNeedingReview} zur Prüfung`
              : "Keine offenen Prüfungen"}
          </p>
          {data.lifeAdmin.contractCosts.activeCount > 0 && (
            <p className="uwe-dashboard-muted">
              ~{formatEuroFromCents(data.lifeAdmin.contractCosts.monthlyTotalCents)}/Monat ·{" "}
              {formatEuroFromCents(data.lifeAdmin.contractCosts.yearlyTotalCents)}/Jahr (
              {data.lifeAdmin.contractCosts.activeCount} aktiv)
            </p>
          )}
          {data.lifeAdmin.contractAlerts.length > 0 && (
            <ul className="uwe-today-card-list">
              {data.lifeAdmin.contractAlerts.slice(0, 3).map((alert) => (
                <li key={alert.contractId} className="uwe-today-card">
                  {alert.message}
                </li>
              ))}
            </ul>
          )}
          <p>
            <Link href="/contracts">Verträge verwalten →</Link>
          </p>
        </section>
      </div>

      <p className="uwe-dashboard-muted">
        <HealthBadge status={data.systemOk ? "ok" : "degraded"} label={data.systemLabel} />
      </p>
    </StudioCockpitAppShell>
  );
}
