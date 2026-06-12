import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AppShell,
  Breadcrumb,
  CollapsibleSection,
  PAGE_TYPE_LABELS,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
  VISIBILITY_LABELS,
  PUBLISH_LABELS,
  CANONICAL_LABELS,
  BLOCK_TYPE_LABELS,
} from "@uwe/shared-ui";
import { EditPageStickyBar } from "../../../../../../components/EditPageStickyBar";
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
} from "@uwe/database/server";
import {
  updatePageAction,
  updateContentBlockAction,
  createContentBlockAction,
  deleteContentBlockAction,
  pagePreviewHref,
} from "../../../../../actions";

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

  return (
    <AppShell
      topBar={
        <>
          <TopBarBrand appName="UWE Studio" subtitle="Seite bearbeiten" href="/" />
          <Link className="uwe-btn uwe-btn-ghost" href={pagePreviewHref(worldSlug, page.type, slug)}>
            Vorschau als Spieler
          </Link>
        </>
      }
      sidebar={
        <SidebarSection title="Navigation">
          <SidebarNav
            items={[
              { label: "← Seitenansicht", href: buildPageUrl(worldSlug, page.type, slug) },
              { label: "Seitenliste", href: `/worlds/${worldSlug}` },
            ]}
          />
        </SidebarSection>
      }
      main={
        <div className="uwe-has-sticky-actions">
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/" },
              { label: world.name, href: `/worlds/${worldSlug}` },
              { label: page.title, href: buildPageUrl(worldSlug, page.type, slug) },
              { label: "Bearbeiten" },
            ]}
          />

          {saved && (
            <p style={{ color: "#86efac", fontSize: "0.875rem" }}>Änderungen gespeichert.</p>
          )}

          <form id="uwe-edit-page-form" action={updatePageAction} className="uwe-form">
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
                „Portal (ohne Login)“ und „Öffentlich (Share-Link)“ sind nach dem
                Veröffentlichen ohne Login über die Player-Routen (/worlds/…) sichtbar.
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

            <label>
              Canonical Status
              <select name="canonicalStatus" defaultValue={page.canonicalStatus}>
                {Object.values(CanonicalStatusEnum).map((v) => (
                  <option key={v} value={v}>{CANONICAL_LABELS[v]}</option>
                ))}
              </select>
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
              <button type="submit" className="uwe-btn uwe-btn-primary">Seite speichern</button>
            </div>
          </form>

          <CollapsibleSection
            title="ContentBlocks"
            summary={`${page.contentBlocks.length} Blöcke`}
            defaultOpen={page.contentBlocks.length <= 3}
          >
            {page.contentBlocks.map((block) => (
              <form key={block.id} action={updateContentBlockAction} className="uwe-form" style={{ marginBottom: "1.5rem", padding: "1rem", border: "1px solid rgba(148,163,184,0.12)", borderRadius: "0.65rem" }}>
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

                <label>
                  Inhalt
                  <textarea name="content" defaultValue={block.content} rows={6} />
                </label>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  <button type="submit" className="uwe-btn">Block speichern</button>
                  <Link
                    className="uwe-btn uwe-btn-ghost"
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
                <button type="submit" className="uwe-btn uwe-btn-ghost" style={{ color: "#fca5a5" }}>
                  Block „{BLOCK_TYPE_LABELS[block.type]}“ löschen
                </button>
              </form>
            ))}

            <form action={createContentBlockAction} className="uwe-form">
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
                Inhalt
                <textarea name="content" rows={4} placeholder="[[Wikilinks]] werden unterstützt…" />
              </label>

              <button type="submit" className="uwe-btn uwe-btn-primary">Block hinzufügen</button>
            </form>
          </CollapsibleSection>

          <EditPageStickyBar previewHref={pagePreviewHref(worldSlug, page.type, slug)} />
        </div>
      }
    />
  );
}
