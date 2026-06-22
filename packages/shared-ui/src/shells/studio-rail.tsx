import { RailButton } from "../components/RailButton";

export interface StudioRailItem {
  id: string;
  href: string;
  label: string;
  icon: string;
}

export const STUDIO_RAIL_ITEMS: StudioRailItem[] = [
  { id: "today", href: "/today", label: "Heute", icon: "☀" },
  { id: "capture", href: "/capture", label: "Capture", icon: "+" },
  { id: "search", href: "/search", label: "Suche", icon: "🔍" },
  { id: "image-studio", href: "/image-studio", label: "Image Studio", icon: "🖼" },
  { id: "ai", href: "/ai", label: "KI", icon: "✦" },
];

export function StudioIconRail({
  activeId,
  items = STUDIO_RAIL_ITEMS,
}: {
  activeId?: string;
  items?: StudioRailItem[];
}) {
  return (
    <nav className="uwe-icon-rail" aria-label="Schnellzugriff">
      {items.map((item) => (
        <RailButton
          key={item.id}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={activeId === item.id}
        />
      ))}
    </nav>
  );
}
