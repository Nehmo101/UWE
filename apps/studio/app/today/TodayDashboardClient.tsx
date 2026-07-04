"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  EmptyState,
  LayoutEditToolbar,
  LayoutEditorProvider,
  SortableWidgetGrid,
  useDashboardLayout,
} from "@uwe/shared-ui";
import { CAPTURE_TYPE_LABELS } from "@uwe/database/capture-constants";
import { markMaintenanceDoneAction } from "@/app/household-actions";
import { formatEuroFromCents } from "@uwe/database/contract-expense-utils";
import { STUDIO_TODAY_PAGE_KEY, mergeMissingDefaultWidgets } from "@uwe/database/dashboard-layout";
import type { DashboardWidgetConfig } from "@uwe/database/dashboard-layout";
import type { TodayDashboardData } from "@/src/lib/today-dashboard";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const DATE_ONLY_FORMAT = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

const MAIL_CATEGORY_LABELS: Record<string, string> = {
  urgent: "Dringend",
  reply_needed: "Antwort nötig",
  today: "Heute",
};

function statusDot(ok: boolean, warn = false): "ok" | "warn" | "error" {
  if (ok) return "ok";
  return warn ? "warn" : "error";
}

/** Maps an Ampel status to the shared colored-dot classes (the Parchment "Pünktchen"). */
const AMPEL_DOT: Record<"ok" | "warn" | "error", string> = {
  ok: "uwe-dot uwe-dot-success",
  warn: "uwe-dot uwe-dot-warning",
  error: "uwe-dot uwe-dot-danger",
};

interface TodayDashboardClientProps {
  data: TodayDashboardData;
}

export function TodayDashboardClient({ data }: TodayDashboardClientProps) {
  const layout = useDashboardLayout({ pageKey: STUDIO_TODAY_PAGE_KEY });
  const widgets = useMemo(
    () => mergeMissingDefaultWidgets(STUDIO_TODAY_PAGE_KEY, layout.widgets),
    [layout.widgets],
  );

  const renderWidget = (widget: DashboardWidgetConfig) => {
    switch (widget.widgetType) {
      case "system-ampel":
        return (
          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">System-Ampel</h2>
            <div className="uwe-system-ampel">
              {[
                { href: "/admin/status", status: statusDot(data.systemOk), label: `UWE ${data.systemLabel}` },
                { href: "/hardware", status: statusDot(data.dbOk), label: `DB ${data.dbOk ? "OK" : "Fehler"}` },
                { href: "/hardware", status: statusDot(data.backupOk, true), label: `Backup ${data.backupOk ? "OK" : "prüfen"}` },
                {
                  href: "/system/rtx-connector",
                  status: statusDot(data.rtxReady, true),
                  label: `RTX ${data.rtxReady ? "bereit" : "offline"}`,
                },
                {
                  href: "/life-brain",
                  status: statusDot(data.brainEnabled, !data.brainEnabled),
                  label: `Brain ${data.brainEnabled ? "aktiv" : "aus"}`,
                },
                { href: "/mail", status: statusDot(data.mailOk, true), label: `Mail ${data.mailOk ? "OK" : "prüfen"}` },
                {
                  href: "/settings",
                  status: statusDot(data.portalAuthRequired, !data.portalAuthRequired),
                  label: `Portal ${data.portalAuthRequired ? "Auth" : "offen"}`,
                },
                {
                  href: "/hardware",
                  status: statusDot(data.cloudflareOk, !data.cloudflareOk),
                  label: `CF ${data.cloudflareOk ? "OK" : "Tunnel"}`,
                },
              ].map((item, index) => (
                <Link
                  key={index}
                  href={item.href}
                  className="uwe-system-ampel-item"
                  data-status={item.status}
                >
                  <span className={AMPEL_DOT[item.status]} aria-hidden />
                  {item.label}
                </Link>
              ))}
            </div>
            {data.homelab.alerts.criticalCount > 0 && (
              <div className="uwe-form-error uwe-v2-section" role="alert">
                <strong>{data.homelab.alerts.criticalCount} kritische Homelab-/Security-Probleme</strong>
                <ul>
                  {data.homelab.alerts.messages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
                <p>
                  <Link href="/hardware">Hardware-Cockpit öffnen →</Link>
                </p>
              </div>
            )}
            <p className="uwe-dashboard-muted">
              <Link href="/admin/status">Details im Systemstatus →</Link>
            </p>
          </section>
        );
      case "dnd-favorite":
        return (
          <section className="uwe-v2-card uwe-dashboard-card">
            <h2 className="uwe-v2-section-title">DnD / Welten</h2>
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
                    {data.nextSession.date ? ` · ${DATE_FORMAT.format(data.nextSession.date)}` : ""}
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
        );
      case "capture-inbox":
        return (
          <section className="uwe-v2-card uwe-dashboard-card">
            <h2 className="uwe-v2-section-title">Capture Inbox</h2>
            <p>{data.lifeAdmin.inboxCaptureCount} offene Einträge</p>
            {data.lifeAdmin.recentCaptures.length > 0 ? (
              <div className="uwe-today-card-list">
                {data.lifeAdmin.recentCaptures.map((capture) => (
                  <article key={capture.id} className="uwe-today-card">
                    <h3>
                      <Link href={`/capture/${capture.id}`}>{capture.title || "Ohne Titel"}</Link>
                    </h3>
                    <p>
                      {CAPTURE_TYPE_LABELS[capture.captureType]} ·{" "}
                      {DATE_FORMAT.format(capture.capturedAt)}
                    </p>
                    <p>
                      <Link href={`/capture/${capture.id}`}>Triage →</Link>
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="uwe-dashboard-muted">Inbox ist leer — tippe + Capture.</p>
            )}
            <p>
              <Link href="/capture">
                {data.lifeAdmin.inboxCaptureCount > 0
                  ? `${data.lifeAdmin.inboxCaptureCount} triagieren →`
                  : "Zur Capture Inbox →"}
              </Link>
            </p>
          </section>
        );
      case "projects":
        return (
          <section className="uwe-v2-card uwe-dashboard-card">
            <h2 className="uwe-v2-section-title">Projekte</h2>
            <p>{data.lifeAdmin.activeProjectCount} aktiv</p>
            <div className="uwe-today-card-list">
              {data.lifeAdmin.activeProjects.map((project) => (
                <article key={project.id} className="uwe-today-card">
                  <h3>
                    <Link href={`/projects/${project.id}`}>{project.name}</Link>
                  </h3>
                  <p>{project.nextAction || project.status}</p>
                </article>
              ))}
            </div>
            <p>
              <Link href="/projects">Alle Projekte →</Link>
            </p>
          </section>
        );
      case "contracts":
        return (
          <section className="uwe-v2-card uwe-dashboard-card">
            <h2 className="uwe-v2-section-title">Verträge & Ausgaben</h2>
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
            {data.lifeAdmin.contractAlerts.length > 0 ? (
              <ul className="uwe-today-card-list">
                {data.lifeAdmin.contractAlerts.slice(0, 3).map((alert) => (
                  <li key={`${alert.contractId}-${alert.kind}`} className="uwe-today-card">
                    <p>{alert.message}</p>
                    {alert.dueDate && (
                      <p>
                        <Link
                          href={`/mail/compose?kind=contract_reminder&sourceId=${alert.contractId}`}
                        >
                          Mail vorbereiten
                        </Link>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="uwe-dashboard-muted">Keine Fristen in den nächsten Wochen.</p>
            )}
            <p>
              <Link href="/contracts">Verträge verwalten →</Link>
            </p>
          </section>
        );
      case "homelab":
        return (
          <section className="uwe-v2-card uwe-dashboard-card">
            <h2 className="uwe-v2-section-title">Hardware / Homelab</h2>
            <p>
              {data.lifeAdmin.hardwareIssues > 0
                ? `${data.lifeAdmin.hardwareIssues} Gerät(e) offline/defekt`
                : "Keine akuten Hardware-Probleme"}
            </p>
            {data.homelab.alerts.criticalCount > 0 && (
              <p className="uwe-form-error">
                {data.homelab.alerts.criticalCount} kritische Warnung(en)
              </p>
            )}
            {data.lifeAdmin.hardwareUrlWarnings.length > 0 && (
              <p className="uwe-form-error">
                {data.lifeAdmin.hardwareUrlWarnings.length} URL-Warnung(en) —{" "}
                <Link href="/hardware">Hardware prüfen</Link>
              </p>
            )}
            {data.homelab.alerts.serviceIssueCount > 0 && (
              <p className="uwe-dashboard-muted">
                {data.homelab.alerts.serviceIssueCount} Dienst(e) mit Problemen
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
        );
      case "agenda":
        return (
          <section className="uwe-v2-card uwe-dashboard-card">
            <h2 className="uwe-v2-section-title">Was steht heute an</h2>
            {data.calendarToday.length > 0 ? (
              <div className="uwe-today-card-list">
                {data.calendarToday.map((item) => (
                  <article key={item.id} className="uwe-today-card">
                    <h3>{item.href ? <Link href={item.href}>{item.title}</Link> : item.title}</h3>
                    <p>
                      {item.moduleLabel}
                      {item.allDay ? "" : ` · ${DATE_FORMAT.format(item.startAt)}`}
                      {item.urgency === "overdue" ? " · überfällig" : ""}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="uwe-dashboard-muted">Nichts Dringendes für heute. 🎉</p>
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
        );
      case "prioritized-mail": {
        const mail = data.prioritizedMail;
        return (
          <section className="uwe-v2-card uwe-dashboard-card">
            <h2 className="uwe-v2-section-title">Wichtige Mails</h2>
            {mail.actionableCount > 0 ? (
              <p>
                {mail.urgentCount > 0 ? (
                  <strong className="uwe-form-error">{mail.urgentCount} dringend</strong>
                ) : null}
                {mail.urgentCount > 0 && (mail.replyNeededCount > 0 || mail.todayCount > 0)
                  ? " · "
                  : ""}
                {mail.replyNeededCount > 0 ? `${mail.replyNeededCount} Antwort nötig` : ""}
                {mail.replyNeededCount > 0 && mail.todayCount > 0 ? " · " : ""}
                {mail.todayCount > 0 ? `${mail.todayCount} heute` : ""}
              </p>
            ) : (
              <p className="uwe-dashboard-muted">
                {mail.unreadTotal > 0
                  ? `${mail.unreadTotal} ungelesen, nichts Dringendes.`
                  : "Keine wichtigen Mails."}
              </p>
            )}
            {mail.topMessages.length > 0 && (
              <div className="uwe-today-card-list">
                {mail.topMessages.map((message) => (
                  <article key={message.id} className="uwe-today-card">
                    <h3>{message.subject || "(ohne Betreff)"}</h3>
                    <p>
                      {message.category
                        ? `${MAIL_CATEGORY_LABELS[message.category] ?? message.category} · `
                        : ""}
                      {message.fromAddress}
                    </p>
                    {message.extractedActions.length > 0 && (
                      <p className="uwe-dashboard-muted">
                        {message.extractedActions.map((action) => action.label).join(" · ")}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
            <p>
              <Link href="/mail">Mail Center →</Link>
            </p>
          </section>
        );
      }
      case "household": {
        const household = data.household;
        return (
          <section className="uwe-v2-card uwe-dashboard-card">
            <h2 className="uwe-v2-section-title">Haushalt & Vorräte</h2>
            <p>
              {household.overdueCount > 0 ? (
                <strong className="uwe-form-error">{household.overdueCount} überfällig</strong>
              ) : null}
              {household.overdueCount > 0 && household.soonCount > 0 ? " · " : ""}
              {household.soonCount > 0 ? `${household.soonCount} bald fällig` : ""}
              {household.overdueCount === 0 && household.soonCount === 0
                ? "Keine fälligen Aufgaben"
                : ""}
            </p>
            {household.upcoming.length > 0 && (
              <div className="uwe-today-card-list">
                {household.upcoming.slice(0, 4).map((task) => (
                  <article key={task.id} className="uwe-today-card">
                    <h3>
                      <Link href="/household">{task.title}</Link>
                    </h3>
                    <p>
                      {task.category || "Haushalt"}
                      {task.nextDueAt ? ` · ${DATE_ONLY_FORMAT.format(task.nextDueAt)}` : ""}
                      {task.overdue ? " · überfällig" : ""}
                    </p>
                    <form action={markMaintenanceDoneAction}>
                      <input type="hidden" name="id" value={task.id} />
                      <button
                        type="submit"
                        className="uwe-v2-btn uwe-v2-btn-secondary"
                        aria-label={`${task.title} als erledigt markieren`}
                      >
                        ✓ Erledigt
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            )}
            {household.expiringPantry.length > 0 && (
              <p
                className={
                  household.expiredPantryCount > 0 ? "uwe-form-error" : "uwe-dashboard-muted"
                }
              >
                {household.expiredPantryCount > 0
                  ? `${household.expiredPantryCount} Vorrat abgelaufen · `
                  : ""}
                {household.expiringPantry.length} Vorräte laufen bald ab
              </p>
            )}
            <p>
              <Link href="/household">Haushalt öffnen →</Link>
            </p>
          </section>
        );
      }
      case "jobs-queue": {
        const jobs = data.jobs;
        const activeCount = jobs.pendingCount + jobs.runningCount;
        return (
          <section className="uwe-v2-card uwe-dashboard-card">
            <h2 className="uwe-v2-section-title">Automatisierung</h2>
            {jobs.queueImplemented ? (
              <>
                <p>
                  {jobs.runningCount > 0 ? `${jobs.runningCount} laufen` : ""}
                  {jobs.runningCount > 0 && jobs.pendingCount > 0 ? " · " : ""}
                  {jobs.pendingCount > 0 ? `${jobs.pendingCount} in Warteschlange` : ""}
                  {activeCount === 0 ? "Keine aktiven Jobs" : ""}
                </p>
                {jobs.failedCount > 0 && (
                  <p className="uwe-form-error">{jobs.failedCount} fehlgeschlagen</p>
                )}
                {jobs.recentFailures.length > 0 && (
                  <div className="uwe-today-card-list">
                    {jobs.recentFailures.slice(0, 3).map((failure) => (
                      <article key={failure.id} className="uwe-today-card">
                        <h3>{failure.title || failure.type}</h3>
                        {failure.errorMessage && (
                          <p className="uwe-dashboard-muted">{failure.errorMessage}</p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="uwe-dashboard-muted">{jobs.message}</p>
            )}
            <p>
              <Link href="/jobs">Jobs öffnen →</Link>
            </p>
          </section>
        );
      }
      default:
        return null;
    }
  };

  if (layout.loading && layout.widgets.length === 0) {
    return <p className="uwe-dashboard-muted">Dashboard-Layout wird geladen…</p>;
  }

  return (
    <LayoutEditorProvider initialWidgets={widgets}>
      <LayoutEditToolbar
        onApply={async (nextWidgets) => {
          await layout.save(nextWidgets);
        }}
        saving={layout.saving}
        error={layout.error}
      />
      <SortableWidgetGrid renderWidget={renderWidget} />
    </LayoutEditorProvider>
  );
}
