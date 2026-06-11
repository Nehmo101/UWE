import type { ReactNode } from "react";

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

export function WikiContent({ html }: { html: string }) {
  return (
    <article
      className="wiki-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
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
                  {page.visibility === "dm_only" && (
                    <span className="wiki-badge wiki-badge-secret">GM</span>
                  )}
                  {page.visibility === "player_visible" && (
                    <span className="wiki-badge wiki-badge-player">Spieler</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function VisibilityBadge({ visibility }: { visibility: PageVisibility }) {
  if (visibility === "dm_only") {
    return <span className="wiki-badge wiki-badge-secret">Nur GM</span>;
  }
  if (visibility === "player_visible") {
    return <span className="wiki-badge wiki-badge-player">Spieler sichtbar</span>;
  }
  return <span className="wiki-badge wiki-badge-public">Öffentlich</span>;
}
