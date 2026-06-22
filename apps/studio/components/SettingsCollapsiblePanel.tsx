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
    <Collapsible title={title} summary={summary} defaultOpen={defaultOpen} className="uwe-settings-panel">
      {children}
    </Collapsible>
  );
}
