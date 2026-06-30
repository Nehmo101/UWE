"use client";

import Link from "next/link";
import {
  EmptyState,
  LayoutEditToolbar,
  LayoutEditorProvider,
  SortableWidgetGrid,
  useDashboardLayout,
} from "@uwe/shared-ui";
import { CAPTURE_TYPE_LABELS } from "@uwe/database/capture-constants";
import { formatEuroFromCents } from "@uwe/database/server";
import { STUDIO_TODAY_PAGE_KEY } from "@uwe/database/dashboard-layout";
import type { DashboardWidgetConfig } from "@uwe/database/dashboard-layout";
import type { TodayDashboardData } from "@/src/lib/today-dashboard";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function statusDot(ok: boolean, warn = false): "ok" | "warn" | "error" {
  if (ok) return "ok";
  return warn ? "warn" : "error";
}

interface TodayDashboardClientProps {
  data: TodayDashboardData;
}

export function TodayDashboardClient({ data }: TodayDashboardClientProps) {
  const layout = useDashboardLayout({ pageKey: STUDIO_TODAY_PAGE_KEY });

  const renderWidget = (widget: DashboardWidgetConfig) => {
    switch (widget.widgetType) {
      case "system-ampel":
        return (
          <section className="uwe-v2-section">
            <h2 className="uwe-v2-section-title">System-Ampel</h2>
            <div className="uwe-system-ampel">
              <Link
                href="/admin/status"
                className="uwe-system-ampel-item"
                data-status={statusDot(data.systemOk)}
              >
                UWE {data.systemLabel}
              </Link>
              <Link
                href="/hardware"
                className="uwe-system-ampel-item"
                data-status={statusDot(data.dbOk)}
              >
                DB {data.dbOk ? "OK" : "Fehler"}
              </Link>
              <Link
                href="/hardware"
                className="uwe-system-ampel-item"
                data-status={statusDot(data.backupOk, true)}
              >
                Backup {data.backupOk ? "OK" : "prüfen"}
              </Link>
              <Link
                href="/system/rtx-connector"
                className="uwe-system-ampel-item"
                data-status={statusDot(data.rtxReady, true)}
              >
                RTX {data.rtxReady ? "bereit" : "offline"}
              </Link>
              <Link
                href="/life-brain"
                className="uwe-system-ampel-item"
                data-status={statusDot(data.brainEnabled, !data.brainEnabled)}
              >
                Brain {data.brainEnabled ? "aktiv" : "aus"}
              </Link>
              <Link
                href="/mail"
                className="uwe-system-ampel-item"
                data-status={statusDot(data.mailOk, true)}
              >
                Mail {data.mailOk ? "OK" : "prüfen"}
              </Link>
              <Link
                href="/settings"
                className="uwe-system-ampel-item"
                data-status={statusDot(data.portalAuthRequired, !data.portalAuthRequired)}
              >
                Portal {data.portalAuthRequired ? "Auth" : "offen"}
              </Link>
              <Link
                href="/hardware"
                className="uwe-system-ampel-item"
                data-status={statusDot(data.cloudflareOk, !data.cloudflareOk)}
              >
                CF {data.cloudflareOk ? "OK" : "Tunnel"}
              </Link>
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
            <p>{data.lifeAdmin.activeProjectCount} aktiv / geplant</p>
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
      default:
        return null;
    }
  };

  if (layout.loading && layout.widgets.length === 0) {
    return <p className="uwe-dashboard-muted">Dashboard-Layout wird geladen…</p>;
  }

  return (
    <LayoutEditorProvider initialWidgets={layout.widgets}>
      <LayoutEditToolbar
        onApply={async (widgets) => {
          await layout.save(widgets);
        }}
        saving={layout.saving}
        error={layout.error}
      />
      <SortableWidgetGrid renderWidget={renderWidget} />
    </LayoutEditorProvider>
  );
}
