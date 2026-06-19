import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/src/components/AuthHeader";
import { PlayerCharacterEditPanel } from "@/src/components/PlayerCharacterEditPanel";
import { PlayerNotesPanel } from "@/src/components/PlayerNotesPanel";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import { canCreatePlayerNote, canEditPlayerCharacterBlock } from "@uwe/auth";
import {
  BLOCK_TYPE_LABELS,
  PageTypeBadge,
  VisibilityBadge,
  WikiContent,
} from "@uwe/shared-ui";
import { createAuthService, createPrismaClient, getAppRepository, type PageWithBlocks } from "@uwe/database/server";

interface Props {
  params: Promise<{ worldSlug: string; slug: string }>;
}

export default async function AuthWorldPageDetail({ params }: Props) {
  const { worldSlug, slug } = await params;
  const user = await getCurrentUser();
  const ctx = await getAccessContextForWorld(worldSlug);

  if (!ctx) {
    notFound();
  }

  const db = createPrismaClient();
  const auth = createAuthService(db);
  const repo = getAppRepository();

  let page: PageWithBlocks | null = null;
  let notes;
  let canComment = false;
  let canEditCharacter = false;
  let campaignId: string | null = null;
  let worldName = worldSlug;
  let blockHtml: string[] = [];

  try {
    page = await auth.getPageForViewer(worldSlug, slug, ctx);
    if (!page) {
      notFound();
    }

    const visiblePage = page;

    blockHtml = await Promise.all(
      visiblePage.contentBlocks.map((block) =>
        auth.renderBlockContentForViewer(worldSlug, block.content, ctx),
      ),
    );

    campaignId =
      visiblePage.campaignId ??
      (await repo.listCampaignsByWorld(worldSlug))[0]?.id ??
      null;

    notes = campaignId
      ? await auth.listPlayerNotesForViewer(worldSlug, ctx, {
          pageId: visiblePage.id,
          campaignId,
        })
      : [];

    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { name: true, guestCommentsEnabled: true },
    });
    worldName = world?.name ?? worldSlug;
    canComment = Boolean(campaignId && world && canCreatePlayerNote(ctx, world.guestCommentsEnabled));

    if (visiblePage.type === "player_character") {
      canEditCharacter = visiblePage.contentBlocks.some((block) =>
        canEditPlayerCharacterBlock(ctx, visiblePage, block),
      );
    }
  } finally {
    await db.$disconnect();
  }

  if (!page) {
    notFound();
  }

  const returnPath = `/auth/worlds/${worldSlug}/${slug}`;

  return (
    <main className="auth-page">
      <AuthHeader user={user} />
      <article className="auth-card auth-card-wide">
        <div className="auth-breadcrumb">
          <Link href="/auth/worlds">Welten</Link> /{" "}
          <Link href={`/auth/worlds/${worldSlug}`}>{worldName}</Link> / {page.title}
        </div>

        <header className="auth-page-header">
          <h1>{page.title}</h1>
          <div className="auth-page-list-badges">
            <PageTypeBadge type={page.type} />
            <VisibilityBadge visibility={page.visibility} />
          </div>
          {page.summary && <p className="auth-lead">{page.summary}</p>}
        </header>

        <div className="auth-blocks">
          {page.contentBlocks.map((block, index) => (
            <section key={block.id} className="auth-block">
              <div className="auth-block-meta">
                <span className="uwe-badge uwe-badge-type">{BLOCK_TYPE_LABELS[block.type]}</span>
                <VisibilityBadge visibility={block.visibility} />
              </div>
              <div className="auth-block-content">
                <WikiContent html={blockHtml[index] ?? ""} />
              </div>
            </section>
          ))}
        </div>

        {canEditCharacter && (
          <PlayerCharacterEditPanel
            worldSlug={worldSlug}
            page={page}
            returnPath={returnPath}
          />
        )}

        {campaignId && (
          <PlayerNotesPanel
            worldSlug={worldSlug}
            campaignId={campaignId}
            notes={notes}
            currentUserId={user?.id ?? null}
            canComment={canComment}
            pageId={page.id}
            returnPath={returnPath}
          />
        )}
      </article>
    </main>
  );
}
