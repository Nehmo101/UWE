"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SidebarNav } from "../AppShell";
import { Collapsible } from "../components/Collapsible";
import type { NavSection } from "./NavSidebarSections";

const STORAGE_KEY = "uwe:sidebar-sections-open-v1";

function readStoredOpen(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeStoredOpen(value: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore quota
  }
}

/** Sidebar with collapsible Odysseus-style nav groups; persists open state locally. */
export function CollapsibleNavSidebar({
  sections,
  footer,
  defaultOpenTitles,
}: {
  sections: NavSection[];
  footer?: React.ReactNode;
  /** Section titles open on first visit (e.g. Dashboard). */
  defaultOpenTitles?: string[];
}) {
  const activeTitle = useMemo(
    () => sections.find((section) => section.items.some((item) => item.active))?.title,
    [sections],
  );

  const computeDefaults = useCallback(() => {
    const stored = readStoredOpen();
    const next: Record<string, boolean> = {};
    for (const section of sections) {
      if (stored[section.title] !== undefined) {
        next[section.title] = stored[section.title]!;
      } else {
        next[section.title] =
          defaultOpenTitles?.includes(section.title) === true ||
          section.title === activeTitle ||
          section.title === "Dashboard";
      }
    }
    return next;
  }, [sections, defaultOpenTitles, activeTitle]);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(computeDefaults);

  useEffect(() => {
    setOpenMap(computeDefaults());
  }, [computeDefaults]);

  function setSectionOpen(title: string, open: boolean) {
    setOpenMap((current) => {
      const next = { ...current, [title]: open };
      writeStoredOpen(next);
      return next;
    });
  }

  return (
    <>
      {sections.map((section) => (
        <Collapsible
          key={section.title}
          variant="sidebar"
          title={section.title}
          open={openMap[section.title] ?? false}
          onOpenChange={(open) => setSectionOpen(section.title, open)}
        >
          <SidebarNav items={section.items} />
        </Collapsible>
      ))}
      {footer}
    </>
  );
}
