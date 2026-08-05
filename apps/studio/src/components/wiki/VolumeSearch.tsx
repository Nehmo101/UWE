import Link from "next/link";

import { GlobalSearchForm } from "@uwe/shared-ui";
import type { SearchSnippet, SectionHit } from "@uwe/session-runner";

import { Badge } from "@/src/components/ui";

/**
 * Suche im Lesebereich — Formular und Trefferliste.
 *
 * Beides teilen sich die Bandübersicht („in welchem Buch steht das?") und der
 * Band selbst („wo im Buch?"). Der Unterschied ist nur das Ziel eines Treffers,
 * deshalb kommt es als `hrefFor` herein.
 *
 * Beides sind Server-Komponenten: gesucht wird über `?q=` im GET-Formular.
 * Damit funktioniert die Suche ohne JavaScript, bleibt verlinkbar, und der
 * Bandtext muss nicht zusätzlich als Suchindex in den Browser wandern.
 */

export function VolumeSearchForm({
  action,
  query,
  placeholder,
  label,
}: {
  action: string;
  query: string;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="mb-6">
      <GlobalSearchForm action={action} query={query} placeholder={placeholder} label={label} />
    </div>
  );
}

/** Ein Ausschnitt mit hervorgehobenem Treffer. */
function Snippet({ snippet }: { snippet: SearchSnippet }) {
  return (
    <p className="text-sm leading-relaxed text-muted-foreground">
      {snippet.before}
      <mark className="uwe-treffer">{snippet.match}</mark>
      {snippet.after}
    </p>
  );
}

/** „3 Treffer" / „1 Treffer" — im Deutschen darf das nicht durchrutschen. */
export function matchLabel(matches: number): string {
  return matches === 1 ? "1 Treffer" : `${matches} Treffer`;
}

export function VolumeSearchHits({
  hits,
  hrefFor,
}: {
  hits: SectionHit[];
  /** Wohin ein Treffer springt. */
  hrefFor: (hit: SectionHit) => string;
}) {
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {hits.map((hit) => (
        <li key={hit.id}>
          <Link href={hrefFor(hit)} className="text-sm font-semibold hover:underline">
            {hit.title}
          </Link>
          <span className="ml-2 text-xs text-muted-foreground">
            {hit.matches > 0 ? matchLabel(hit.matches) : null}
            {/* Ein Titeltreffer ohne Textreffer wäre sonst ein Eintrag ohne
                erkennbaren Grund — der Abschnitt heißt so, im Text steht es nicht. */}
            {hit.titleMatch ? <Badge className="ml-2 align-middle">im Titel</Badge> : null}
          </span>
          {hit.snippets.map((snippet, index) => (
            <Snippet key={index} snippet={snippet} />
          ))}
        </li>
      ))}
    </ol>
  );
}
