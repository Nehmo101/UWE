import type { ReactNode } from "react";
import { RailButton } from "../components/RailButton";
import { STUDIO_RAIL_ICON_MAP } from "./studio-rail-icons";

export interface StudioRailItem {
  id: string;
  href: string;
  label: string;
  icon: ReactNode;
}

export const STUDIO_RAIL_ITEMS: StudioRailItem[] = [
  { id: "today", href: "/today", label: "Heute", icon: STUDIO_RAIL_ICON_MAP.today },
  { id: "capture", href: "/capture", label: "Capture", icon: STUDIO_RAIL_ICON_MAP.capture },
  { id: "search", href: "/search", label: "Suche", icon: STUDIO_RAIL_ICON_MAP.search },
  {
    id: "image-studio",
    href: "/image-studio",
    label: "Image Studio",
    icon: STUDIO_RAIL_ICON_MAP["image-studio"],
  },
  { id: "ai", href: "/ai", label: "KI", icon: STUDIO_RAIL_ICON_MAP.ai },
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
