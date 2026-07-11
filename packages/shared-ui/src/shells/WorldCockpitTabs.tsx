import { cn } from "../components/cn";

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
    <nav
      className="mt-3 mb-4 flex gap-[0.15rem] overflow-x-auto border-b border-border pb-[0.15rem]"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          className={cn(
            "flex-none whitespace-nowrap rounded-t-[var(--uwe-radius-sm)] px-[0.85rem] py-[0.45rem] text-[0.86rem] text-muted-foreground no-underline transition-colors",
            "border-b-2 border-transparent hover:bg-[color-mix(in_srgb,var(--uwe-accent)_6%,transparent)] hover:text-foreground",
            item.active && "border-b-primary text-foreground",
          )}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
