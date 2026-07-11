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
import { Button, Input, Label } from "@/src/components/ui";

/** TODO(design-kit): natives select bleibt — Server-Action-Formular mit
    unkontrolliertem defaultValue, siehe gleiches Muster in sessions/new/page.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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
    <li className="mb-4 rounded-[var(--radius)] border border-border p-4">
      <p className="mb-3 text-sm">
        {direction === "outgoing" ? (
          <>
            <strong>{relationText}</strong>
            {" → "}
            <Link
              href={pageHref(worldSlug, relatedPage)}
              className="text-primary underline-offset-4 hover:underline"
            >
              {relatedPage.title}
            </Link>
          </>
        ) : (
          <>
            <Link
              href={pageHref(worldSlug, relatedPage)}
              className="text-primary underline-offset-4 hover:underline"
            >
              {relatedPage.title}
            </Link>
            {" → "}
            <strong>{relationText}</strong>
          </>
        )}
      </p>

      <form action={updatePageLinkAction} className="mb-2 flex flex-col gap-3">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="pageSlug" value={pageSlug} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="linkId" value={link.id} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`link-${link.id}-relationType`}>Relationstyp</Label>
          <select
            id={`link-${link.id}-relationType`}
            name="relationType"
            defaultValue={link.relationType}
            className={NATIVE_SELECT_CLASS}
          >
            {PAGE_LINK_RELATION_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {PAGE_LINK_RELATION_LABELS[preset]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`link-${link.id}-label`}>Beschriftung (optional)</Label>
          <Input
            id={`link-${link.id}-label`}
            name="label"
            defaultValue={link.label ?? ""}
            placeholder="Eigene Formulierung"
          />
        </div>

        <Button type="submit" size="sm" className="self-start">
          Relation speichern
        </Button>
      </form>

      <form action={deletePageLinkAction}>
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="pageSlug" value={pageSlug} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="linkId" value={link.id} />
        <Button type="submit" variant="destructive" size="sm">
          Verknüpfung löschen
        </Button>
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
      defaultOpen={false}
    >
      <p className="mt-0 text-sm text-muted-foreground">
        Strukturierte Beziehungen zwischen Wiki-Seiten — ergänzen Wikilinks in Fließtext.
      </p>

      <h3 className="mb-2 mt-4 text-sm font-semibold tracking-tight">Ausgehend</h3>
      {outgoing.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine ausgehenden Verknüpfungen.</p>
      ) : (
        <ul className="m-0 list-none p-0">
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

      <h3 className="mb-2 mt-6 text-sm font-semibold tracking-tight">Eingehend</h3>
      {incoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine eingehenden Verknüpfungen.</p>
      ) : (
        <ul className="m-0 list-none p-0">
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

      <form action={createPageLinkAction} className="mt-6 flex flex-col gap-3">
        <input type="hidden" name="worldSlug" value={worldSlug} />
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="pageSlug" value={pageSlug} />
        <input type="hidden" name="category" value={category} />

        <h3 className="m-0 text-sm font-semibold tracking-tight">Neue Verknüpfung</h3>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-page-link-relationType">Relationstyp</Label>
          <select
            id="new-page-link-relationType"
            name="relationType"
            defaultValue="related"
            required
            className={NATIVE_SELECT_CLASS}
          >
            {PAGE_LINK_RELATION_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {PAGE_LINK_RELATION_LABELS[preset]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-page-link-targetPageId">Zielseite</Label>
          <select
            id="new-page-link-targetPageId"
            name="targetPageId"
            required
            defaultValue=""
            className={NATIVE_SELECT_CLASS}
          >
            <option value="" disabled>
              Seite wählen …
            </option>
            {targetPages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-page-link-label">Beschriftung (optional)</Label>
          <Input id="new-page-link-label" name="label" placeholder="Eigene Formulierung" />
        </div>

        <Button type="submit" className="self-start">
          Verknüpfung anlegen
        </Button>
      </form>
    </CollapsibleSection>
  );
}
