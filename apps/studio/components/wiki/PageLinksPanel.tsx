import Link from "next/link";
import { CollapsibleSection } from "@uwe/shared-ui";
import {
  buildPageUrl,
  getAppRepository,
  PAGE_LINK_RELATION_LABELS,
  PAGE_LINK_RELATION_PRESETS,
  pageLinkRelationLabel,
  type PageLinkWithPages,
  type PageType,
} from "@uwe/database/server";
import {
  createPageLinkAction,
  deletePageLinkAction,
  updatePageLinkAction,
} from "@/app/worlds/[worldSlug]/page-link-actions";

interface Props {
  worldSlug: string;
  pageId: string;
  pageSlug: string;
  category: string;
}

function pageHref(
  worldSlug: string,
  page: { type: string; slug: string },
): string {
  return buildPageUrl(worldSlug, page.type as PageType, page.slug);
}

function LinkRow({
  link,
  worldSlug,
  pageId,
  pageSlug,
  category,
  direction,
}: {
  link: PageLinkWithPages;
  worldSlug: string;
  pageId: string;
  pageSlug: string;
  category: string;
  direction: "outgoing" | "incoming";
}) {
  const relatedPage = direction === "outgoing" ? link.targetPage : link.sourcePage;
  const relationText = link.label?.trim() || pageLinkRelationLabel(link.relationType);

  return (
    <li
      style={{
        marginBottom: "1rem",
        padding: "1rem",
        border: "1px solid rgba(148,163,184,0.12)",
        borderRadius: "0.65rem",
      }}
    >
      <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem" }}>
        {direction === "outgoing" ? (
          <>
            <strong>{relationText}</strong>
            {" → "}
            <Link href={pageHref(worldSlug, relatedPage)}>{relatedPage.title}</Link>
          </>
        ) : (
          <>
            <Link href={pageHref(worldSlug, relatedPage)}>{relatedPage.title}</Link>
            {" → "}
            <strong>{relationText}</strong>
          </>
        )}
      </p>

      <form action={updatePageLinkAction} className="uwe-v2-form" style={{ marginBottom: "0.5rem" }}>
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="pageSlug" value={pageSlug} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="linkId" value={link.id} />

        <label>
          Relationstyp
          <select name="relationType" defaultValue={link.relationType}>
            {PAGE_LINK_RELATION_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {PAGE_LINK_RELATION_LABELS[preset]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Beschriftung (optional)
          <input name="label" defaultValue={link.label ?? ""} placeholder="Eigene Formulierung" />
        </label>

        <button type="submit" className="uwe-v2-btn">
          Relation speichern
        </button>
      </form>

      <form action={deletePageLinkAction}>
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="pageSlug" value={pageSlug} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="linkId" value={link.id} />
        <button type="submit" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-danger">
          Verknüpfung löschen
        </button>
      </form>
    </li>
  );
}

export async function PageLinksPanel({ worldSlug, pageId, pageSlug, category }: Props) {
  const repo = getAppRepository();
  const [{ outgoing, incoming }, worldPages] = await Promise.all([
    repo.listPageLinksForPage(pageId),
    repo.listPagesByWorld(worldSlug),
  ]);

  const targetPages = worldPages
    .filter((page) => page.id !== pageId)
    .sort((a, b) => a.title.localeCompare(b.title, "de"));

  const totalLinks = outgoing.length + incoming.length;

  return (
    <CollapsibleSection
      title="Typisierte Verknüpfungen"
      summary={`${totalLinks} Relation${totalLinks === 1 ? "" : "en"}`}
      defaultOpen={totalLinks <= 3}
    >
      <p className="uwe-field-hint" style={{ marginTop: 0 }}>
        Strukturierte Beziehungen zwischen Wiki-Seiten — ergänzen Wikilinks in Fließtext.
      </p>

      <h3 style={{ margin: "1rem 0 0.5rem", fontSize: "0.95rem" }}>Ausgehend</h3>
      {outgoing.length === 0 ? (
        <p className="uwe-field-hint">Keine ausgehenden Verknüpfungen.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {outgoing.map((link) => (
            <LinkRow
              key={link.id}
              link={link}
              worldSlug={worldSlug}
              pageId={pageId}
              pageSlug={pageSlug}
              category={category}
              direction="outgoing"
            />
          ))}
        </ul>
      )}

      <h3 style={{ margin: "1.5rem 0 0.5rem", fontSize: "0.95rem" }}>Eingehend</h3>
      {incoming.length === 0 ? (
        <p className="uwe-field-hint">Keine eingehenden Verknüpfungen.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {incoming.map((link) => (
            <LinkRow
              key={link.id}
              link={link}
              worldSlug={worldSlug}
              pageId={pageId}
              pageSlug={pageSlug}
              category={category}
              direction="incoming"
            />
          ))}
        </ul>
      )}

      <form action={createPageLinkAction} className="uwe-v2-form" style={{ marginTop: "1.5rem" }}>
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="pageSlug" value={pageSlug} />
        <input type="hidden" name="category" value={category} />

        <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Neue Verknüpfung</h3>

        <label>
          Relationstyp
          <select name="relationType" defaultValue="related" required>
            {PAGE_LINK_RELATION_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {PAGE_LINK_RELATION_LABELS[preset]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Zielseite
          <select name="targetPageId" required defaultValue="">
            <option value="" disabled>
              Seite wählen …
            </option>
            {targetPages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          Beschriftung (optional)
          <input name="label" placeholder="Eigene Formulierung" />
        </label>

        <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
          Verknüpfung anlegen
        </button>
      </form>
    </CollapsibleSection>
  );
}
