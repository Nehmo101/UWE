import Link from "next/link";
import { createLifeAdminService, prisma } from "@uwe/database/server";
import { brainPrisma } from "@uwe/database/brain-client";
import { getTodayDashboardData } from "@uwe/daily-cockpit";
import { getBrainOwner } from "@/src/lib/page-owner";
import { dayIndex } from "@uwe/shared-ui";
import { BrainShell, BrainDenied } from "@/src/components/BrainShell";
import { generateMorningBriefingAction } from "../briefing-actions";

/**
 * Heute — das Daily Admin OS.
 *
 * Die Seite gab es doppelt, in Studio und in Brain (Abschnitt H1). Brain
 * gewinnt: Alltag ist Owner-Sache, Studio ist DM-Werkzeug. Die Aggregation
 * liegt jetzt in `@uwe/daily-cockpit`, damit die Seite nicht wieder Logik in
 * einer App ansammelt.
 */

export const dynamic = "force-dynamic";

const DATE_TIME = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("de-DE", { month: "short", day: "numeric" });
}

async function getLatestBriefing() {
  const docs = await createLifeAdminService(brainPrisma, prisma).listPersonalBrainDocuments({
    limit: 50,
  });
  return docs.find((doc) => doc.title.startsWith("Morning Briefing")) ?? null;
}

export default async function BrainTodayPage() {
  const owner = await getBrainOwner();
  if (!owner) {
    return (
      <BrainShell active="/today" title="Heute">
        <BrainDenied />
      </BrainShell>
    );
  }

  const [data, briefing] = await Promise.all([
    getTodayDashboardData(prisma, { useMockInference: process.env.AI_USE_MOCK === "true" }),
    getLatestBriefing(),
  ]);
  const summary = data.lifeAdmin;
  const canTriggerBriefing = Boolean(process.env.STUDIO_API_TOKEN?.trim());

  const kpis = [
    { n: summary.inboxCaptureCount, label: "Capture-Inbox", href: "/capture" },
    { n: summary.activeProjectCount, label: "Aktive Projekte", href: "/projects" },
    { n: summary.activeWorkshopCount, label: "Werkstatt aktiv", href: "/workshop" },
    { n: summary.contractsNeedingReview, label: "Verträge prüfen", href: "/contracts" },
    { n: summary.hardwareIssues, label: "Hardware-Warnungen", href: "/hardware" },
    { n: summary.openSetupSteps, label: "Setup offen", href: "/hardware" },
    { n: data.household.overdueCount, label: "Wartung überfällig", href: "/projects" },
    { n: data.prioritizedMail.actionableCount, label: "Mails mit Handlungsbedarf", href: "/mail" },
  ];

  const dateLine = new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <BrainShell
      active="/today"
      title="Heute"
      eyebrow="Owner-Bereich · privat"
      lede={`${dateLine} — dein Daily Admin OS. Lokal, auch um Mitternacht; keine Cloud-KI.`}
      sceneIndex={dayIndex()}
      actions={
        <span className={data.systemOk ? "brain-tag" : "brain-tag brain-tag-warn"}>
          {data.systemLabel}
        </span>
      }
    >
      <div className="brain-kpis">
        {kpis.map((kpi) => (
          <Link className="brain-kpi" key={kpi.label} href={kpi.href}>
            <strong>{kpi.n}</strong>
            <span>{kpi.label}</span>
          </Link>
        ))}
      </div>

      {data.homelab.alerts.criticalCount > 0 ? (
        <div className="brain-callout brain-callout-warn" role="alert">
          <strong>
            {data.homelab.alerts.criticalCount} kritische Homelab-/Security-Probleme
          </strong>
          <ul>
            {data.homelab.alerts.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          <p>
            <Link href="/system">System öffnen →</Link>
          </p>
        </div>
      ) : null}

      <section className="brain-section">
        <h2>Morning Briefing</h2>
        <div className="brain-card">
          {briefing ? (
            <>
              <p className="brain-muted">
                {briefing.title} · aktualisiert {DATE_TIME.format(briefing.updatedAt)}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{briefing.content}</p>
            </>
          ) : (
            <p className="brain-muted">
              Noch kein Briefing. Es fasst Termine, Fristen, Aufgaben und die Nachrichtenlage
              lokal auf dem RTX-Host zusammen.
            </p>
          )}
          {canTriggerBriefing ? (
            <form action={generateMorningBriefingAction}>
              <button type="submit" className="brain-btn brain-btn-sm">
                {briefing ? "Briefing neu erstellen" : "Briefing jetzt erstellen"}
              </button>
            </form>
          ) : (
            <p className="brain-muted">
              Ohne <code>STUDIO_API_TOKEN</code> läuft das Briefing nur nach Zeitplan. Uhrzeit und
              An/Aus stehen in der Kommandozentrale unter Betrieb &rarr; Einstellungen.
            </p>
          )}
        </div>
      </section>

      <section className="brain-section">
        <h2>Heute &amp; diese Woche</h2>
        {data.calendarToday.length === 0 && data.calendarThisWeek.length === 0 ? (
          <p className="brain-muted">Keine Termine erfasst.</p>
        ) : (
          <ul className="brain-list">
            {[...data.calendarToday, ...data.calendarThisWeek].slice(0, 10).map((item) => (
              <li key={`${item.source}-${item.id}`} className="brain-row">
                <div className="brain-row-head">
                  <strong>{item.title}</strong>
                  <span className="brain-tag">{item.source}</span>
                  <span className="brain-muted">{formatDate(item.startAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="brain-muted">
          <Link href="/calendar">Kalender öffnen →</Link>
        </p>
      </section>

      <section className="brain-section">
        <h2>Werkstatt</h2>
        <p className="brain-muted">{summary.activeWorkshopCount} in Arbeit oder geplant.</p>
        {summary.workshopOpenTasks.length > 0 ? (
          <ul className="brain-list">
            {summary.workshopOpenTasks.map((task) => (
              <li key={task.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{task.title}</strong>
                  <span className="brain-muted">{task.nextAction}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : summary.activeWorkshops.length > 0 ? (
          <ul className="brain-list">
            {summary.activeWorkshops.map((workshop) => (
              <li key={workshop.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{workshop.title}</strong>
                  <span className="brain-muted">{workshop.nextAction || workshop.status}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="brain-muted">Nichts offen.</p>
        )}
        <p className="brain-muted">
          <Link href="/workshop">Werkstatt öffnen →</Link>
        </p>
      </section>

      <section className="brain-section">
        <h2>Mail</h2>
        {data.mailSummary.recentFailed > 0 ? (
          <p className="brain-callout brain-callout-warn" role="alert">
            {data.mailSummary.recentFailed} fehlgeschlagene Sendung(en)
            {data.mailSummary.latestFailedSubject
              ? `: ${data.mailSummary.latestFailedSubject}`
              : ""}
          </p>
        ) : (
          <p className="brain-muted">Keine fehlgeschlagenen Mails.</p>
        )}
        {data.mailSummary.pendingCount > 0 ? (
          <p className="brain-muted">{data.mailSummary.pendingCount} ausstehende Log-Einträge.</p>
        ) : null}
        <p className="brain-muted">
          <Link href="/mail">Mail Center öffnen →</Link>
        </p>
      </section>

      <section className="brain-section">
        <h2>Zuletzt erfasst</h2>
        {summary.recentCaptures.length === 0 ? (
          <p className="brain-muted">Nichts in der Capture-Inbox.</p>
        ) : (
          <ul className="brain-list">
            {summary.recentCaptures.map((capture) => (
              <li key={capture.id} className="brain-row">
                <div className="brain-row-head">
                  <strong>{capture.title}</strong>
                  <span className="brain-tag">{capture.captureType}</span>
                  <span className="brain-muted">
                    {capture.status} · {formatDate(capture.capturedAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="brain-muted">
          <Link href="/capture">Capture öffnen →</Link>
        </p>
      </section>
    </BrainShell>
  );
}
