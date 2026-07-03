import { STUDIO_SESSION_ENTRY_PATH } from "@uwe/auth";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** Root breadcrumb segment — always links back to DM dashboard. */
export function studioDashboardBreadcrumb(): BreadcrumbItem {
  return { label: "Dashboard", href: STUDIO_SESSION_ENTRY_PATH };
}

/** Breadcrumb: Dashboard > Welten */
export function worldsListBreadcrumb(): BreadcrumbItem[] {
  return [studioDashboardBreadcrumb(), { label: "Welten", href: "/worlds" }];
}

/** Breadcrumb: Dashboard > {worldName} */
export function worldRootBreadcrumb(
  worldName: string,
  worldSlug: string,
): BreadcrumbItem[] {
  return [
    studioDashboardBreadcrumb(),
    { label: worldName, href: `/worlds/${worldSlug}/dashboard` },
  ];
}

/** Breadcrumb: Dashboard > {world} > {section} */
export function worldSectionBreadcrumb(
  worldName: string,
  worldSlug: string,
  section: string,
  sectionHref?: string,
): BreadcrumbItem[] {
  return [
    ...worldRootBreadcrumb(worldName, worldSlug),
    sectionHref ? { label: section, href: sectionHref } : { label: section },
  ];
}

/** Breadcrumb: Dashboard > {world} > {section} > {detail} */
export function worldDetailBreadcrumb(
  worldName: string,
  worldSlug: string,
  section: string,
  sectionHref: string,
  detail: string,
  detailHref?: string,
): BreadcrumbItem[] {
  return [
    ...worldSectionBreadcrumb(worldName, worldSlug, section, sectionHref),
    detailHref ? { label: detail, href: detailHref } : { label: detail },
  ];
}

/** Breadcrumb for wiki pages: Dashboard > {world} > {category} > {title} */
export function wikiPageBreadcrumb(
  worldName: string,
  worldSlug: string,
  categoryLabel: string,
  pageTitle: string,
  pageHref?: string,
): BreadcrumbItem[] {
  return [
    ...worldRootBreadcrumb(worldName, worldSlug),
    { label: categoryLabel },
    pageHref ? { label: pageTitle, href: pageHref } : { label: pageTitle },
  ];
}

/** Breadcrumb for dungeon hierarchy. */
export function dungeonBreadcrumb(
  worldName: string,
  worldSlug: string,
  segments: BreadcrumbItem[],
): BreadcrumbItem[] {
  return [
    ...worldSectionBreadcrumb(worldName, worldSlug, "Dungeons", `/worlds/${worldSlug}/dungeons`),
    ...segments,
  ];
}
