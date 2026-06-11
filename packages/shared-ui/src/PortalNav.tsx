import type { NavCategory } from "@uwe/database/page-types";
import { NAV_CATEGORIES, NAV_CATEGORY_LABELS } from "@uwe/database/page-types";

export interface PortalNavItem {
  title: string;
  href: string;
  navCategory: NavCategory;
}

export function PortalNavByType({
  worldSlug,
  items,
  activeCategory,
}: {
  worldSlug: string;
  items: PortalNavItem[];
  activeCategory?: NavCategory;
}) {
  const grouped = NAV_CATEGORIES.reduce<Record<NavCategory, PortalNavItem[]>>(
    (acc, category) => {
      acc[category] = items.filter((item) => item.navCategory === category);
      return acc;
    },
    {} as Record<NavCategory, PortalNavItem[]>,
  );

  return (
    <div className="uwe-portal-nav">
      {NAV_CATEGORIES.map((category) => {
        const categoryItems = grouped[category];
        if (categoryItems.length === 0) return null;

        return (
          <section key={category} className="uwe-portal-nav-section">
            <h3>
              <a
                href={`/worlds/${worldSlug}?type=${category}`}
                className={activeCategory === category ? "active" : undefined}
              >
                {NAV_CATEGORY_LABELS[category]}
              </a>
            </h3>
            <ul>
              {categoryItems.slice(0, 8).map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.title}</a>
                </li>
              ))}
              {categoryItems.length > 8 && (
                <li className="uwe-more-link">
                  <a href={`/worlds/${worldSlug}?type=${category}`}>
                    +{categoryItems.length - 8} weitere
                  </a>
                </li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function PortalWorldHero({
  name,
  description,
  pageCount,
}: {
  name: string;
  description?: string | null;
  pageCount: number;
}) {
  return (
    <section className="uwe-portal-hero">
      <div className="uwe-portal-hero-glow" aria-hidden />
      <p className="uwe-portal-hero-kicker">Spieler-Portal</p>
      <h1>{name}</h1>
      {description && <p className="uwe-portal-hero-desc">{description}</p>}
      <p className="uwe-portal-hero-meta">{pageCount} veröffentlichte Seiten</p>
    </section>
  );
}
