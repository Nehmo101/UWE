"use client";

import Link from "next/link";
import { Collapsible, SidebarNav, SidebarSection } from "@uwe/shared-ui";

const SETTINGS_GROUPS: {
  title: string;
  tabs: { id: string; label: string }[];
}[] = [
  {
    title: "Allgemein",
    tabs: [
      { id: "general", label: "General" },
      { id: "appearance", label: "Erscheinungsbild" },
      { id: "worlds", label: "Worlds" },
      { id: "portal", label: "Portal" },
      { id: "privacy", label: "Privacy" },
    ],
  },
  {
    title: "System",
    tabs: [
      { id: "storage", label: "Storage" },
      { id: "backup", label: "Backup" },
      { id: "status", label: "Systemstatus" },
      { id: "ai", label: "AI" },
    ],
  },
  {
    title: "Integrationen",
    tabs: [
      { id: "integrations", label: "Integrationen" },
      { id: "image-studio", label: "Image Studio" },
      { id: "mail", label: "Mail" },
    ],
  },
];

export function SettingsPageSidebar({ activeTab }: { activeTab: string }) {
  return (
    <>
      <SidebarSection title="Navigation">
        <SidebarNav
          items={[
            { label: "← Dashboard", href: "/studio" },
            { label: "Admin", href: "/admin" },
            { label: "Einstellungen", href: "/settings", active: true },
          ]}
        />
      </SidebarSection>

      {SETTINGS_GROUPS.map((group) => (
        <Collapsible
          key={group.title}
          variant="sidebar"
          title={group.title}
          defaultOpen={
            group.tabs.some((tab) => tab.id === activeTab) ||
            group.title === "Allgemein"
          }
        >
          <SidebarNav
            items={group.tabs.map((tab) => ({
              label: tab.label,
              href: `/settings?tab=${tab.id}`,
              active: activeTab === tab.id,
            }))}
          />
        </Collapsible>
      ))}

      <p className="uwe-hint" style={{ marginTop: "1rem" }}>
        Odysseus-inspiriert: Theme, Dichte und Hintergrund unter{" "}
        <Link href="/settings?tab=appearance">Erscheinungsbild</Link>.
      </p>
    </>
  );
}
