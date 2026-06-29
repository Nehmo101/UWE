import type { ReactNode } from "react";
import type { WorldNavSection } from "./studio-navigation";

/**
 * Shared, behaviour-preserving helpers for the Studio app shells.
 *
 * `StudioAppShell` (Design V2 adapter; pending SettingsShell/SystemShell migration) previously
 * defined these independently, which risked drift. They live here so both shells stay
 * thin renderers over identical navigation logic.
 */

/** Preserve a campaign filter on the „Neue Seite" link within world nav sections. */
export function applyCampaignToWorldSections(
  sections: WorldNavSection[],
  campaignSlug?: string,
): WorldNavSection[] {
  if (!campaignSlug) return sections;
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.key === "new-page" ? { ...item, href: `${item.href}?campaign=${campaignSlug}` } : item,
    ),
  }));
}

/** Default-open sidebar section titles for the world shell (Übersicht, Inhalte, active). */
export function worldDefaultOpenTitles(sections: WorldNavSection[]): string[] {
  const activeTitle = sections.find((section) => section.items.some((item) => item.active))?.title;
  return Array.from(new Set(["Übersicht", "Inhalte", activeTitle].filter(Boolean) as string[]));
}

export interface ShellHeaderBlockProps {
  backHref?: string;
  backLabel?: string;
  breadcrumbs?: { label: string; href?: string }[];
  children: ReactNode;
}

/** Shared back-link + breadcrumb header block rendered by both Studio shells (V1/V2). */
export function ShellHeaderBlock({
  backHref,
  backLabel = "Zurück",
  breadcrumbs,
  children,
}: ShellHeaderBlockProps) {
  return (
    <>
      {backHref ? (
        <a href={backHref} className="uwe-back-link">
          ← {backLabel}
        </a>
      ) : null}
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav className="uwe-breadcrumb" aria-label="Brotkrumen">
          {breadcrumbs.map((item, index) => (
            <span key={`${item.label}-${index}`}>
              {item.href ? <a href={item.href}>{item.label}</a> : item.label}
              {index < breadcrumbs.length - 1 ? (
                <span className="uwe-breadcrumb-sep">/</span>
              ) : null}
            </span>
          ))}
        </nav>
      ) : null}
      {children}
    </>
  );
}
