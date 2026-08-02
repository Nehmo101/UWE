import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CollapsibleSection,
  PAGE_TYPE_LABELS,
  CANONICAL_LABELS,
  BLOCK_TYPE_LABELS,
} from "@uwe/shared-ui";
import { EditPageStickyBar } from "../../../../../../components/EditPageStickyBar";
import { ContentBlockBody } from "../../../../../../components/ContentBlockBody";
import { ContextualGeneratorPanel } from "../../../../../../components/ContextualGeneratorPanel";
import { getGeneratorPanelData } from "@/src/lib/generator-handlers";
import {
  buildPageUrl,
  getAppRepository,
  navCategoryForPageType,
  parseStringArray,
  PageTypeEnum,
  CanonicalStatusEnum,
  ContentBlockTypeEnum,
} from "@uwe/database/server";
import {
  updatePageAction,
  updateContentBlockAction,
  createContentBlockAction,
  deleteContentBlockAction,
} from "../../../../../actions";
import { pagePreviewHref } from "@/src/lib/page-preview";
import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { worldWikiPath } from "@/src/lib/world-last-route";
import { CampaignSidebar } from "@/src/components/wiki";
import { PageLinksPanel } from "@/components/wiki/PageLinksPanel";
import { PageChroniclePanel } from "@/components/wiki/PageChroniclePanel";
import { FactionStateEditPanel } from "@/components/wiki/FactionStateEditPanel";
import { FactionSimulatorSection } from "@/components/wiki/FactionSimulatorSection";
import { QuestStatusEditPanel } from "@/components/wiki/QuestStatusEditPanel";
import { CharacterSheetEditPanel } from "@/components/wiki/CharacterSheetEditPanel";
import { ItemBuilderSection } from "@/components/wiki/ItemBuilderSection";
import { MagicItemBuilderSection } from "@/components/wiki/MagicItemBuilderSection";
import { QuestBuilderSection } from "@/components/wiki/QuestBuilderSection";
import { StructuredGeneratorSection } from "@/components/wiki/StructuredGeneratorSection";
import { StatblockStudioSection } from "@/components/wiki/StatblockStudioSection";
import { PageEditAutosave } from "@/src/components/ux/PageEditAutosave";
import { worldDetailBreadcrumb } from "@/src/lib/world-breadcrumbs";
import {
  Alert,
  Button,
  buttonVariants,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";

interface Props {
  params: Promise<{ worldSlug: string; category: string; slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}

const FIELD_CLASS = "flex flex-col gap-1.5";

export default async function StudioPageEdit({ params, searchParams }: Props) {
  const { worldSlug, category, slug } = await params;
  const { saved } = await searchParams;
  const repo = getAppRepository();

  const world = await repo.getWorldBySlug(worldSlug);
  if (!world) notFound();

  const page = await repo.getPageBySlug(worldSlug, slug);
  if (!page) notFound();

  if (navCategoryForPageType(page.type) !== category) notFound();

  const tags = parseStringArray(page.tags);
  const aliases = parseStringArray(page.aliases);
  const generatorPanel = await getGeneratorPanelData(worldSlug, slug);
  const pageHref = buildPageUrl(worldSlug, page.type, slug);

  const imageAssets = (await repo.listAssetsByWorld(worldSlug, { type: "image" })).map(
    (asset) => ({ id: asset.id, title: asset.title }),
  );
  const blockTypeOptions = Object.values(ContentBlockTypeEnum).map((type) => ({
    value: type,
    label: BLOCK_TYPE_LABELS[type],
  }));

  return (
    <>
      <ShellBreadcrumb
        items={worldDetailBreadcrumb(
          world.name,
          worldSlug,
          page.title,
          pageHref,
          "Bearbeiten",
        )}
      />
      <ShellContextPanel>
        <CampaignSidebar
          items={[
            { label: "← Seitenansicht", href: pageHref, active: true },
            { label: "Seitenliste", href: worldWikiPath(worldSlug) },
          ]}
        />
      </ShellContextPanel>
      <PageHeader
        title={page.title}
        summary="Seite bearbeiten"
        actions={
          <>
            <Link className={buttonVariants({ variant: "ghost" })} href={pagePreviewHref(worldSlug, page.type, slug)}>
              Vorschau als Spieler
            </Link>
            <Link className={buttonVariants({ variant: "ghost" })} href={`/image-studio?pageId=${page.id}`}>
              Image Studio
            </Link>
          </>
        }
      />
      <div className="pb-24">
        {saved && <Alert tone="success" className="mb-4">Änderungen gespeichert.</Alert>}
        <PageEditAutosave formId="world-page-edit-form" storageKey={`uwe:page-edit:${page.id}`} />

        <form id="world-page-edit-form" action={updatePageAction} className="flex flex-col gap-4">
          <input type="hidden" name="pageId" value={page.id} />
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="pageSlug" value={slug} />

          <div className={FIELD_CLASS}>
            <Label htmlFor="edit-title">Titel</Label>
            <Input id="edit-title" name="title" defaultValue={page.title} required />
          </div>

          <div className={FIELD_CLASS}>
            <Label htmlFor="edit-slug">Slug</Label>
            <Input id="edit-slug" name="slug" defaultValue={page.slug} required />
          </div>

          <div className={FIELD_CLASS}>
            <Label htmlFor="edit-type">Typ</Label>
            <Select name="type" defaultValue={page.type}>
              <SelectTrigger id="edit-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(PageTypeEnum).map((type) => (
                  <SelectItem key={type} value={type}>
                    {PAGE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={FIELD_CLASS}>
            <Label htmlFor="edit-summary">Zusammenfassung</Label>
            <Textarea id="edit-summary" name="summary" defaultValue={page.summary ?? ""} />
          </div>




          <div className={FIELD_CLASS}>
            <Label htmlFor="edit-canonical-status">Kanon-Status</Label>
            <Select name="canonicalStatus" defaultValue={page.canonicalStatus}>
              <SelectTrigger id="edit-canonical-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(CanonicalStatusEnum).map((v) => (
                  <SelectItem key={v} value={v}>{CANONICAL_LABELS[v]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="m-0 text-xs text-muted-foreground">
              Steuert den Kanon-Lebenszyklus: von Idee über Vorbereitung bis etabliertem Kanon
              oder verworfenen Inhalten.
            </p>
          </div>

          <div className={FIELD_CLASS}>
            <Label htmlFor="edit-tags">Tags (kommagetrennt)</Label>
            <Input id="edit-tags" name="tags" defaultValue={tags.join(", ")} />
          </div>

          <div className={FIELD_CLASS}>
            <Label htmlFor="edit-aliases">Aliase (kommagetrennt)</Label>
            <Input id="edit-aliases" name="aliases" defaultValue={aliases.join(", ")} />
          </div>

          <div>
            <Button type="submit">Seite speichern</Button>
          </div>
        </form>

        <CollapsibleSection
          title="ContentBlocks"
          summary={`${page.contentBlocks.length} Blöcke`}
          defaultOpen={page.contentBlocks.length <= 3}
        >
          {page.contentBlocks.map((block) => (
            <Card key={block.id} className="mb-6">
              <CardContent className="flex flex-col gap-4 pt-6">
                <form action={updateContentBlockAction} className="flex flex-col gap-4">
                  <input type="hidden" name="blockId" value={block.id} />
                  <input type="hidden" name="worldSlug" value={worldSlug} />
                  <input type="hidden" name="pageSlug" value={slug} />
                  <input type="hidden" name="category" value={category} />
                  <input type="hidden" name="sortOrder" value={block.sortOrder} />

                  {/* TODO(design-kit): ContentBlockBody (apps/studio/components/**) bleibt
                      unmigriert und rendert eigene <label>/<select> ohne Kit-Styling — außerhalb
                      dieses Auftrags (S4). */}
                  <ContentBlockBody
                    worldSlug={worldSlug}
                    typeOptions={blockTypeOptions}
                    imageAssets={imageAssets}
                    defaultType={block.type}
                    defaultContent={block.content}
                    defaultAssetId={block.assetId}
                    rows={6}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" variant="secondary">Block speichern</Button>
                    <Link
                      className={buttonVariants({ variant: "ghost" })}
                      href={`/worlds/${worldSlug}/labels/new?sourceRef=content_block:${block.id}`}
                    >
                      Aus Block Label erstellen
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>
          ))}

          {page.contentBlocks.map((block) => (
            <form key={`del-${block.id}`} action={deleteContentBlockAction} className="mb-3">
              <input type="hidden" name="blockId" value={block.id} />
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="pageSlug" value={slug} />
              <input type="hidden" name="category" value={category} />
              <Button type="submit" variant="destructive">
                Block „{BLOCK_TYPE_LABELS[block.type]}“ löschen
              </Button>
            </form>
          ))}

          <form action={createContentBlockAction} className="flex flex-col gap-4">
            <input type="hidden" name="pageId" value={page.id} />
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="pageSlug" value={slug} />
            <input type="hidden" name="category" value={category} />

            <h3 className="m-0 text-sm font-semibold">Neuer Block</h3>

            <ContentBlockBody
              worldSlug={worldSlug}
              typeOptions={blockTypeOptions}
              imageAssets={imageAssets}
              defaultType="rich_text"
              rows={4}
            />

            <div>
              <Button type="submit">Block hinzufügen</Button>
            </div>
          </form>
        </CollapsibleSection>

        <PageLinksPanel
          worldSlug={worldSlug}
          pageId={page.id}
          pageSlug={slug}
          category={category}
        />

        <PageChroniclePanel
          worldSlug={worldSlug}
          pageId={page.id}
          pageSlug={slug}
          category={category}
        />

        {page.type === PageTypeEnum.faction && (
          <>
            <FactionStateEditPanel
              worldSlug={worldSlug}
              pageId={page.id}
              pageSlug={slug}
              category={category}
            />
            <FactionSimulatorSection
              worldSlug={worldSlug}
              pageSlug={slug}
              pageTitle={page.title}
              pageId={page.id}
              pageType={page.type}
              worldId={world.id}
              rtxReady={generatorPanel?.rtxReady ?? false}
              rtxEnabled={generatorPanel?.rtxEnabled ?? false}
            />
          </>
        )}

        {page.type === PageTypeEnum.quest && (
          <QuestStatusEditPanel
            worldSlug={worldSlug}
            pageId={page.id}
            pageSlug={slug}
            category={category}
          />
        )}

        {page.type === PageTypeEnum.player_character && (
          <CharacterSheetEditPanel
            worldSlug={worldSlug}
            pageId={page.id}
            pageSlug={slug}
            category={category}
          />
        )}

        {page.type === PageTypeEnum.item && (
          <ItemBuilderSection
            worldSlug={worldSlug}
            pageId={page.id}
            pageSlug={slug}
            category={category}
            pageTitle={page.title}
            pageSummary={page.summary}
          />
        )}

        <CollapsibleSection
          title="Erweiterte Werkzeuge (KI & Statblock)"
          summary="KI-Generator · Statblock Studio · Kontext-Generator"
          defaultOpen={false}
        >
          {page.type === PageTypeEnum.quest ? (
            <QuestBuilderSection
              worldSlug={worldSlug}
              pageSlug={slug}
              pageTitle={page.title}
              pageType={page.type}
              pageId={page.id}
              worldId={world.id}
              rtxReady={generatorPanel?.rtxReady ?? false}
              rtxEnabled={generatorPanel?.rtxEnabled ?? false}
            />
          ) : page.type === PageTypeEnum.item ? (
            <MagicItemBuilderSection
              worldSlug={worldSlug}
              pageSlug={slug}
              pageTitle={page.title}
              pageType={page.type}
              pageId={page.id}
              worldId={world.id}
              rtxReady={generatorPanel?.rtxReady ?? false}
              rtxEnabled={generatorPanel?.rtxEnabled ?? false}
            />
          ) : (
            <StructuredGeneratorSection
              worldSlug={worldSlug}
              pageSlug={slug}
              pageTitle={page.title}
              pageType={page.type}
              pageId={page.id}
              worldId={world.id}
              rtxReady={generatorPanel?.rtxReady ?? false}
              rtxEnabled={generatorPanel?.rtxEnabled ?? false}
            />
          )}

          <StatblockStudioSection
            worldSlug={worldSlug}
            pageId={page.id}
            pageSlug={slug}
            category={category}
            pageType={page.type}
          />

          {generatorPanel && (
            <ContextualGeneratorPanel
              worldSlug={worldSlug}
              pageSlug={slug}
              pageTitle={page.title}
              actions={
                page.type === PageTypeEnum.faction
                  ? generatorPanel.actions.filter((action) => action.id !== "simulate_faction")
                  : generatorPanel.actions
              }
              missingHints={generatorPanel.missingHints}
              rtxReady={generatorPanel.rtxReady}
              rtxEnabled={generatorPanel.rtxEnabled}
            />
          )}
        </CollapsibleSection>

        <EditPageStickyBar
          previewHref={pagePreviewHref(worldSlug, page.type, slug)}
          formId="world-page-edit-form"
        />
      </div>
    </>
  );
}
