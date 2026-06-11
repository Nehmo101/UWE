import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/src/components/AuthHeader";
import { PlayerNotesPanel } from "@/src/components/PlayerNotesPanel";
import { getAccessContextForWorld, getCurrentUser } from "@/src/lib/auth";
import { canCreatePlayerNote } from "@uwe/auth";
import {
  BLOCK_TYPE_LABELS,
  PageTypeBadge,
  VisibilityBadge,
} from "@uwe/shared-ui";
import { createAuthService, createPrismaClient, getAppRepository } from "@uwe/database/server";

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

  let page;
  let notes;
  let canComment = false;
  let campaignId: string | null = null;

  try {
    page = await auth.getPageForViewer(worldSlug, slug, ctx);
    if (!page) {
      notFound();
    }

    campaignId =
      page.campaignId ??
      (await repo.listCampaignsByWorld(worldSlug))[0]?.id ??
      null;

    notes = campaignId
      ? await auth.listPlayerNotesForViewer(worldSlug, ctx, {
          pageId: page.id,
          campaignId,
        })
      : [];

    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { guestCommentsEnabled: true },
    });
    canComment = Boolean(campaignId && world && canCreatePlayerNote(ctx, world.guestCommentsEnabled));
  } finally {
    await db.$disconnect();
  }

  const returnPath = `/auth/worlds/${worldSlug}/${slug}`;

  return (
    <main className="auth-page">
      <AuthHeader user={user} />
      <article className="auth-card auth-card-wide">
        <div className="auth-breadcrumb">
          <Link href="/auth/worlds">Welten</Link> /{" "}
          <Link href={`/auth/worlds/${worldSlug}`}>{worldSlug}</Link> / {page.title}
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
          {page.contentBlocks.map((block) => (
            <section key={block.id} className="auth-block">
              <div className="auth-block-meta">
                <span className="uwe-badge uwe-badge-type">{BLOCK_TYPE_LABELS[block.type]}</span>
                <VisibilityBadge visibility={block.visibility} />
              </div>
              <div className="auth-block-content wiki-content">{block.content}</div>
            </section>
          ))}
        </div>

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
