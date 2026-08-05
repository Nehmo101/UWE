import { STUDIO_SESSION_ENTRY_PATH } from "@uwe/auth";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Wurzel-Segment jeder Welt-Spur.
 *
 * Das Ziel war immer die Weltenliste (`STUDIO_SESSION_ENTRY_PATH` = `/worlds`),
 * die Beschriftung sagte aber „Dashboard" — und führte damit an genau der
 * Stelle in die Irre, an der man aus einer Welt herausfindet.
 */
export function studioDashboardBreadcrumb(): BreadcrumbItem {
  return { label: "Welten", href: STUDIO_SESSION_ENTRY_PATH };
}

/** Breadcrumb der Weltenliste selbst — ohne Selbstverweis. */
export function worldsRootBreadcrumb(): BreadcrumbItem[] {
  return [{ label: "Welten" }];
}

/** Breadcrumb: Welten > {worldName} */
export function worldRootBreadcrumb(
  worldName: string,
  worldSlug: string,
): BreadcrumbItem[] {
  return [
    studioDashboardBreadcrumb(),
    { label: worldName, href: `/worlds/${worldSlug}/dashboard` },
  ];
}

/** Breadcrumb: Welten > {world} > {section} */
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

/** Breadcrumb: Welten > {world} > {section} > {detail} */
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

/** Breadcrumb for wiki pages: Welten > {world} > {category} > {title} */
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

/** Breadcrumb for the campaign cockpit hierarchy (Kampagne → Kapitel). */
export function campaignCockpitBreadcrumb(
  worldName: string,
  worldSlug: string,
  segments: BreadcrumbItem[],
): BreadcrumbItem[] {
  return [
    ...worldSectionBreadcrumb(worldName, worldSlug, "Kampagnen", `/worlds/${worldSlug}/kampagnen`),
    ...segments,
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
