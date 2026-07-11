"use client";

import { Collapsible } from "@uwe/shared-ui";
import type { ReactNode } from "react";

interface SettingsCollapsiblePanelProps {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** Odysseus-style settings group within a tab. */
export function SettingsCollapsiblePanel({
  title,
  summary,
  defaultOpen = true,
  children,
}: SettingsCollapsiblePanelProps) {
  return (
    <Collapsible title={title} summary={summary} defaultOpen={defaultOpen} className="rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-sm">
      {children}
    </Collapsible>
  );
}
