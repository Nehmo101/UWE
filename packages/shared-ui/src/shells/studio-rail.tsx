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
  { id: "worlds", href: "/worlds", label: "Welten", icon: STUDIO_RAIL_ICON_MAP.worlds },
  { id: "create", href: "/capture", label: "Erstellen", icon: STUDIO_RAIL_ICON_MAP.create },
  { id: "media-ai", href: "/ai", label: "Medien & KI", icon: STUDIO_RAIL_ICON_MAP["media-ai"] },
  { id: "system", href: "/system", label: "System", icon: STUDIO_RAIL_ICON_MAP.system },
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
