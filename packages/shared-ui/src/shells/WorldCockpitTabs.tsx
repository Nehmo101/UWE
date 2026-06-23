export interface WorldCockpitTabItem {
  key: string;
  label: string;
  href: string;
  active?: boolean;
}

export interface WorldCockpitTabsProps {
  items: WorldCockpitTabItem[];
  ariaLabel?: string;
}

/** Horizontal world cockpit tab strip (mockup overview navigation). */
export function WorldCockpitTabs({
  items,
  ariaLabel = "Welt-Navigation",
}: WorldCockpitTabsProps) {
  return (
    <nav className="uwe-cockpit-tabs" aria-label={ariaLabel}>
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          className={`uwe-cockpit-tab${item.active ? " active" : ""}`}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
