import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
  WikiContent,
} from "@uwe/shared-ui";
import {
  createAuthService,
  createCharacterService,
  createPartyTreasuryService,
  getAppRepository,
  portalAssetUrl,
  renderAssetBlockHtml,
  buildLevelUpSuggestions,
  QUEST_LIFECYCLE_LABELS,
  type PageWithBlocks,
  type PlayerSafeInventoryItemView,
  type PortalCharacterView,
  type LevelUpSuggestions,
  type QuestLifecycleStatus,
} from "@uwe/database/server";
import { disconnectPrismaClientIfOwned, getSharedPrismaClient } from "@uwe/database/client";
import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/src/components/ui/card";

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

  const db = getSharedPrismaClient();
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
    // Seite und Render-Kontext hängen nicht voneinander ab — eine Runde statt
    // zwei. Alles Weitere braucht die Seite und bleibt dahinter.
    const [loadedPage, renderCtx] = await Promise.all([
      auth.getPageForViewer(worldSlug, slug, ctx),
      auth.buildViewerRenderContext(worldSlug, ctx),
    ]);
    page = loadedPage;
    if (!page) {
      notFound();
    }

    const visiblePage = page;

    // Der Kampagnen-Fallback fragt nur bei Seiten ohne eigene Kampagne nach.
    campaignId =
      visiblePage.campaignId ?? (await repo.listCampaignsByWorld(worldSlug))[0]?.id ?? null;

    // Kein world.findUnique mehr: getAccessContextForWorld liefert nur für
    // existierende, lesbare Welten einen Kontext — die Welt gibt es hier immer.
    canComment = Boolean(campaignId && canCreatePlayerNote(ctx));

    // Bildblöcke bekommen ihr Bild dazu. Die Portal-Asset-Route verlangt den
    // `world`-Parameter und prüft den Zugriff gegen genau diese Welt.
    const assetUrl = portalAssetUrl(worldSlug);
    const blockHtmlPromise = Promise.all(
      visiblePage.contentBlocks.map(async (block) => {
        const html = await auth.renderBlockContentForViewer(
          worldSlug,
          block.content,
          ctx,
          renderCtx,
        );
        return renderAssetBlockHtml(block, html, { assetUrl });
      }),
    );

    const notesPromise = campaignId
      ? auth.listPlayerNotesForViewer(worldSlug, ctx, {
          pageId: visiblePage.id,
          campaignId,
        })
      : Promise.resolve([]);

    // Charakterbogen-Kette (nur player_character): getByPageId muss zuerst
    // laufen, Bogen und Inventar dahinter sind voneinander unabhängig.
    const characterPromise = (async () => {
      if (visiblePage.type !== "player_character") {
        return null;
      }

      const characters = createCharacterService(db);
      const linked = await characters.getByPageId(visiblePage.id);
      if (!linked) {
        return null;
      }

      const treasury = createPartyTreasuryService(db);
      const [sheet, inventory] = await Promise.all([
        auth.getCharacterForViewer(worldSlug, linked.id, ctx),
        treasury.listItemsForCharacterForViewer(worldSlug, linked.id, ctx),
      ]);

      return { linked, sheet, inventory };
    })();

    const [renderedBlocks, loadedNotes, characterData] = await Promise.all([
      blockHtmlPromise,
      notesPromise,
      characterPromise,
    ]);
    blockHtml = renderedBlocks;
    notes = loadedNotes;

    if (visiblePage.type === "player_character") {
      canEditCharacter = visiblePage.contentBlocks.some((block) =>
        canEditPlayerCharacterBlock(ctx, visiblePage, block),
      );
    }

    if (characterData) {
      characterSheet = characterData.sheet;
      canEditSheet = Boolean(
        characterSheet &&
          ctx.user &&
          characterSheet.ownerUserId === ctx.user.id &&
          ctx.worldMembership !== null &&
          !ctx.previewAsUserId,
      );
      // Inventar zählt nur mit sichtbarem Bogen — wie vorher, als die Abfrage
      // hinter `if (characterSheet)` stand; parallel geladen wird es trotzdem.
      characterInventory = characterSheet ? (characterData.inventory ?? []) : [];
      levelUpSuggestions = buildLevelUpSuggestions({
        level: characterData.linked.level,
        classes: characterData.linked.classes,
        abilities: characterData.linked.abilities,
        combat: characterData.linked.combat,
      });
    }
  } finally {
    await disconnectPrismaClientIfOwned(db);
  }

  if (!page) {
    notFound();
  }

  const returnPath = `/auth/worlds/${worldSlug}/${slug}`;

  return (
    <article className="grid gap-6">
      <Link
        href={`/auth/worlds/${worldSlug}`}
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Zurück zur Übersicht
      </Link>

      <header className="space-y-3 border-b border-border pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PageTypeBadge type={page.type} />
          {page.type === "quest" ? (
            <Badge variant="default">
              {QUEST_LIFECYCLE_LABELS[(page.questStatus ?? "open") as QuestLifecycleStatus]}
            </Badge>
          ) : null}
        </div>
        {page.summary ? <p className="text-sm text-muted-foreground">{page.summary}</p> : null}
      </header>

      <div className="grid gap-4">
        {page.contentBlocks.map((block, index) => (
          <Card key={block.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{BLOCK_TYPE_LABELS[block.type]}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {block.type === "image" && block.assetId ? (
                <figure className="overflow-hidden rounded-[var(--radius)] border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/assets/${block.assetId}/file?world=${encodeURIComponent(worldSlug)}`}
                    alt={block.content?.trim() || page.title}
                    loading="lazy"
                    className="h-auto w-full"
                  />
                  {block.content?.trim() ? (
                    <figcaption className="border-t border-border px-3 py-2 text-sm text-muted-foreground">
                      {block.content}
                    </figcaption>
                  ) : null}
                </figure>
              ) : (
                <WikiContent html={blockHtml[index] ?? ""} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <PortalPageNeighborhoodGraph worldSlug={worldSlug} pageId={page.id} />

      <PortalPageChronicleSection worldSlug={worldSlug} pageId={page.id} ctx={ctx} />

      {characterSheet ? (
        <CharacterSheetPanel
          worldSlug={worldSlug}
          pageSlug={slug}
          character={characterSheet}
          returnPath={returnPath}
          canEdit={canEditSheet}
          levelUpSuggestions={levelUpSuggestions}
          inventoryItems={characterInventory}
        />
      ) : null}

      {canEditCharacter ? (
        <PlayerCharacterEditPanel worldSlug={worldSlug} page={page} returnPath={returnPath} />
      ) : null}

      {campaignId ? (
        <PlayerNotesPanel
          worldSlug={worldSlug}
          campaignId={campaignId}
          notes={notes}
          currentUserId={user?.id ?? null}
          canComment={canComment}
          pageId={page.id}
          returnPath={returnPath}
        />
      ) : null}
    </article>
  );
}
