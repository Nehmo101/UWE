"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DashboardWidgetGrid } from "@uwe/shared-ui";
import {
  Alert,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
} from "@/src/components/ui";
import { CAPTURE_TYPE_LABELS } from "@uwe/database/capture-constants";
import { markMaintenanceDoneAction } from "@/app/household-actions";
import { updateCaptureStatusAction } from "@/app/capture-actions";
import { formatEuroFromCents } from "@uwe/database/contract-expense-utils";
import { mergeMissingDefaultWidgets, STUDIO_TODAY_PAGE_KEY } from "@uwe/database/dashboard-layout";
import type { DashboardWidgetConfig } from "@uwe/database/dashboard-layout";
import type { TodayDashboardData } from "@/src/lib/today-dashboard";
import { isTodayDashboardAllClear } from "@/src/lib/today-empty-state";

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

/** Maps an Ampel status to the shared colored-dot background token (the Parchment "Pünktchen"). */
const AMPEL_DOT: Record<"ok" | "warn" | "error", string> = {
  ok: "bg-success",
  warn: "bg-warning",
  error: "bg-destructive",
};

interface TodayDashboardClientProps {
  data: TodayDashboardData;
  widgets: DashboardWidgetConfig[];
}

export function TodayDashboardClient({
  data,
  widgets: initialWidgets,
}: TodayDashboardClientProps) {
  const widgets = useMemo(
    () => mergeMissingDefaultWidgets(STUDIO_TODAY_PAGE_KEY, initialWidgets),
    [initialWidgets],
  );

  const renderWidget = (widget: DashboardWidgetConfig) => {
    switch (widget.widgetType) {
      case "system-ampel":
        return (
          <Card>
            <CardHeader>
              <CardTitle>System-Ampel</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { href: "/system?tab=diagnose", status: statusDot(data.systemOk), label: `UWE ${data.systemLabel}` },
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
                    data-status={item.status}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border bg-card/80 px-2.5 py-1.5 text-xs",
                      item.status === "ok" && "border-success/35",
                      item.status === "warn" && "border-warning/35",
                      item.status === "error" && "border-destructive/35",
                    )}
                  >
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", AMPEL_DOT[item.status])} aria-hidden />
                    {item.label}
                  </Link>
                ))}
              </div>
              {data.homelab.alerts.criticalCount > 0 && (
                <Alert
                  tone="danger"
                  role="alert"
                  title={`${data.homelab.alerts.criticalCount} kritische Homelab-/Security-Probleme`}
                >
                  <ul className="list-disc pl-4">
                    {data.homelab.alerts.messages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                  <p className="mt-2">
                    <Link href="/hardware">Hardware-Cockpit öffnen →</Link>
                  </p>
                </Alert>
              )}
              <p className="text-sm text-muted-foreground">
                <Link href="/system?tab=diagnose">Details in der System-Diagnose →</Link>
              </p>
            </CardContent>
          </Card>
        );
      case "dnd-favorite":
        return (
          <Card>
            <CardHeader>
              <CardTitle>DnD / Welten</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.preferredWorld ? (
                <>
                  <p>
                    Bevorzugte Welt:{" "}
                    <Link href={`/worlds/${data.preferredWorld.slug}/dashboard`}>
                      {data.preferredWorld.name}
                    </Link>
                  </p>
                  {data.nextSession ? (
                    <p className="text-sm text-muted-foreground">
                      Nächste Session #{data.nextSession.sessionNumber}: {data.nextSession.title}
                      {data.nextSession.date ? ` · ${DATE_FORMAT.format(data.nextSession.date)}` : ""}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Keine geplante Session.</p>
                  )}
                </>
              ) : (
                <EmptyState
                  title="Noch keine Welt"
                  description="Lege eine DnD-Welt an, um Sessions und Welten hier zu sehen."
                  action={
                    <Link href="/worlds" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                      Welten anlegen
                    </Link>
                  }
                />
              )}
            </CardContent>
          </Card>
        );
      case "capture-inbox":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Capture Inbox</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p>{data.lifeAdmin.inboxCaptureCount} offene Einträge</p>
              {data.lifeAdmin.recentCaptures.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {data.lifeAdmin.recentCaptures.map((capture) => (
                    <Card key={capture.id} className="p-3.5">
                      <h3 className="text-sm font-medium">
                        <Link href={`/capture/${capture.id}`}>{capture.title || "Ohne Titel"}</Link>
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {CAPTURE_TYPE_LABELS[capture.captureType]} ·{" "}
                        {DATE_FORMAT.format(capture.capturedAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <Link href={`/capture/${capture.id}`}>Triage →</Link>
                        <form action={updateCaptureStatusAction}>
                          <input type="hidden" name="id" value={capture.id} />
                          <input type="hidden" name="status" value="archived" />
                          <Button
                            type="submit"
                            variant="secondary"
                            aria-label={`${capture.title || "Eintrag"} archivieren`}
                          >
                            Archivieren
                          </Button>
                        </form>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Inbox ist leer — tippe + Capture.</p>
              )}
              <p>
                <Link href="/capture">
                  {data.lifeAdmin.inboxCaptureCount > 0
                    ? `${data.lifeAdmin.inboxCaptureCount} triagieren →`
                    : "Zur Capture Inbox →"}
                </Link>
              </p>
            </CardContent>
          </Card>
        );
      case "projects":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Projekte</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p>{data.lifeAdmin.activeProjectCount} aktiv</p>
              <div className="flex flex-col gap-3">
                {data.lifeAdmin.activeProjects.map((project) => (
                  <Card key={project.id} className="p-3.5">
                    <h3 className="text-sm font-medium">
                      <Link href={`/projects/${project.id}`}>{project.name}</Link>
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {project.nextAction || project.status}
                    </p>
                  </Card>
                ))}
              </div>
              <p>
                <Link href="/projects">Alle Projekte →</Link>
              </p>
            </CardContent>
          </Card>
        );
      case "projects-by-domain":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Projekte nach Domäne</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {data.projectDomains.activeTotal} aktiv / {data.projectDomains.total} gesamt
              </p>
              <div className="flex flex-col gap-3">
                {data.projectDomains.categories.map((summary) => (
                  <Card key={summary.category} className="p-3.5">
                    <h3 className="text-sm font-medium">
                      <Link href={`/projects?category=${summary.category}`}>{summary.label}</Link>
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {summary.active} aktiv · {summary.total} gesamt
                      {summary.progressPercent > 0 ? ` · ${summary.progressPercent}% erledigt` : ""}
                    </p>
                    {summary.recentProjects.length > 0 ? (
                      <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                        {summary.recentProjects.slice(0, 2).map((project) => (
                          <li key={project.id}>
                            <Link href={`/projects/${project.id}`}>{project.name}</Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </Card>
                ))}
              </div>
              <p>
                <Link href="/projects">Projekt-Dashboards →</Link>
              </p>
            </CardContent>
          </Card>
        );
      case "contracts":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Verträge & Ausgaben</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p>
                {data.lifeAdmin.contractsNeedingReview > 0
                  ? `${data.lifeAdmin.contractsNeedingReview} zur Prüfung`
                  : "Keine offenen Prüfungen"}
              </p>
              {data.lifeAdmin.contractCosts.activeCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  ~{formatEuroFromCents(data.lifeAdmin.contractCosts.monthlyTotalCents)}/Monat ·{" "}
                  {formatEuroFromCents(data.lifeAdmin.contractCosts.yearlyTotalCents)}/Jahr (
                  {data.lifeAdmin.contractCosts.activeCount} aktiv)
                </p>
              )}
              {data.lifeAdmin.contractAlerts.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {data.lifeAdmin.contractAlerts.slice(0, 3).map((alert) => (
                    <li
                      key={`${alert.contractId}-${alert.kind}`}
                      className="rounded-[var(--radius)] border border-border bg-card p-3.5 shadow-sm"
                    >
                      <p className="text-sm">{alert.message}</p>
                      {alert.dueDate && (
                        <p className="mt-1 text-sm">
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
                <p className="text-sm text-muted-foreground">Keine Fristen in den nächsten Wochen.</p>
              )}
              <p>
                <Link href="/contracts">Verträge verwalten →</Link>
              </p>
            </CardContent>
          </Card>
        );
      case "homelab":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Hardware / Homelab</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p>
                {data.lifeAdmin.hardwareIssues > 0
                  ? `${data.lifeAdmin.hardwareIssues} Gerät(e) offline/defekt`
                  : "Keine akuten Hardware-Probleme"}
              </p>
              {data.homelab.alerts.criticalCount > 0 && (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {data.homelab.alerts.criticalCount} kritische Warnung(en)
                </p>
              )}
              {data.lifeAdmin.hardwareUrlWarnings.length > 0 && (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {data.lifeAdmin.hardwareUrlWarnings.length} URL-Warnung(en) —{" "}
                  <Link href="/hardware">Hardware prüfen</Link>
                </p>
              )}
              {data.homelab.alerts.serviceIssueCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {data.homelab.alerts.serviceIssueCount} Dienst(e) mit Problemen
                </p>
              )}
              {data.lifeAdmin.openSetupSteps > 0 && (
                <p className="text-sm text-muted-foreground">
                  {data.lifeAdmin.openSetupSteps} offene Setup-Schritte
                </p>
              )}
              <p>
                <Link href="/hardware">Hardware-Cockpit →</Link>
              </p>
            </CardContent>
          </Card>
        );
      case "agenda":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Was steht heute an</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.calendarToday.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {data.calendarToday.map((item) => (
                    <Card key={item.id} className="p-3.5">
                      <h3 className="text-sm font-medium">
                        {item.href ? <Link href={item.href}>{item.title}</Link> : item.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.moduleLabel}
                        {item.allDay ? "" : ` · ${DATE_FORMAT.format(item.startAt)}`}
                        {item.urgency === "overdue" ? " · überfällig" : ""}
                      </p>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nichts Dringendes für heute. 🎉</p>
              )}
              {data.calendarThisWeek.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold">Diese Woche</h3>
                  <div className="flex flex-col gap-3">
                    {data.calendarThisWeek.slice(0, 5).map((item) => (
                      <Card key={item.id} className="p-3.5">
                        <h3 className="text-sm font-medium">{item.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.moduleLabel} · {DATE_FORMAT.format(item.startAt)}
                        </p>
                      </Card>
                    ))}
                  </div>
                </>
              )}
              <p>
                <Link href="/calendar">Kalender öffnen →</Link>
              </p>
            </CardContent>
          </Card>
        );
      case "prioritized-mail": {
        const mail = data.prioritizedMail;
        return (
          <Card>
            <CardHeader>
              <CardTitle>Wichtige Mails</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {mail.actionableCount > 0 ? (
                <p>
                  {mail.urgentCount > 0 ? (
                    <strong className="text-destructive">{mail.urgentCount} dringend</strong>
                  ) : null}
                  {mail.urgentCount > 0 && (mail.replyNeededCount > 0 || mail.todayCount > 0)
                    ? " · "
                    : ""}
                  {mail.replyNeededCount > 0 ? `${mail.replyNeededCount} Antwort nötig` : ""}
                  {mail.replyNeededCount > 0 && mail.todayCount > 0 ? " · " : ""}
                  {mail.todayCount > 0 ? `${mail.todayCount} heute` : ""}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {mail.unreadTotal > 0
                    ? `${mail.unreadTotal} ungelesen, nichts Dringendes.`
                    : "Keine wichtigen Mails."}
                </p>
              )}
              {mail.topMessages.length > 0 && (
                <div className="flex flex-col gap-3">
                  {mail.topMessages.map((message) => (
                    <Card key={message.id} className="p-3.5">
                      <h3 className="text-sm font-medium">{message.subject || "(ohne Betreff)"}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {message.category
                          ? `${MAIL_CATEGORY_LABELS[message.category] ?? message.category} · `
                          : ""}
                        {message.fromAddress}
                      </p>
                      {message.extractedActions.length > 0 && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {message.extractedActions.map((action) => action.label).join(" · ")}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              )}
              <p>
                <Link href="/mail">Mail Center →</Link>
              </p>
            </CardContent>
          </Card>
        );
      }
      case "household": {
        const household = data.household;
        return (
          <Card>
            <CardHeader>
              <CardTitle>Haushalt & Vorräte</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p>
                {household.overdueCount > 0 ? (
                  <strong className="text-destructive">{household.overdueCount} überfällig</strong>
                ) : null}
                {household.overdueCount > 0 && household.soonCount > 0 ? " · " : ""}
                {household.soonCount > 0 ? `${household.soonCount} bald fällig` : ""}
                {household.overdueCount === 0 && household.soonCount === 0
                  ? "Keine fälligen Aufgaben"
                  : ""}
              </p>
              {household.upcoming.length > 0 && (
                <div className="flex flex-col gap-3">
                  {household.upcoming.slice(0, 4).map((task) => (
                    <Card key={task.id} className="p-3.5">
                      <h3 className="text-sm font-medium">
                        <Link href="/household">{task.title}</Link>
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {task.category || "Haushalt"}
                        {task.nextDueAt ? ` · ${DATE_ONLY_FORMAT.format(task.nextDueAt)}` : ""}
                        {task.overdue ? " · überfällig" : ""}
                      </p>
                      <form action={markMaintenanceDoneAction} className="mt-2">
                        <input type="hidden" name="id" value={task.id} />
                        <Button
                          type="submit"
                          variant="secondary"
                          aria-label={`${task.title} als erledigt markieren`}
                        >
                          ✓ Erledigt
                        </Button>
                      </form>
                    </Card>
                  ))}
                </div>
              )}
              {household.expiringPantry.length > 0 && (
                <p
                  className={cn(
                    "text-sm",
                    household.expiredPantryCount > 0
                      ? "font-medium text-destructive"
                      : "text-muted-foreground",
                  )}
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
            </CardContent>
          </Card>
        );
      }
      case "jobs-queue": {
        const jobs = data.jobs;
        const activeCount = jobs.pendingCount + jobs.runningCount;
        return (
          <Card>
            <CardHeader>
              <CardTitle>Automatisierung</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {jobs.queueImplemented ? (
                <>
                  <p>
                    {jobs.runningCount > 0 ? `${jobs.runningCount} laufen` : ""}
                    {jobs.runningCount > 0 && jobs.pendingCount > 0 ? " · " : ""}
                    {jobs.pendingCount > 0 ? `${jobs.pendingCount} in Warteschlange` : ""}
                    {activeCount === 0 ? "Keine aktiven Jobs" : ""}
                  </p>
                  {jobs.failedCount > 0 && (
                    <p className="text-sm font-medium text-destructive" role="alert">
                      {jobs.failedCount} fehlgeschlagen
                    </p>
                  )}
                  {jobs.recentFailures.length > 0 && (
                    <div className="flex flex-col gap-3">
                      {jobs.recentFailures.slice(0, 3).map((failure) => (
                        <Card key={failure.id} className="p-3.5">
                          <h3 className="text-sm font-medium">{failure.title || failure.type}</h3>
                          {failure.errorMessage && (
                            <p className="mt-1 text-sm text-muted-foreground">{failure.errorMessage}</p>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{jobs.message}</p>
              )}
              <p>
                <Link href="/jobs">Jobs öffnen →</Link>
              </p>
            </CardContent>
          </Card>
        );
      }
      default:
        return null;
    }
  };

  const allClear = isTodayDashboardAllClear(data, widgets);

  return (
    <>
      {allClear ? (
        <EmptyState
          title="Alles erledigt — guter Start!"
          description="Keine dringenden Aufgaben in deinen sichtbaren Widgets. Zeit für kreatives DnD oder einfach durchatmen."
          action={
            <Link href="/capture?quick=1" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Neue Idee erfassen
            </Link>
          }
        />
      ) : null}
      <DashboardWidgetGrid widgets={widgets} renderWidget={renderWidget} />
    </>
  );
}
