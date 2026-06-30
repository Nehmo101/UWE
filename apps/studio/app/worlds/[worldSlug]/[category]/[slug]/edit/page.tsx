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
import { ContentBlockContentField } from "../../../../../../components/ContentBlockContentField";
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
import { CampaignSidebar } from "@/src/components/wiki";
import { PageLinksPanel } from "@/components/wiki/PageLinksPanel";
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
            { label: "\u2190 Seitenansicht", href: pageHref, active: true },
            { label: "Seitenliste", href: `/worlds/${worldSlug}` },
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
      <div className="uwe-has-sticky-actions">
        {saved && (
          <p className="uwe-flash-success" style={{ fontSize: "0.875rem" }}>\u00c4nderungen gespeichert.</p>
        )}

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
              \u201ePortal sichtbar\u201c und \u201eShare-Link\u201c sind nach dem
              Ver\u00f6ffentlichen f\u00fcr angemeldete Spieler im Portal sichtbar.
              \u201eNur GM\u201c erscheint dort niemals.
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
            <legend>Geheimnis &amp; Enth\u00fcllung</legend>
            <p className="uwe-field-hint" style={{ marginTop: 0 }}>
              Aktuell:{" "}
              <SecretLevelBadge secretLevel={page.secretLevel} />
              {page.secretLevel !== "none" && (
                <> \u00b7 <RevealStateBadge revealState={page.revealState} /></>
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
                Steuert zus\u00e4tzlichen Schutz f\u00fcr ver\u00f6ffentlichte Spieler-Inhalte.
                \u201eKein Geheimnis\u201c bedeutet: nur Sichtbarkeit und Publish-Status gelten.
              </small>
            </label>

            <label>
              Enth\u00fcllungs-Status
              <select name="revealState" defaultValue={page.revealState}>
                {Object.values(RevealStateEnum).map((state) => (
                  <option key={state} value={state}>
                    {REVEAL_STATE_LABELS[state]}
                  </option>
                ))}
              </select>
              <small className="uwe-field-hint">
                Nur relevant bei gesetztem Geheimnis-Level. Spieler sehen die Seite im Portal
                erst bei \u201eEnth\u00fcllt\u201c \u2014 \u201eVorschau\u201c bleibt wie \u201eVerborgen\u201c f\u00fcr Portal-Zugriff.
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
          summary={`${page.contentBlocks.length} Bl\u00f6cke`}
          defaultOpen={page.contentBlocks.length <= 3}
        >
          {page.contentBlocks.map((block) => (
            <form key={block.id} action={updateContentBlockAction} className="uwe-v2-form" style={{ marginBottom: "1.5rem", padding: "1rem", border: "1px solid rgba(148,163,184,0.12)", borderRadius: "0.65rem" }}>
              <input type="hidden" name="blockId" value={block.id} />
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="pageSlug" value={slug} />
              <input type="hidden" name="category" value={category} />
              <input type="hidden" name="sortOrder" value={block.sortOrder} />

              <label>
                Block-Typ
                <select name="type" defaultValue={block.type}>
                  {Object.values(ContentBlockTypeEnum).map((t) => (
                    <option key={t} value={t}>{BLOCK_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </label>

              <label>
                Sichtbarkeit
                <select name="visibility" defaultValue={block.visibility}>
                  {Object.values(VisibilityEnum).map((v) => (
                    <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
                  ))}
                </select>
              </label>

              <fieldset className="uwe-fieldset">
                <legend>Geheimnis &amp; Enth\u00fcllung</legend>
                <p className="uwe-field-hint" style={{ marginTop: 0 }}>
                  Aktuell: <SecretLevelBadge secretLevel={block.secretLevel} />
                  {block.secretLevel !== "none" && (
                    <> \u00b7 <RevealStateBadge revealState={block.revealState} /></>
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
                  Enth\u00fcllungs-Status
                  <select name="revealState" defaultValue={block.revealState}>
                    {Object.values(RevealStateEnum).map((state) => (
                      <option key={state} value={state}>{REVEAL_STATE_LABELS[state]}</option>
                    ))}
                  </select>
                  <small className="uwe-field-hint">
                    Nur relevant bei gesetztem Geheimnis-Level. Spieler sehen den Block im Portal
                    erst bei \u201eEnth\u00fcllt\u201c \u2014 \u201eVorschau\u201c bleibt wie \u201eVerborgen\u201c f\u00fcr Portal-Zugriff.
                  </small>
                </label>
              </fieldset>

              <ContentBlockContentField
                blockType={block.type}
                defaultValue={block.content}
                rows={6}
              />

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
                Block \u201e{BLOCK_TYPE_LABELS[block.type]}\u201c l\u00f6schen
              </button>
            </form>
          ))}

          <form action={createContentBlockAction} className="uwe-v2-form">
            <input type="hidden" name="pageId" value={page.id} />
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="pageSlug" value={slug} />
            <input type="hidden" name="category" value={category} />

            <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Neuer Block</h3>

            <label>
              Block-Typ
              <select name="type" defaultValue="rich_text">
                {Object.values(ContentBlockTypeEnum).map((t) => (
                  <option key={t} value={t}>{BLOCK_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </label>

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
              Enth\u00fcllungs-Status
              <select name="revealState" defaultValue="hidden">
                {Object.values(RevealStateEnum).map((state) => (
                  <option key={state} value={state}>{REVEAL_STATE_LABELS[state]}</option>
                ))}
              </select>
            </label>

            <ContentBlockContentField blockType="rich_text" rows={4} />

            <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">Block hinzuf\u00fcgen</button>
          </form>
        </CollapsibleSection>

        <PageLinksPanel
          worldSlug={worldSlug}
          pageId={page.id}
          pageSlug={slug}
          category={category}
        />

        {generatorPanel && (
          <ContextualGeneratorPanel
            worldSlug={worldSlug}
            pageSlug={slug}
            pageTitle={page.title}
            actions={generatorPanel.actions}
            missingHints={generatorPanel.missingHints}
            rtxReady={generatorPanel.rtxReady}
            rtxEnabled={generatorPanel.rtxEnabled}
          />
        )}

        <EditPageStickyBar previewHref={pagePreviewHref(worldSlug, page.type, slug)} />
      </div>
    </WorldShell>
  );
}
