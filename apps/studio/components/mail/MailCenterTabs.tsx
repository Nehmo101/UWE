"use client";

import { Tabs } from "@uwe/shared-ui";
import type { ReactNode } from "react";

interface MailCenterTabsProps {
  defaultTab?: string;
  overview: ReactNode;
  inbox: ReactNode;
  drafts: ReactNode;
  setup: ReactNode;
}

export function MailCenterTabs({
  defaultTab = "overview",
  overview,
  inbox,
  drafts,
  setup,
}: MailCenterTabsProps) {
  return (
    <Tabs
      defaultTabId={defaultTab}
      ariaLabel="Mail Center"
      items={[
        { id: "overview", label: "Übersicht", content: overview },
        { id: "inbox", label: "Posteingang", content: inbox },
        { id: "drafts", label: "Entwürfe", content: drafts },
        { id: "setup", label: "Einrichtung", content: setup },
      ]}
    />
  );
}
