"use client";

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/src/components/ui/tabs";

interface MailCenterTabsProps {
  defaultTab?: string;
  overview: ReactNode;
  inbox: ReactNode;
  drafts: ReactNode;
  setup: ReactNode;
}

const TAB_ITEMS = [
  { id: "overview", label: "Übersicht" },
  { id: "inbox", label: "Posteingang" },
  { id: "drafts", label: "Entwürfe" },
  { id: "setup", label: "Einrichtung" },
] as const;

export function MailCenterTabs({
  defaultTab = "overview",
  overview,
  inbox,
  drafts,
  setup,
}: MailCenterTabsProps) {
  const content: Record<string, ReactNode> = { overview, inbox, drafts, setup };
  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList aria-label="Mail Center">
        {TAB_ITEMS.map((item) => (
          <TabsTrigger key={item.id} value={item.id}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {TAB_ITEMS.map((item) => (
        <TabsContent key={item.id} value={item.id}>
          {content[item.id]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
