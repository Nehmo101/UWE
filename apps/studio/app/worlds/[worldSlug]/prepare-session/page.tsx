import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DungeonPrepStatusBadge,
  GameSessionStatusBadge,
  ResponsiveTable,
  SidebarSection,
} from "@uwe/shared-ui";
import {
  createAiRunService,
  createAuthService,
  createPrismaClient,
  getAppRepository,
  prisma,
  type DmGameSessionView,
} from "@uwe/database/server";
import {
  buildChapterTree,
  createCampaignCockpitService,
  findCurrentChapter,
  type CampaignOverview,
} from "@uwe/campaign-cockpit";
import {
  buildPrepareNextSessionOutline,
  getInferenceStatus,
  serializePrepareNextSessionOutline,
} from "@uwe/ai-brain";
import { PrepareSessionPanel } from "@/components/PrepareSessionPanel";
import { SettingsCollapsiblePanel } from "@/components/SettingsCollapsiblePanel";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { CampaignSidebar } from "@/src/components/wiki";
import { campaignNavItems } from "@/src/lib/world-nav";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { requireStudioWorldRead } from "@/src/lib/authz";
import { buttonVariants } from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campaign?: string; sessionId?: string; chapter?: string }>;
}

const PRE_CLASS =
  "whitespace-pre-wrap overflow-x-auto rounded-[var(--radius)] border border-border bg-muted p-3 text-sm";

function isUpcomingSession(session: DmGameSessionView): boolean {
  return session.status === "planned" || session.status === "prepared";
}

function sortBySessionNumber(a: DmGameSessionView, b: DmGameSessionView): number {
  return a.sessionNumber - b.sessionNumber;
}

function pickReferenceSession(sessions: DmGameSessionView[]): DmGameSessionView | null {
  const played = sessions
    .filter((session) => session.status === "played" || session.status === "summarized")
    .sort(sortBySessionNumber);
  if (played.length > 0) {
    return played[played.length - 1] ?? null;
  }

  const withContext = sessions
    .filter((session) => session.summaryDm?.trim() || session.openPlots?.trim())
    .sort(sortBySessionNumber);
  if (withContext.length > 0) {
    return withContext[withContext.length - 1] ?? null;
  }

  return sessions.length > 0 ? (sessions.sort(sortBySessionNumber)[sessions.length - 1] ?? null) : null;
}

export default async function PrepareSessionPage({ params, searchParams }: Props) {
  const { worldSlug } = await params;
  const { campaign: campaignSlug, sessionId: sessionIdParam, chapter: chapterParam } = await searchParams;
  await requireStudioWorldRead(worldSlug);
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) {
    notFound();
  }

  // Kampagne als Filter und Kontext — dieselbe Semantik wie auf /sessions.
  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const selectedCampaign = campaignSlug
    ? campaigns.find((candidate) => candidate.slug === campaignSlug)
    : null;

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const aiRuns = createAiRunService();
  const [sessions, inference, latestPrepRun, campaignOverview] = await Promise.all([
    auth.listGameSessionsForDm(worldSlug, selectedCampaign?.id ?? undefined),
    getInferenceStatus({ useMock: process.env.AI_USE_MOCK === "true" }),
    aiRuns.list({
      worldId: world.id,
      taskType: "next_session_prep",
      status: "completed",
      limit: 1,
    }),
    selectedCampaign
      ? createCampaignCockpitService(prisma).getCampaignOverview(
          worldSlug,
          selectedCampaign.slug,
        )
      : Promise.resolve<CampaignOverview | null>(null),
  ]);
  await db.$disconnect();

  // findCurrentChapter ist generisch — liefert die volle ChapterSummary zurück.
  const actTree = campaignOverview ? buildChapterTree(campaignOverview.chapters) : [];
  const acts = actTree.map((node) => node.chapter);
  const requestedAct = chapterParam
    ? acts.find((act) => act.id === chapterParam || act.slug === chapterParam)
    : undefined;
  const currentAct = requestedAct ?? findCurrentChapter(acts);
  const currentActNode = currentAct
    ? actTree.find((node) => node.chapter.id === currentAct.id)
    : undefined;

  const upcomingSessions = sessions.filter(isUpcomingSession).sort(sortBySessionNumber);
  const referenceSession = pickReferenceSession(sessions);
  const outline =
    referenceSession &&
    buildPrepareNextSessionOutline({
      worldSlug,
      lastSessionTitle: referenceSession.title,
      summaryDm: referenceSession.summaryDm,
      openPlots: referenceSession.openPlots,
      playerDecisions: referenceSession.playerDecisions,
      linkedPages: referenceSession.linkedPages.map((page) => ({
        title: page.title,
        type: page.type,
      })),
    });
  const outlineText = outline ? serializePrepareNextSessionOutline(outline) : null;

  // ?sessionId= kommt von der Session-Detailseite („Session vorbereiten →")
  // und war lange ein toter Parameter — jetzt wählt er die Session wirklich vor.
  const requestedSession = sessionIdParam
    ? sessions.find((session) => session.id === sessionIdParam)
    : undefined;
  const defaultSessionId =
    requestedSession?.id ?? upcomingSessions[0]?.id ?? referenceSession?.id ?? sessions[0]?.id;

  const base = `/worlds/${worldSlug}`;

  return (
    <>
      <ShellBreadcrumb
        items={worldSectionBreadcrumb(
          world.name,
          worldSlug,
          "Session vorbereiten",
          `${base}/prepare-session`,
        )}
      />
      <ShellContextPanel>
        <CampaignSidebar
          items={campaignNavItems(`${base}/prepare-session`, campaigns, campaignSlug)}
          manageHref={`${base}/kampagnen`}
        />
        <SidebarSection title="Kontext">
          <p className="text-sm text-muted-foreground">
            {sessions.length} Sessions
            {selectedCampaign ? ` in „${selectedCampaign.name}“` : " in der ganzen Welt"}
          </p>
        </SidebarSection>
      </ShellContextPanel>
      <PageHeader
        title="Session vorbereiten"
        summary="Kommende Sessions im Blick, heuristische Outline-Vorschau und KI-Generator für das nächste Spielabend-Paket."
        actions={
          <span className="inline-flex flex-wrap gap-2">
            {selectedCampaign ? (
              <Link
                className={buttonVariants({ variant: "outline" })}
                href={`${base}/kampagnen/${selectedCampaign.slug}`}
              >
                Kampagnen-Überblick
              </Link>
            ) : null}
            <Link className={buttonVariants({ variant: "ghost" })} href={`${base}/sessions`}>
              Alle Sessions
            </Link>
          </span>
        }
      />

      {selectedCampaign && campaignOverview ? (
        <SettingsCollapsiblePanel
          title={`Wo steht „${selectedCampaign.name}“?`}
          summary={campaignOverview.progress.label || "Blick ins Kampagnen-Cockpit"}
          defaultOpen
        >
          {currentAct ? (
            <div className="flex flex-col gap-2 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Aktueller Akt:</span>
                <Link href={currentAct.href} className="font-medium">
                  {currentAct.title}
                </Link>
                <DungeonPrepStatusBadge status={currentAct.prepStatus} />
                <span className="text-muted-foreground">
                  {currentAct.questCounts.total > 0
                    ? `${currentAct.questCounts.open} offene Quest(s)`
                    : "keine Quests"}
                </span>
              </p>
              {currentAct.summary ? (
                <p><span className="font-medium">DM-Auftrag:</span> {currentAct.summary}</p>
              ) : null}
              {currentActNode && currentActNode.children.length > 0 ? (
                <ol className="ml-5 list-decimal space-y-1 text-muted-foreground">
                  {currentActNode.children.map(({ chapter }) => (
                    <li key={chapter.id}>
                      <Link href={chapter.href}>{chapter.title}</Link>
                      {chapter.summary ? ` — ${chapter.summary}` : ""}
                    </li>
                  ))}
                </ol>
              ) : null}
              <p>
                Die Akt-Tafel bündelt NSCs, Orte, Fraktionen, Quests und Dungeons aus allen
                Unterkapiteln auf der <Link href={currentAct.href}>Akt-Seite</Link>.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Kein offenes Kapitel — alle gespielt oder noch keins angelegt.{" "}
              <Link href={`${base}/kampagnen/${selectedCampaign.slug}`}>Zum Überblick →</Link>
            </p>
          )}
          {campaignOverview.lastSession ? (
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Zuletzt gespielt:</span>{" "}
              <Link href={campaignOverview.lastSession.href}>
                Session {campaignOverview.lastSession.sessionNumber}:{" "}
                {campaignOverview.lastSession.title}
              </Link>
            </p>
          ) : null}
          {campaignOverview.dungeons.length > 0 ? (
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Dungeons:</span>{" "}
              {campaignOverview.dungeons.map((dungeon, index) => (
                <span key={dungeon.id}>
                  {index > 0 ? " · " : null}
                  <Link href={dungeon.href}>{dungeon.title}</Link>
                </span>
              ))}
            </p>
          ) : null}
        </SettingsCollapsiblePanel>
      ) : null}

      <SettingsCollapsiblePanel
        title="Kommende Sessions"
        summary={`${upcomingSessions.length} geplant`}
        defaultOpen
      >
        <ResponsiveTable
          caption="Kommende Sessions"
          rowKey={(session) => session.id}
          rows={upcomingSessions}
          columns={[
            {
              key: "title",
              label: "Titel",
              primary: true,
              render: (session) => (
                <Link href={`/worlds/${worldSlug}/sessions/${session.id}`}>{session.title}</Link>
              ),
            },
            {
              key: "number",
              label: "#",
              numeric: true,
              render: (session) => session.sessionNumber,
            },
            {
              key: "date",
              label: "Datum",
              render: (session) =>
                session.date ? session.date.toLocaleDateString("de-DE") : "—",
            },
            {
              key: "status",
              label: "Status",
              render: (session) => <GameSessionStatusBadge status={session.status} />,
            },
          ]}
          empty={
            <p className="text-sm text-muted-foreground">
              Keine geplanten Sessions.{" "}
              <Link
                href={`/worlds/${worldSlug}/sessions/new${selectedCampaign ? `?campaign=${selectedCampaign.slug}${currentAct ? `&chapter=${currentAct.slug}` : ""}` : ""}`}
              >
                Neue Session anlegen →
              </Link>
            </p>
          }
        />
      </SettingsCollapsiblePanel>

      {latestPrepRun.runs[0]?.resultText ? (
        <SettingsCollapsiblePanel
          title="Letztes Session-Paket (Brain)"
          summary="SSR aus letztem abgeschlossenen KI-Lauf"
          defaultOpen
        >
          <p className="text-sm text-muted-foreground">
            Abgeschlossen {latestPrepRun.runs[0].updatedAt.toLocaleString("de-DE")} — Review vor
            Übernahme.
          </p>
          <pre className={PRE_CLASS}>{latestPrepRun.runs[0].resultText}</pre>
          <p>
            <Link href={`/worlds/${worldSlug}/ai-runs/${latestPrepRun.runs[0].id}`}>
              AI Run öffnen →
            </Link>
          </p>
        </SettingsCollapsiblePanel>
      ) : null}

      {outlineText && referenceSession && (
        <SettingsCollapsiblePanel
          title="Heuristische Outline-Vorschau"
          summary={`Aus Session #${referenceSession.sessionNumber}`}
          defaultOpen={false}
        >
          <p className="text-sm text-muted-foreground">
            Deterministische Vorschau aus Session #{referenceSession.sessionNumber} „
            {referenceSession.title}“ — kein KI-Ersatz, nur Orientierung vor dem Generator-Lauf.
          </p>
          <pre className={PRE_CLASS}>{outlineText}</pre>
        </SettingsCollapsiblePanel>
      )}

      <SettingsCollapsiblePanel
        title="KI Session-Paket generieren"
        summary="Maschinenraum-only — Review vor Übernahme"
        defaultOpen
      >
        <PrepareSessionPanel
          worldSlug={worldSlug}
          sessions={sessions.map((session) => ({
            id: session.id,
            title: session.title,
            sessionNumber: session.sessionNumber,
          }))}
          defaultSessionId={defaultSessionId}
          engineReady={inference.online}
          engineEnabled={inference.enabled}
        />
      </SettingsCollapsiblePanel>
    </>
  );
}
