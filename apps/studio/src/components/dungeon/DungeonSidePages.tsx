import Link from "next/link";

import { buildPageUrl, type PageType } from "@uwe/database/server";
import { PAGE_TYPE_LABELS } from "@uwe/shared-ui";

import { Card, CardContent, EmptyState } from "@/src/components/ui";

/**
 * Alles am Dungeon, was keine Ebene und kein Raum ist.
 *
 * Ein importiertes Dungeonbuch besteht nicht nur aus Stockwerken: Es hat einen
 * Werteblock-Anhang, Handouts, Begegnungen, Zugänge, ein Kapitel „Für die
 * Spielleitung". Das Cockpit hat davon bisher nichts gezeigt — die Seiten waren
 * angelegt, hingen im Baum und waren am Spieltisch trotzdem unauffindbar.
 *
 * Verlinkt wird in die Wiki-Ansicht, nicht in eine eigene Cockpit-Route: Diese
 * Seiten haben keine Ebenen-/Raum-Struktur, und ein NSC ist im Wiki richtig
 * aufgehoben.
 */
export interface DungeonSidePage {
  id: string;
  title: string;
  slug: string;
  type: PageType;
  summary: string | null;
}

interface Props {
  worldSlug: string;
  pages: DungeonSidePage[];
  title: string;
  emptyHint: string;
}

export function DungeonSidePages({ worldSlug, pages, title, emptyHint }: Props) {
  return (
    <section className="mb-8 flex flex-col gap-3">
      <h2 className="m-0 text-lg font-semibold tracking-tight">{title}</h2>
      {pages.length === 0 ? (
        <EmptyState title={emptyHint} />
      ) : (
        <Card>
          <CardContent className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-3 pt-6">
            {pages.map((page) => (
              <Link
                key={page.id}
                href={buildPageUrl(worldSlug, page.type, page.slug)}
                className="block rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm"
              >
                <strong>{page.title}</strong>
                <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {PAGE_TYPE_LABELS[page.type as keyof typeof PAGE_TYPE_LABELS] ?? page.type}
                </div>
                {page.summary ? (
                  <p className="mt-1.5 text-sm text-muted-foreground">{page.summary}</p>
                ) : null}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
