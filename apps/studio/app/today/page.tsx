import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import {
  createDashboardLayoutService,
  createLifeAdminService,
  prisma,
  STUDIO_TODAY_PAGE_KEY,
} from "@uwe/database/server";
import { getUweRuntimeConfig } from "@uwe/auth";
import { StudioShell, PageHeader } from "@/src/components/shell";
import { getTodayDashboardData } from "@/src/lib/today-dashboard";
import { generateMorningBriefingAction } from "../briefing-actions";
import { TodayDashboardClient } from "./TodayDashboardClient";
import { TodayQuickCapture } from "./TodayQuickCapture";
import { LifeBrainChatPanel } from "@/components/life-brain/LifeBrainChatPanel";
import { resolveAiKnowledgeAccess } from "@/src/lib/ai-gateway-access";
import { getCurrentAuthUser } from "@/src/lib/auth";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

async function getLatestBriefing() {
  const docs = await createLifeAdminService(prisma).listPersonalBrainDocuments({ limit: 50 });
  return docs.find((doc) => doc.title.startsWith("Morning Briefing")) ?? null;
}

export default async function TodayPage() {
  const useMockInference = process.env.AI_USE_MOCK === "true";
  const currentUser = await getCurrentAuthUser();
  const layoutUserId =
    currentUser?.id ?? (!getUweRuntimeConfig().authRequired ? "dev-bypass" : null);

  const [data, briefing, chatAccess, todayLayout] = await Promise.all([
    getTodayDashboardData(prisma, { useMockInference }),
    getLatestBriefing(),
    resolveAiKnowledgeAccess(currentUser),
    layoutUserId
      ? createDashboardLayoutService(prisma).getDashboardLayout(layoutUserId, STUDIO_TODAY_PAGE_KEY)
      : Promise.resolve(null),
  ]);

  return (
    <StudioShell breadcrumb={<span>Heute</span>}>
      <PageHeader title="Heute" summary="Dein Daily Cockpit — DnD, Projekte, Capture, Technik und System auf einen Blick." actions={<><Link href="/settings?tab=general" className="uwe-v2-btn uwe-v2-btn-secondary">Widgets</Link><Link href="/capture?quick=1" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">+ Capture</Link></>} />
      <TodayQuickCapture />
      <TodayDashboardClient
        data={data}
        initialWidgets={todayLayout?.widgets}
        initialIsDefault={todayLayout?.isDefault}
      />

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Morning Briefing</h2>
        {briefing ? (
          <>
            <p className="uwe-dashboard-muted">
              {briefing.title} · aktualisiert {DATE_FORMAT.format(briefing.updatedAt)}
            </p>
            <p style={{ whiteSpace: "pre-wrap" }}>{briefing.content}</p>
          </>
        ) : (
          <p className="uwe-dashboard-muted">
            Noch kein Briefing erstellt. Fasst Termine, Fristen, Aufgaben und die Nachrichtenlage
            lokal per KI zusammen.
          </p>
        )}
        <form action={generateMorningBriefingAction}>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
            {briefing ? "Briefing neu erstellen" : "Briefing jetzt erstellen"}
          </button>
        </form>
        <p className="uwe-dashboard-muted">
          Läuft als Job auf der lokalen RTX — Fortschritt unter{" "}
          <Link href="/jobs">Jobs</Link>.
        </p>
      </section>

      {chatAccess.allowed && (
        <details className="uwe-v2-section">
          <summary className="uwe-v2-section-title">
            💬 Nachfragen zum Briefing (Life-Brain)
          </summary>
          <LifeBrainChatPanel useMock={useMockInference} pollIntervalMs={30_000} />
        </details>
      )}

      <div className="uwe-v2-stat-grid">
        <section className="uwe-v2-card uwe-v2-card-padded">
          <h2 className="uwe-v2-section-title">Mail Center</h2>
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

        <section className="uwe-v2-card uwe-v2-card-padded">
          <h2 className="uwe-v2-section-title">Werkstatt</h2>
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
      </div>

      <p className="uwe-dashboard-muted">
        <HealthBadge status={data.systemOk ? "ok" : "degraded"} label={data.systemLabel} />
      </p>
    </StudioShell>
  );
}
