import { notFound } from "next/navigation";
import { CharacterSheetPanel } from "@/src/components/CharacterSheetPanel";
import { PortalPageNeighborhoodGraph } from "@/src/components/PortalPageNeighborhoodGraph";
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
import {
  createAuthService,
  createCharacterService,
  createPrismaClient,
  getAppRepository,
  buildLevelUpSuggestions,
  type PageWithBlocks,
  type PortalCharacterView,
  type LevelUpSuggestions,
} from "@uwe/database/server";

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
  let characterSheet: PortalCharacterView | null = null;
  let canEditSheet = false;
  let levelUpSuggestions: LevelUpSuggestions | null = null;
  let campaignId: string | null = null;
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
      visiblePage.campaignId ?? (await repo.listCampaignsByWorld(worldSlug))[0]?.id ?? null;

    notes = campaignId
      ? await auth.listPlayerNotesForViewer(worldSlug, ctx, {
          pageId: visiblePage.id,
          campaignId,
        })
      : [];

    const world = await db.world.findUnique({
      where: { slug: worldSlug },
      select: { guestCommentsEnabled: true },
    });
    canComment = Boolean(campaignId && world && canCreatePlayerNote(ctx, world.guestCommentsEnabled));

    if (visiblePage.type === "player_character") {
      canEditCharacter = visiblePage.contentBlocks.some((block) =>
        canEditPlayerCharacterBlock(ctx, visiblePage, block),
      );

      const characters = createCharacterService(db);
      const linked = await characters.getByPageId(visiblePage.id);
      if (linked) {
        characterSheet = await auth.getCharacterForViewer(worldSlug, linked.id, ctx);
        canEditSheet = Boolean(
          characterSheet &&
            ctx.user &&
            characterSheet.ownerUserId === ctx.user.id &&
            ctx.effectiveRole === "player" &&
            !ctx.previewAsUserId,
        );
        levelUpSuggestions = buildLevelUpSuggestions({
          level: linked.level,
          classes: linked.classes,
          abilities: linked.abilities,
          combat: linked.combat,
        });
      }
    }
  } finally {
    await db.$disconnect();
  }

  if (!page) {
    notFound();
  }

  const returnPath = `/auth/worlds/${worldSlug}/${slug}`;

  return (
    <article className="portal-content-card">
      <a href={`/auth/worlds/${worldSlug}`} className="uwe-back-link">
        ← Zurück zur Übersicht
      </a>

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

      <PortalPageNeighborhoodGraph worldSlug={worldSlug} pageId={page.id} />

      {characterSheet && (
        <CharacterSheetPanel
          worldSlug={worldSlug}
          pageSlug={slug}
          character={characterSheet}
          returnPath={returnPath}
          canEdit={canEditSheet}
          levelUpSuggestions={levelUpSuggestions}
        />
      )}

      {canEditCharacter && (
        <PlayerCharacterEditPanel worldSlug={worldSlug} page={page} returnPath={returnPath} />
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
  );
}
