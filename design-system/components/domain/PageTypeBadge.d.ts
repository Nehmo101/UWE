import * as React from "react";

export type PageType =
  | "lore" | "location" | "region" | "npc" | "faction" | "item"
  | "dungeon" | "room" | "encounter" | "quest" | "session"
  | "handout" | "rule" | "monster" | "map" | "note";

export interface PageTypeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  type?: PageType;
}

export function PageTypeBadge(props: PageTypeBadgeProps): React.JSX.Element;
export const PAGE_TYPE_LABELS: Record<PageType, string>;
