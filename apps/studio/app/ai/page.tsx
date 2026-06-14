import {
  AppShell,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import { adminSidebarNav } from "@/src/lib/admin-sidebar-nav";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";
import { MobileAiPromptPanel } from "@/components/MobileAiPromptPanel";

export default function AiPage() {
  const useMock = process.env.AI_USE_MOCK === "true";

  return (
    <AppShell
      bottomNav={studioGlobalBottomNav("ai")}
      contextTitle="KI"
      topBar={<TopBarBrand appName="UWE Studio" subtitle="KI" href="/today" />}
      sidebar={
        <SidebarSection title="UWE Admin">
          <SidebarNav items={adminSidebarNav("/admin/ai-prompt")} />
        </SidebarSection>
      }
      main={
        <>
          <PageHeader
            title="KI"
            summary="Allgemeiner Chat ohne lokalen Brain-/Objekt-Kontext. DnD-Kontext nur in Welten verfügbar."
          />
          <MobileAiPromptPanel useMock={useMock} pollIntervalMs={30_000} />
        </>
      }
    />
  );
}
