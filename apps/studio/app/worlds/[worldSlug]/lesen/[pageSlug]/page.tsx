import Link from "next/link";
import { notFound } from "next/navigation";

import { buildPageUrl, getAppRepository, type PageType } from "@uwe/database/server";

import { BreadcrumbTrail, PageHeader, WorldShell } from "@/src/components/shell";
import { Card, CardContent } from "@/src/components/ui";
import { buildVolumeReaderView } from "@/src/lib/volume-reader";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string; pageSlug: string }>;
}

export const dynamic = "force-dynamic";

/** ~1 300 Zeichen pro Minute — grob, aber es beantwortet „schaffe ich das heute Abend". */
const CHARACTERS_PER_MINUTE = 1_300;

/** Überschriftengröße nach Tiefe: die Wurzel ist der Seitentitel, darunter h2…h4. */
const HEADING_CLASS = [
  "text-2xl font-semibold",
  "text-xl font-semibold",
  "text-lg font-semibold",
  "text-base font-semibold",
];

/**
 * Ein Band am Stück.
 *
 * Nach dem Import steht das Kampagnenbuch als Seitenbaum im Wiki — richtig zum
 * Nachschlagen, unbrauchbar zum Vorbereiten. Diese Ansicht setzt denselben Baum
 * wieder zu einem fortlaufenden Text zusammen, mit Inhaltsverzeichnis und
 * Sprungmarken, und verlinkt jeden Abschnitt auf seine Wiki-Seite: lesen hier,
 * bearbeiten dort.
 */
export default async function StudioVolumeReaderPage({ params }: Props) {
  const { worldSlug, pageSlug } = await params;
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();

  const view = await buildVolumeReaderView(worldSlug, pageSlug);
  if (!view) notFound();

  const { volume, toc, sourcePages } = view;
  const minutes = Math.max(1, Math.round(volume.characters / CHARACTERS_PER_MINUTE));

  return (
    <WorldShell
      worldSlug={worldSlug}
      worldName={world.name}
      breadcrumb={
        <BreadcrumbTrail
          items={[
            ...worldSectionBreadcrumb(world.name, worldSlug, "Lesen", `/worlds/${worldSlug}/lesen`),
            { label: volume.root.title },
          ]}
        />
      }
      contextPanel={
        <nav aria-label="Inhalt" className="flex flex-col gap-1 text-sm">
          <span className="mb-1 font-semibold">Inhalt</span>
          {toc.map((entry) => (
            <a
              key={entry.anchor}
              href={`#${entry.anchor}`}
              className="truncate text-muted-foreground hover:text-foreground"
              style={{ paddingInlineStart: `${(entry.depth - 1) * 0.75}rem` }}
            >
              {entry.title}
            </a>
          ))}
        </nav>
      }
    >
      <PageHeader
        title={volume.root.title}
        summary={`${volume.sections.length} Abschnitte · ${volume.filled} mit Text · etwa ${minutes} Minuten Lesezeit`}
        actions={
          <Link
            className="text-sm underline"
            href={buildPageUrl(worldSlug, volume.root.type as PageType, volume.root.slug)}
          >
            Im Wiki bearbeiten
          </Link>
        }
      />

      <article className="flex flex-col gap-8">
        {volume.sections.map((section, index) => (
          <section key={section.id} id={section.anchor} className="scroll-mt-24">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className={HEADING_CLASS[Math.min(section.depth, HEADING_CLASS.length - 1)]}>
                {section.title}
              </h2>
              <Link
                href={buildPageUrl(worldSlug, section.type as PageType, section.slug)}
                className="text-xs text-muted-foreground underline"
              >
                Wiki-Seite
              </Link>
            </div>

            {section.empty ? (
              <p className="mt-2 text-sm italic text-muted-foreground">
                Dieser Abschnitt gliedert nur — der Text steht in den Abschnitten darunter.
              </p>
            ) : (
              <div
                className="wiki-content uwe-v2-wiki-content mt-2"
                // Der Inhalt kommt aus `renderPageContentHtml` und damit durch
                // `sanitizeWikiHtml` — derselbe Weg wie in jeder Wiki-Ansicht.
                dangerouslySetInnerHTML={{ __html: section.html }}
              />
            )}

            {index < volume.sections.length - 1 ? (
              <hr className="mt-8 border-border" aria-hidden />
            ) : null}
          </section>
        ))}
      </article>

      {sourcePages.length > 0 ? (
        <Card className="mt-8">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            <p>
              Die unveränderte Originaldatei liegt daneben — nichts von dem, was der Import nicht
              zuordnen konnte, ist verloren.
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {sourcePages.map((page) => (
                <li key={page.slug}>
                  <Link
                    href={buildPageUrl(worldSlug, page.type as PageType, page.slug)}
                    className="underline"
                  >
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </WorldShell>
  );
}
