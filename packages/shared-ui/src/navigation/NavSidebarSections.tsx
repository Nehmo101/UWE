import type { ReactNode } from "react";
import { SidebarNav, SidebarSection } from "../AppShell";

export interface NavSection {
  title: string;
  items: { label: string; href: string; active?: boolean; badge?: string }[];
}

/** Renders grouped sidebar navigation sections. */
export function NavSidebarSections({
  sections,
  footer,
}: {
  sections: NavSection[];
  footer?: ReactNode;
}) {
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
