import type { ReactNode } from "react";
import { SidebarNav, SidebarSection } from "../AppShell";
import { CollapsibleNavSidebar } from "./CollapsibleNavSidebar";

export interface NavSection {
  title: string;
  items: { label: string; href: string; active?: boolean; badge?: string }[];
}

/** Renders grouped sidebar navigation sections. */
export function NavSidebarSections({
  sections,
  footer,
  collapsible = true,
  defaultOpenTitles,
}: {
  sections: NavSection[];
  footer?: ReactNode;
  /** Odysseus-style collapsible nav groups (desktop + mobile drawer). */
  collapsible?: boolean;
  defaultOpenTitles?: string[];
}) {
  if (collapsible) {
    return (
      <CollapsibleNavSidebar
        sections={sections}
        footer={footer}
        defaultOpenTitles={defaultOpenTitles}
      />
    );
  }

  return (
    <>
      {sections.map((section) => (
        <SidebarSection key={section.title} title={section.title}>
          <SidebarNav items={section.items} />
        </SidebarSection>
      ))}
      {footer}
    </>
  );
}
