import Link from "next/link";
import {
  AppShell,
  EmptyState,
  HealthBadge,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import { CAPTURE_TYPE_LABELS, formatEuroFromCents, prisma } from "@uwe/database/server";
import { adminSidebarNav } from "@/src/lib/admin-sidebar-nav";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";
import { getTodayDashboardData } from "@/src/lib/today-dashboard";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function statusDot(ok: boolean, warn = false): "ok" | "warn" | "error" {
  if (ok) return "ok";
  return warn ? "warn" : "error";
}

export default async function TodayPage() {
  const useMockInference = process.env.AI_USE_MOCK === "true";
  const data = await getTodayDashboardData(prisma, { useMockInference });

  return (
    <AppShell
      bottomNav={studioGlobalBottomNav("today")}
      contextTitle="Admin Cockpit"
      topBar={<TopBarBrand appName="UWE Studio" subtitle="Heute" href="/today" />}
      sidebar={
        <SidebarSection title="UWE Admin">
          <SidebarNav items={adminSidebarNav("/today")} />
        </SidebarSection>
      }
      main={
        <>
          <PageHeader
            title="Heute"
            summary="Dein Daily Cockpit — DnD, Projekte, Capture, Technik und System auf einen Blick."
            actions={
              <Link href="/capture?quick=1" className="uwe-btn uwe-btn-primary">
                + Capture
              </Link>
            }
          />

          <section className="uwe-section">
            <h2 className="uwe-section-title">System-Ampel</h2>
            <div className="uwe-system-ampel">
              <span className="uwe-system-ampel-item" data-status={statusDot(data.systemOk)}>
                UWE {data.systemLabel}
              </span>
              <span className="uwe-system-ampel-item" data-status={statusDot(true)}>
                DB OK
              </span>
              <span className="uwe-system-ampel-item" data-status={statusDot(data.rtxReady, true)}>
                RTX {data.rtxReady ? "bereit" : "offline"}
              </span>
              <span
                className="uwe-system-ampel-item"
                data-status={statusDot(data.brainEnabled, !data.brainEnabled)}
              >
                Brain {data.brainEnabled ? "aktiv" : "aus"}
              </span>
              <span className="uwe-system-ampel-item" data-status={statusDot(data.mailOk, true)}>
                Mail {data.mailOk ? "OK" : "prüfen"}
              </span>
              <span
                className="uwe-system-ampel-item"
                data-status={statusDot(data.portalAuthRequired, !data.portalAuthRequired)}
              >
                Portal {data.portalAuthRequired ? "Auth" : "offen"}
              </span>
            </div>
            <p className="uwe-dashboard-muted">
              <Link href="/admin/status">Details im Systemstatus →</Link>
            </p>
          </section>

          <div className="uwe-dashboard-grid">
            <section className="uwe-card uwe-dashboard-card">
              <h2 className="uwe-section-title">DnD / Welten</h2>
              {data.preferredWorld ? (
                <>
                  <p>
                    Bevorzugte Welt:{" "}
                    <Link href={`/worlds/${data.preferredWorld.slug}/dashboard`}>
                      {data.preferredWorld.name}
                    </Link>
                  </p>
                  {data.nextSession ? (
                    <p className="uwe-dashboard-muted">
                      Nächste Session #{data.nextSession.sessionNumber}: {data.nextSession.title}
                      {data.nextSession.date
                        ? ` · ${DATE_FORMAT.format(data.nextSession.date)}`
                        : ""}
                    </p>
                  ) : (
                    <p className="uwe-dashboard-muted">Keine geplante Session.</p>
                  )}
                </>
              ) : (
                <EmptyState
                  title="Noch keine Welt"
                  description="Lege eine DnD-Welt an, um Sessions und Welten hier zu sehen."
                  action={<Link href="/worlds">Welten anlegen</Link>}
                />
              )}
            </section>

            <section className="uwe-card uwe-dashboard-card">
              <h2 className="uwe-section-title">Capture Inbox</h2>
              <p>{data.lifeAdmin.inboxCaptureCount} offene Einträge</p>
              {data.lifeAdmin.recentCaptures.length > 0 ? (
                <div className="uwe-today-card-list">
                  {data.lifeAdmin.recentCaptures.map((capture) => (
                    <article key={capture.id} className="uwe-today-card">
                      <h3>{capture.title || "Ohne Titel"}</h3>
                      <p>
                        {CAPTURE_TYPE_LABELS[capture.captureType]} ·{" "}
                        {DATE_FORMAT.format(capture.capturedAt)}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="uwe-dashboard-muted">Inbox ist leer — tippe + Capture.</p>
              )}
              <p>
                <Link href="/capture">Zur Capture Inbox →</Link>
              </p>
            </section>

            <section className="uwe-card uwe-dashboard-card">
              <h2 className="uwe-section-title">Projekte</h2>
              <p>{data.lifeAdmin.activeProjectCount} aktiv / geplant</p>
              <div className="uwe-today-card-list">
                {data.lifeAdmin.activeProjects.map((project) => (
                  <article key={project.id} className="uwe-today-card">
                    <h3>{project.name}</h3>
                    <p>{project.nextAction || project.status}</p>
                  </article>
                ))}
              </div>
              <p>
                <Link href="/projects">Alle Projekte →</Link>
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

            <section className="uwe-card uwe-dashboard-card">
              <h2 className="uwe-section-title">Hardware / Homelab</h2>
              <p>
                {data.lifeAdmin.hardwareIssues > 0
                  ? `${data.lifeAdmin.hardwareIssues} Gerät(e) offline/defekt`
                  : "Keine akuten Hardware-Probleme"}
              </p>
              {data.lifeAdmin.hardwareUrlWarnings.length > 0 && (
                <p className="uwe-form-error">
                  {data.lifeAdmin.hardwareUrlWarnings.length} URL-Warnung(en) —{" "}
                  <Link href="/hardware">Hardware prüfen</Link>
                </p>
              )}
              {data.lifeAdmin.openSetupSteps > 0 && (
                <p className="uwe-dashboard-muted">
                  {data.lifeAdmin.openSetupSteps} offene Setup-Schritte
                </p>
              )}
              <p>
                <Link href="/hardware">Hardware-Cockpit →</Link>
              </p>
            </section>
          </div>

          <p className="uwe-dashboard-muted">
            <HealthBadge status={data.systemOk ? "ok" : "degraded"} label={data.systemLabel} />
          </p>
        </>
      }
    />
  );
}
