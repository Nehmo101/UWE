import Link from "next/link";
import { buttonVariants } from "@/src/components/ui/button";
import { notFound } from "next/navigation";
import { GameSessionStatusBadge } from "@uwe/shared-ui";
import {
  buildPageUrl,
  createAuthService,
  createConnectorService,
  createPrismaClient,
  createSessionLiveService,
  getAppRepository,
  prisma,
  sessionLiveKindLabel,
} from "@uwe/database/server";
import { SessionLivePanel } from "@/components/SessionLivePanel";
import { SessionLiveSoundboard } from "@/components/SessionLiveSoundboard";
import { SessionRunner } from "@/components/session-runner/SessionRunner";
import { latestBookmark } from "@uwe/session-runner";
import type { SoundboardButtonView } from "@uwe/shared-ui";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";
import { isLikelyGameSessionId } from "@/src/lib/session-route";

interface Props {
  params: Promise<{ worldSlug: string; sessionId: string }>;
}

export default async function SessionLivePage({ params }: Props) {
  const { worldSlug, sessionId } = await params;
  const repo = getAppRepository();
  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  if (!isLikelyGameSessionId(sessionId)) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const session = await auth.getGameSessionForDm(worldSlug, sessionId);
  const campaigns = await repo.listCampaignsByWorld(worldSlug);
  const sessionCampaign = session?.campaignId
    ? campaigns.find((campaign) => campaign.id === session.campaignId)
    : null;
  const liveEntries = session
    ? await createSessionLiveService(db).listEntries(sessionId)
    : [];
  const soundboardButtons: SoundboardButtonView[] = session
    ? (await auth.listSoundboardForDm(worldSlug, session.campaignId)).map((button) => ({
        id: button.id,
        title: button.title,
        sourceType: button.sourceType,
        sourceUrl: button.sourceUrl,
        assetId: button.assetId,
        assetFileUrl: button.assetId ? `/api/assets/${button.assetId}/file` : null,
        thumbnail: button.thumbnail,
        volume: button.volume,
        loop: button.loop,
        tags: button.tags,
        linkedPages: button.linkedPages.map((page) => ({ title: page.title })),
      }))
    : [];
  await db.$disconnect();

  const connectorSummary = await createConnectorService(prisma).summarize();
  const engineAudioOnline = connectorSummary.availableCapabilities.includes("audio_local");

  if (!session) notFound();

  const linkedPages = session.linkedPages.map((page) => ({
    id: page.id,
    title: page.title,
    href: buildPageUrl(worldSlug, page.type, page.slug),
  }));

  // Wo zuletzt gelesen wurde. Das Lesezeichen zeigt auf eine Seiten-ID; der
  // Runner braucht den Slug, also wird er hier einmal nachgeschlagen.
  const bookmark = latestBookmark(
    liveEntries.map((entry) => ({
      kind: entry.kind,
      refPageId: entry.refPageId ?? null,
      payload: entry.payload ?? null,
      createdAt: entry.createdAt,
    })),
  );
  const bookmarkPage = bookmark ? await repo.getPageById(bookmark.pageId) : null;

  const jumpTargets = session.linkedPages.map((page) => ({
    id: page.id,
    title: page.title,
    slug: page.slug,
    type: page.type,
  }));

  const linkedById = new Map(linkedPages.map((page) => [page.id, page]));
  const timeFormat = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
  const entryViews = liveEntries.map((entry) => {
    const ref = entry.refPageId ? linkedById.get(entry.refPageId) : undefined;
    return {
      id: entry.id,
      kind: entry.kind,
      kindLabel: sessionLiveKindLabel(entry.kind),
      content: entry.content,
      time: timeFormat.format(entry.createdAt),
      refHref: ref?.href ?? null,
      refTitle: ref?.title ?? null,
    };
  });

  return (
    <>
      <ShellBreadcrumb
        items={[
          ...worldDetailBreadcrumb(
            world.name,
            worldSlug,
            "Sessions",
            `/worlds/${worldSlug}/sessions`,
            session.title,
          ),
          { label: "Live" },
        ]}
      />
      <PageHeader
        title={`Live · Session ${session.sessionNumber}`}
        meta={<GameSessionStatusBadge status={session.status} />}
        actions={
          <Link href={`/worlds/${worldSlug}/prepare-session`} className={buttonVariants({ variant: "outline" })}>
            Session vorbereiten
          </Link>
        }
      />

      <SessionRunner
        worldSlug={worldSlug}
        sessionId={sessionId}
        jumpTargets={jumpTargets}
        initialPageSlug={bookmarkPage?.slug ?? null}
        initialAnchor={bookmark?.anchor ?? null}
      />

      <SessionLivePanel
        worldSlug={worldSlug}
        sessionId={sessionId}
        sessionTitle={session.title}
        initialNotes={session.notes ?? ""}
        linkedPages={linkedPages}
        entries={entryViews}
      />

      <SessionLiveSoundboard
        worldSlug={worldSlug}
        sessionId={sessionId}
        buttons={soundboardButtons}
        campaignSlug={sessionCampaign?.slug ?? null}
        engineAudioOnline={engineAudioOnline}
      />
    </>
  );
}
