/**
 * Gemeinsames Select für Seiten, die anschließend durch `filterPagesForViewer`
 * laufen (Portal, Timeline, Suche, Export).
 *
 * `portalReleased` gehört zwingend dazu: der Filter ist fail-closed und wirft
 * ohne das Feld jede Seite heraus. Diese Konstante nimmt die Entscheidung den
 * einzelnen Services ab — wer für Viewer lädt, lädt hierüber und kann das Feld
 * nicht vergessen.
 */
export const PORTAL_PAGE_SELECT = {
  id: true,
  title: true,
  slug: true,
  type: true,
  portalReleased: true,
} as const;
