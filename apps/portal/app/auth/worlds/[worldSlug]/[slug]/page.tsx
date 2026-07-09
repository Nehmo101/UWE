import Link from "next/link";
import { notFound } from "next/navigation";
import { CharacterSheetPanel } from "@/src/components/CharacterSheetPanel";
import { PortalPageNeighborhoodGraph } from "@/src/components/PortalPageNeighborhoodGraph";
import { PortalPageChronicleSection } from "@/src/components/PortalPageChronicleSection";
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
  createPartyTreasuryService,
  createPrismaClient,
  getAppRepository,
  buildLevelUpSuggestions,
  QUEST_LIFECYCLE_LABELS,
  type PageWithBlocks,
  type PlayerSafeInventoryItemView,
  type PortalCharacterView,
  type LevelUpSuggestions,
  type QuestLifecycleStatus,
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
  let characterInventory: PlayerSafeInventoryItemView[] = [];
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
        if (characterSheet) {
          const treasury = createPartyTreasuryService(db);
          characterInventory =
            (await treasury.listItemsForCharacterForViewer(worldSlug, linked.id, ctx)) ?? [];
        }
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
      <Link href={`/auth/worlds/${worldSlug}`} className="uwe-back-link">
        ← Zurück zur Übersicht
      </Link>

      <header className="auth-page-header">
        <h1>{page.title}</h1>
        <div className="auth-page-list-badges">
          <PageTypeBadge type={page.type} />
          <VisibilityBadge visibility={page.visibility} />
          {page.type === "quest" && (
            <span className="uwe-badge">
              {QUEST_LIFECYCLE_LABELS[(page.questStatus ?? "open") as QuestLifecycleStatus]}
            </span>
          )}
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
              {block.type === "image" && block.assetId ? (
                <figure className="uwe-wiki-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/assets/${block.assetId}/file?world=${encodeURIComponent(worldSlug)}`}
                    alt={block.content?.trim() || page.title}
                    loading="lazy"
                  />
                  {block.content?.trim() && <figcaption>{block.content}</figcaption>}
                </figure>
              ) : (
                <WikiContent html={blockHtml[index] ?? ""} />
              )}
            </div>
          </section>
        ))}
      </div>

      <PortalPageNeighborhoodGraph worldSlug={worldSlug} pageId={page.id} />

      <PortalPageChronicleSection worldSlug={worldSlug} pageId={page.id} ctx={ctx} />

      {characterSheet && (
        <CharacterSheetPanel
          worldSlug={worldSlug}
          pageSlug={slug}
          character={characterSheet}
          returnPath={returnPath}
          canEdit={canEditSheet}
          levelUpSuggestions={levelUpSuggestions}
          inventoryItems={characterInventory}
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
