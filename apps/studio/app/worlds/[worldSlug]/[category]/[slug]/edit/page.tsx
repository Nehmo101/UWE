import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CollapsibleSection,
  PAGE_TYPE_LABELS,
  VISIBILITY_LABELS,
  PUBLISH_LABELS,
  CANONICAL_LABELS,
  BLOCK_TYPE_LABELS,
  SECRET_LEVEL_LABELS,
  REVEAL_STATE_LABELS,
  SecretLevelBadge,
  RevealStateBadge,
  SecretReveal,
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
  VisibilityEnum,
  PublishStatusEnum,
  CanonicalStatusEnum,
  ContentBlockTypeEnum,
  SecretLevelEnum,
  RevealStateEnum,
} from "@uwe/database/server";
import {
  updatePageAction,
  updateContentBlockAction,
  createContentBlockAction,
  deleteContentBlockAction,
} from "../../../../../actions";
import { pagePreviewHref } from "@/src/lib/page-preview";
import { WorldShell, BreadcrumbTrail, PageHeader } from "@/src/components/shell";
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

interface Props {
  params: Promise<{ worldSlug: string; category: string; slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}

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
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={worldDetailBreadcrumb(
            world.name,
            worldSlug,
            page.title,
            pageHref,
            "Bearbeiten",
          )}
        />
      }
      contextPanel={
        <CampaignSidebar
          items={[
            { label: "← Seitenansicht", href: pageHref, active: true },
            { label: "Seitenliste", href: worldWikiPath(worldSlug) },
          ]}
        />
      }
    >
      <PageHeader
        title={page.title}
        summary="Seite bearbeiten"
        actions={
          <>
            <Link className="uwe-v2-btn uwe-v2-btn-ghost" href={pagePreviewHref(worldSlug, page.type, slug)}>
              Vorschau als Spieler
            </Link>
            <Link className="uwe-v2-btn uwe-v2-btn-ghost" href={`/image-studio?pageId=${page.id}`}>
              Image Studio
            </Link>
          </>
        }
      />
      {page.visibility === "dm_only" && (
        <p className="uwe-form-error uwe-v2-section" role="note">
          <strong>Nur GM (dm_only)</strong> — diese Seite erscheint niemals im Portal oder in Spieler-Exports.
        </p>
      )}
      <div className="uwe-has-sticky-actions">
        {saved && (
          <p className="uwe-flash uwe-flash-success" role="status">Änderungen gespeichert.</p>
        )}
        <PageEditAutosave formId="uwe-edit-page-form" storageKey={`uwe:page-edit:${page.id}`} />

        <form id="uwe-edit-page-form" action={updatePageAction} className="uwe-v2-form">
          <input type="hidden" name="pageId" value={page.id} />
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="pageSlug" value={slug} />

          <label>
            Titel
            <input name="title" defaultValue={page.title} required />
          </label>

          <label>
            Slug
            <input name="slug" defaultValue={page.slug} required />
          </label>

          <label>
            Typ
            <select name="type" defaultValue={page.type}>
              {Object.values(PageTypeEnum).map((type) => (
                <option key={type} value={type}>
                  {PAGE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Zusammenfassung
            <textarea name="summary" defaultValue={page.summary ?? ""} />
          </label>

          <label>
            Sichtbarkeit
            <select name="visibility" defaultValue={page.visibility}>
              {Object.values(VisibilityEnum).map((v) => (
                <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
              ))}
            </select>
            <small className="uwe-field-hint">
              „Portal sichtbar“ und „Share-Link“ sind nach dem
              Veröffentlichen für angemeldete Spieler im Portal sichtbar.
              „Nur GM“ erscheint dort niemals.
            </small>
          </label>

          <label>
            Publish Status
            <select name="publishStatus" defaultValue={page.publishStatus}>
              {Object.values(PublishStatusEnum).map((v) => (
                <option key={v} value={v}>{PUBLISH_LABELS[v]}</option>
              ))}
            </select>
          </label>

          <fieldset className="uwe-fieldset">
            <legend>Geheimnis &amp; Enthüllung</legend>
            <p className="uwe-field-hint" style={{ marginTop: 0 }}>
              Aktuell:{" "}
              <SecretLevelBadge secretLevel={page.secretLevel} />
              {page.secretLevel !== "none" && (
                <> · <RevealStateBadge revealState={page.revealState} /></>
              )}
            </p>

            <label>
              Geheimnis-Level
              <select name="secretLevel" defaultValue={page.secretLevel}>
                {Object.values(SecretLevelEnum).map((level) => (
                  <option key={level} value={level}>
                    {SECRET_LEVEL_LABELS[level]}
                  </option>
                ))}
              </select>
              <small className="uwe-field-hint">
                Steuert zusätzlichen Schutz für veröffentlichte Spieler-Inhalte.
                „Kein Geheimnis“ bedeutet: nur Sichtbarkeit und Publish-Status gelten.
              </small>
            </label>

            <label>
              Enthüllungs-Status
              <select name="revealState" defaultValue={page.revealState}>
                {Object.values(RevealStateEnum).map((state) => (
                  <option key={state} value={state}>
                    {REVEAL_STATE_LABELS[state]}
                  </option>
                ))}
              </select>
              <small className="uwe-field-hint">
                Nur relevant bei gesetztem Geheimnis-Level. Spieler sehen die Seite im Portal
                erst bei „Enthüllt“ — „Vorschau“ bleibt wie „Verborgen“ für Portal-Zugriff.
              </small>
            </label>
          </fieldset>

          <label>
            Kanon-Status
            <select name="canonicalStatus" defaultValue={page.canonicalStatus}>
              {Object.values(CanonicalStatusEnum).map((v) => (
                <option key={v} value={v}>{CANONICAL_LABELS[v]}</option>
              ))}
            </select>
            <small className="uwe-field-hint">
              Steuert den Kanon-Lebenszyklus: von Idee über Vorbereitung bis etabliertem Kanon
              oder verworfenen Inhalten.
            </small>
          </label>

          <label>
            Tags (kommagetrennt)
            <input name="tags" defaultValue={tags.join(", ")} />
          </label>

          <label>
            Aliase (kommagetrennt)
            <input name="aliases" defaultValue={aliases.join(", ")} />
          </label>

          <div className="uwe-form-actions">
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">Seite speichern</button>
          </div>
        </form>

        <CollapsibleSection
          title="ContentBlocks"
          summary={`${page.contentBlocks.length} Blöcke`}
          defaultOpen={page.contentBlocks.length <= 3}
        >
          {page.contentBlocks.map((block) => (
            <form key={block.id} action={updateContentBlockAction} className="uwe-v2-form" style={{ marginBottom: "1.5rem", padding: "1rem", border: "1px solid rgba(148,163,184,0.12)", borderRadius: "0.65rem" }}>
              <input type="hidden" name="blockId" value={block.id} />
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="pageSlug" value={slug} />
              <input type="hidden" name="category" value={category} />
              <input type="hidden" name="sortOrder" value={block.sortOrder} />

              <ContentBlockBody
                worldSlug={worldSlug}
                typeOptions={blockTypeOptions}
                imageAssets={imageAssets}
                defaultType={block.type}
                defaultContent={block.content}
                defaultAssetId={block.assetId}
                rows={6}
              />

              <label>
                Sichtbarkeit
                <select name="visibility" defaultValue={block.visibility}>
                  {Object.values(VisibilityEnum).map((v) => (
                    <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
                  ))}
                </select>
              </label>

              <fieldset className="uwe-fieldset">
                <legend>Geheimnis &amp; Enthüllung</legend>
                <p className="uwe-field-hint" style={{ marginTop: 0 }}>
                  Aktuell: <SecretLevelBadge secretLevel={block.secretLevel} />
                  {block.secretLevel !== "none" && (
                    <> · <RevealStateBadge revealState={block.revealState} /></>
                  )}
                </p>
                <label>
                  Geheimnis-Level
                  <select name="secretLevel" defaultValue={block.secretLevel}>
                    {Object.values(SecretLevelEnum).map((level) => (
                      <option key={level} value={level}>{SECRET_LEVEL_LABELS[level]}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Enthüllungs-Status
                  <select name="revealState" defaultValue={block.revealState}>
                    {Object.values(RevealStateEnum).map((state) => (
                      <option key={state} value={state}>{REVEAL_STATE_LABELS[state]}</option>
                    ))}
                  </select>
                  <small className="uwe-field-hint">
                    Nur relevant bei gesetztem Geheimnis-Level. Spieler sehen den Block im Portal
                    erst bei „Enthüllt“ — „Vorschau“ bleibt wie „Verborgen“ für Portal-Zugriff.
                  </small>
                </label>
              </fieldset>

              {block.secretLevel !== "none" && (
                <div className="uwe-field-hint" style={{ marginTop: "0.5rem" }}>
                  <strong>Spieler-Vorschau:</strong>
                  <SecretReveal
                    content={block.content}
                    secretLevel={block.secretLevel}
                    revealState={block.revealState}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <button type="submit" className="uwe-v2-btn">Block speichern</button>
                <Link
                  className="uwe-v2-btn uwe-v2-btn-ghost"
                  href={`/worlds/${worldSlug}/labels/new?sourceRef=content_block:${block.id}`}
                >
                  Aus Block Label erstellen
                </Link>
              </div>
            </form>
          ))}

          {page.contentBlocks.map((block) => (
            <form key={`del-${block.id}`} action={deleteContentBlockAction} style={{ marginTop: "-1rem", marginBottom: "1.5rem" }}>
              <input type="hidden" name="blockId" value={block.id} />
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="pageSlug" value={slug} />
              <input type="hidden" name="category" value={category} />
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-danger">
                Block „{BLOCK_TYPE_LABELS[block.type]}“ löschen
              </button>
            </form>
          ))}

          <form action={createContentBlockAction} className="uwe-v2-form">
            <input type="hidden" name="pageId" value={page.id} />
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="pageSlug" value={slug} />
            <input type="hidden" name="category" value={category} />

            <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Neuer Block</h3>

            <ContentBlockBody
              worldSlug={worldSlug}
              typeOptions={blockTypeOptions}
              imageAssets={imageAssets}
              defaultType="rich_text"
              rows={4}
            />

            <label>
              Sichtbarkeit
              <select name="visibility" defaultValue="dm_only">
                {Object.values(VisibilityEnum).map((v) => (
                  <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
                ))}
              </select>
            </label>

            <label>
              Geheimnis-Level
              <select name="secretLevel" defaultValue="none">
                {Object.values(SecretLevelEnum).map((level) => (
                  <option key={level} value={level}>{SECRET_LEVEL_LABELS[level]}</option>
                ))}
              </select>
            </label>

            <label>
              Enthüllungs-Status
              <select name="revealState" defaultValue="hidden">
                {Object.values(RevealStateEnum).map((state) => (
                  <option key={state} value={state}>{REVEAL_STATE_LABELS[state]}</option>
                ))}
              </select>
            </label>

            <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">Block hinzufügen</button>
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

        <EditPageStickyBar previewHref={pagePreviewHref(worldSlug, page.type, slug)} />
      </div>
    </WorldShell>
  );
}
