import Link from "next/link";
import { notFound } from "next/navigation";

import { buildPageUrl, getAppRepository, type PageType } from "@uwe/database/server";
import { MIN_QUERY_LENGTH, normalizeQuery } from "@uwe/session-runner";

import { PageHeader, ShellBreadcrumb, ShellContextPanel } from "@/src/components/shell";
import { Card, CardContent } from "@/src/components/ui";
import { VolumeSearchForm, VolumeSearchHits, matchLabel } from "@/src/components/wiki";
import { buildVolumeReaderView } from "@/src/lib/volume-reader";
import { worldSectionBreadcrumb } from "@/src/lib/world-breadcrumbs";

interface Props {
  params: Promise<{ worldSlug: string; pageSlug: string }>;
  searchParams: Promise<{ q?: string }>;
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
 *
 * Mit `?q=` kommt die Suche dazu: eine Trefferliste zum Springen, Markierungen im
 * Text und Trefferzahlen im Inhaltsverzeichnis. Der Band bleibt dabei ganz —
 * gesucht wird beim Vorbereiten, um eine Stelle *im Zusammenhang* zu lesen, nicht
 * um den Rest wegzufiltern.
 */
export default async function StudioVolumeReaderPage({ params, searchParams }: Props) {
  const { worldSlug, pageSlug } = await params;
  const { q } = await searchParams;
  const world = await getAppRepository().getWorldBySlug(worldSlug);
  if (!world) notFound();

  const query = normalizeQuery(q);
  const view = await buildVolumeReaderView(worldSlug, pageSlug, { query });
  if (!view) notFound();

  const { volume, toc, sourcePages, search } = view;
  const minutes = Math.max(1, Math.round(volume.characters / CHARACTERS_PER_MINUTE));
  const base = `/worlds/${worldSlug}/lesen`;

  /** Treffer je Abschnitt — fürs Inhaltsverzeichnis. */
  const matchesByAnchor = new Map(search?.hits.map((hit) => [hit.anchor, hit.matches]) ?? []);

  return (
    <>
      <ShellBreadcrumb
        items={[
          ...worldSectionBreadcrumb(world.name, worldSlug, "Lesen", base),
          { label: volume.root.title },
        ]}
      />
      <ShellContextPanel>
        <nav aria-label="Inhalt" className="flex flex-col gap-1 text-sm">
          <span className="mb-1 font-semibold">Inhalt</span>
          {toc.map((entry) => {
            const matches = matchesByAnchor.get(entry.anchor) ?? 0;
            return (
              <a
                key={entry.anchor}
                href={`#${entry.anchor}`}
                className={
                  matchesByAnchor.has(entry.anchor)
                    ? "flex items-baseline justify-between gap-2 truncate font-medium text-foreground"
                    : "flex items-baseline justify-between gap-2 truncate text-muted-foreground hover:text-foreground"
                }
                style={{ paddingInlineStart: `${(entry.depth - 1) * 0.75}rem` }}
              >
                <span className="truncate">{entry.title}</span>
                {/* Nur bei Textreffern eine Zahl: bei einem reinen Titeltreffer
                    stünde sonst „0" neben einem hervorgehobenen Eintrag. */}
                {matches > 0 ? <span className="shrink-0 text-xs">{matches}</span> : null}
              </a>
            );
          })}
        </nav>
      </ShellContextPanel>
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

      <VolumeSearchForm
        action={`${base}/${pageSlug}`}
        query={q ?? ""}
        placeholder="In diesem Band suchen…"
        label="In diesem Band suchen"
      />

      {search ? (
        <Card className="mb-8">
          <CardContent className="flex flex-col gap-3 pt-6">
            {search.hits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Treffer für „{search.query}“ in diesem Band.{" "}
                <Link href={`${base}?q=${encodeURIComponent(search.query)}`} className="underline">
                  In allen Bänden suchen
                </Link>
                .
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {matchLabel(search.matches)} für „{search.query}“ in{" "}
                  {search.hits.length === 1 ? "einem Abschnitt" : `${search.hits.length} Abschnitten`}
                </p>
                <VolumeSearchHits hits={search.hits} hrefFor={(hit) => `#${hit.anchor}`} />
              </>
            )}
          </CardContent>
        </Card>
      ) : q?.trim() ? (
        <p className="mb-8 text-sm text-muted-foreground">
          Mindestens {MIN_QUERY_LENGTH} Zeichen, sonst trifft die Suche alles.
        </p>
      ) : null}

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
                // Die Suche legt darüber nur `<mark>`-Klammern um Textstellen,
                // ohne sonst ein Zeichen zu ändern.
                dangerouslySetInnerHTML={{
                  __html: search?.htmlById.get(section.id) ?? section.html,
                }}
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
    </>
  );
}
