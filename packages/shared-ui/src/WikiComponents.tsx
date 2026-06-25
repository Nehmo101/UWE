import type { ReactNode } from "react";
import { VisibilityBadge } from "./StatusBadges";

export type PageCategory = "lore" | "locations" | "npcs" | "dungeons";
export type PageVisibility = "dm_only" | "player_visible" | "public";

export const CATEGORY_LABELS: Record<PageCategory, string> = {
  lore: "Lore",
  locations: "Orte",
  npcs: "NPCs",
  dungeons: "Dungeons",
};

export interface WikiNavItem {
  title: string;
  href: string;
  category: PageCategory;
  visibility?: PageVisibility;
}

export interface WikiSidebarProps {
  backlinks: { title: string; href: string }[];
  relatedPages: { title: string; href: string; reasons: string[] }[];
  brokenLinks?: { target: string; label?: string; sourceTitle: string; sourceHref: string }[];
}

export function WikiSidebar({
  backlinks,
  relatedPages,
  brokenLinks,
}: WikiSidebarProps) {
  return (
    <aside className="wiki-sidebar">
      <SidebarSection title="Backlinks" emptyText="Keine Backlinks">
        {backlinks.map((link) => (
          <li key={link.href}>
            <a href={link.href}>{link.title}</a>
          </li>
        ))}
      </SidebarSection>

      <SidebarSection title="Verwandte Seiten" emptyText="Keine verwandten Seiten">
        {relatedPages.map((item) => (
          <li key={item.href}>
            <a href={item.href}>{item.title}</a>
            <span className="wiki-meta">{item.reasons.join(", ")}</span>
          </li>
        ))}
      </SidebarSection>

      {brokenLinks && brokenLinks.length > 0 && (
        <SidebarSection title="Broken Links" emptyText="">
          {brokenLinks.map((link, i) => (
            <li key={`${link.sourceHref}-${link.target}-${i}`}>
              <span className="wiki-link-broken">
                {link.label ?? link.target}
              </span>
              <span className="wiki-meta">
                in{" "}
                <a href={link.sourceHref}>{link.sourceTitle}</a>
              </span>
            </li>
          ))}
        </SidebarSection>
      )}
    </aside>
  );
}

function SidebarSection({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.some(Boolean) && items.length > 0;

  return (
    <section className="wiki-sidebar-section">
      <h3>{title}</h3>
      {hasItems ? <ul>{children}</ul> : <p className="wiki-empty">{emptyText}</p>}
    </section>
  );
}

export function WikiContent({ html, readMode = true }: { html: string; readMode?: boolean }) {
  return (
    <div className="uwe-v2-wiki">
      <article
        className={
          readMode
            ? "wiki-content wiki-content-readmode uwe-v2-wiki-content"
            : "wiki-content uwe-v2-wiki-content"
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

export function WikiPageList({ pages }: { pages: WikiNavItem[] }) {
  if (pages.length === 0) {
    return <p className="wiki-empty">Keine Seiten in dieser Welt.</p>;
  }

  const grouped = pages.reduce<Record<PageCategory, WikiNavItem[]>>(
    (acc, page) => {
      acc[page.category] = acc[page.category] ?? [];
      acc[page.category].push(page);
      return acc;
    },
    {} as Record<PageCategory, WikiNavItem[]>,
  );

  return (
    <div className="wiki-page-list">
      {(Object.keys(CATEGORY_LABELS) as PageCategory[]).map((category) => {
        const items = grouped[category];
        if (!items?.length) return null;

        return (
          <section key={category} className="wiki-list-section">
            <h3>{CATEGORY_LABELS[category]}</h3>
            <ul>
              {items.map((page) => (
                <li key={page.href}>
                  <a href={page.href}>{page.title}</a>
                  {page.visibility && <VisibilityBadge visibility={page.visibility} />}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
