import Link from "next/link";
import { notFound } from "next/navigation";
import { GameSessionStatusBadge } from "@uwe/shared-ui";
import {
  buildPageUrl,
  createAuthService,
  createPrismaClient,
  createSessionLiveService,
  getAppRepository,
  sessionLiveKindLabel,
} from "@uwe/database/server";
import { SessionLivePanel } from "@/components/SessionLivePanel";
import { SessionLiveSoundboard } from "@/components/SessionLiveSoundboard";
import type { SoundboardButtonView } from "@uwe/shared-ui";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
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
  const liveEntries = session
    ? await createSessionLiveService(db).listEntries(sessionId)
    : [];
  const soundboardButtons: SoundboardButtonView[] = session
    ? (await auth.listSoundboardForDm(worldSlug)).map((button) => ({
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
        visibility: button.visibility,
        linkedPages: button.linkedPages.map((page) => ({ title: page.title })),
      }))
    : [];
  await db.$disconnect();

  if (!session) notFound();

  const linkedPages = session.linkedPages.map((page) => ({
    id: page.id,
    title: page.title,
    href: buildPageUrl(worldSlug, page.type, page.slug),
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
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      navMode="live"
      liveSessionId={sessionId}
      breadcrumb={
        <BreadcrumbTrail
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
      }
    >
      <PageHeader
        title={`Live · Session ${session.sessionNumber}`}
        meta={<GameSessionStatusBadge status={session.status} />}
        actions={
          <Link href={`/worlds/${worldSlug}/prepare-session`} className="uwe-v2-btn">
            Session vorbereiten
          </Link>
        }
      />

      <SessionLivePanel
        worldSlug={worldSlug}
        sessionId={sessionId}
        sessionTitle={session.title}
        initialNotes={session.notes ?? ""}
        linkedPages={linkedPages}
        entries={entryViews}
      />

      <SessionLiveSoundboard worldSlug={worldSlug} buttons={soundboardButtons} />
    </WorldShell>
  );
}
