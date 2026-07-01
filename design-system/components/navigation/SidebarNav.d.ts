import * as React from "react";

export interface SidebarNavItem {
  label: React.ReactNode;
  href?: string;
  /** Optional leading icon (Lucide glyph). */
  icon?: React.ReactNode;
  active?: boolean;
  /** Optional count/pill on the right. */
  badge?: React.ReactNode;
}

export interface SidebarNavSection {
  title?: React.ReactNode;
  items: SidebarNavItem[];
}

export interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  sections: SidebarNavSection[];
}

/** Dark-ink sidebar nav (Parchment OS). Active item = terracotta left-border. */
export function SidebarNav(props: SidebarNavProps): React.JSX.Element;
