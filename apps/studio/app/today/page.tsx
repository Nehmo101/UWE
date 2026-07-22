import Link from "next/link";
import { HealthBadge } from "@uwe/shared-ui";
import {
import { brainPrisma } from "@uwe/database/brain-client";
  createLifeAdminService,
  getDefaultDashboardLayout,
  mergeMissingDefaultWidgets,
  prisma,
  STUDIO_TODAY_PAGE_KEY,
} from "@uwe/database/server";
import { StudioShell, PageHeader } from "@/src/components/shell";
import { Button, Card, CardContent, CardHeader, CardTitle, NavIcon } from "@/src/components/ui";
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
  const docs = await createLifeAdminService(brainPrisma, prisma).listPersonalBrainDocuments({ limit: 50 });
  return docs.find((doc) => doc.title.startsWith("Morning Briefing")) ?? null;
}

export default async function TodayPage() {
  const useMockInference = process.env.AI_USE_MOCK === "true";
  const currentUser = await getCurrentAuthUser();

  const [data, briefing, chatAccess] = await Promise.all([
    getTodayDashboardData(prisma, { useMockInference }),
    getLatestBriefing(),
    resolveAiKnowledgeAccess(currentUser),
  ]);

  const todayWidgets = mergeMissingDefaultWidgets(
    STUDIO_TODAY_PAGE_KEY,
    getDefaultDashboardLayout(STUDIO_TODAY_PAGE_KEY),
  );

  return (
    <StudioShell breadcrumb={<span>Heute</span>}>
      <PageHeader
        title="Heute"
        summary="Dein Daily Cockpit — DnD, Projekte, Capture, Technik und System auf einen Blick."
        actions={
          <Link
            href="/capture?quick=1"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Capture
          </Link>
        }
      />
      <div className="flex flex-col gap-6">
        <TodayQuickCapture />
        <TodayDashboardClient data={data} widgets={todayWidgets} />

        <Card>
          <CardHeader>
            <CardTitle>Morning Briefing</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {briefing ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {briefing.title} · aktualisiert {DATE_FORMAT.format(briefing.updatedAt)}
                </p>
                <p className="whitespace-pre-wrap">{briefing.content}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch kein Briefing erstellt. Fasst Termine, Fristen, Aufgaben und die Nachrichtenlage
                lokal per KI zusammen.
              </p>
            )}
            <form action={generateMorningBriefingAction}>
              <Button type="submit" variant="secondary">
                {briefing ? "Briefing neu erstellen" : "Briefing jetzt erstellen"}
              </Button>
            </form>
            <p className="text-sm text-muted-foreground">
              Läuft als Job auf der lokalen RTX — Fortschritt unter{" "}
              <Link href="/jobs">Jobs</Link>.
            </p>
          </CardContent>
        </Card>

        {chatAccess.allowed && (
          <details className="flex flex-col gap-3">
            <summary className="flex cursor-pointer items-center gap-2 text-lg font-semibold tracking-tight">
              <NavIcon name="message-circle" width={18} height={18} />
              Nachfragen zum Briefing (Life-Brain)
            </summary>
            <LifeBrainChatPanel useMock={useMockInference} pollIntervalMs={30_000} />
          </details>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Mail Center</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {data.mailSummary.recentFailed > 0 ? (
                <p className="text-sm text-destructive" role="alert">
                  {data.mailSummary.recentFailed} fehlgeschlagenen Sendung(en)
                  {data.mailSummary.latestFailedSubject
                    ? `: ${data.mailSummary.latestFailedSubject}`
                    : ""}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Keine fehlgeschlagenen Mails.</p>
              )}
              {data.mailSummary.pendingCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {data.mailSummary.pendingCount} ausstehende Log-Einträge
                </p>
              )}
              <div className="flex flex-col gap-3">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Werkstatt</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm">{data.lifeAdmin.activeWorkshopCount} in Arbeit / geplant</p>
              {data.lifeAdmin.workshopOpenTasks.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {data.lifeAdmin.workshopOpenTasks.map((task) => (
                    <Card key={task.id} className="p-3.5">
                      <h3 className="text-sm font-medium">
                        <Link href={task.href}>{task.title}</Link>
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">{task.nextAction}</p>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.lifeAdmin.activeWorkshops.map((workshop) => (
                    <Card key={workshop.id} className="p-3.5">
                      <h3 className="text-sm font-medium">
                        <Link href={`/workshop/${workshop.id}`}>{workshop.title}</Link>
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {workshop.nextAction || workshop.status}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
              <p>
                <Link href="/workshop">Werkstatt öffnen →</Link>
              </p>
            </CardContent>
          </Card>
        </div>

        <p className="text-sm text-muted-foreground">
          <HealthBadge status={data.systemOk ? "ok" : "degraded"} label={data.systemLabel} />
        </p>
      </div>
    </StudioShell>
  );
}
