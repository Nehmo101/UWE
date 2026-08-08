/**
 * Shared projection for page rows that are passed to `filterPagesForViewer`.
 * The release flag is mandatory because the filter deliberately fails closed
 * when a caller forgets to load it.
 */
export const PORTAL_PAGE_SELECT = {
  id: true,
  title: true,
  slug: true,
  type: true,
  portalReleased: true,
} as const;
