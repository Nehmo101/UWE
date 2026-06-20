import {
  AppShell,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import { resolveAiChatAccess } from "@/src/lib/ai-gateway-access";
import { getCurrentAuthUser } from "@/src/lib/auth";
import { adminSidebarNav } from "@/src/lib/admin-sidebar-nav";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";
import { MobileAiPromptPanel } from "@/components/MobileAiPromptPanel";

export default async function AiPage() {
  const user = await getCurrentAuthUser();
  const access = await resolveAiChatAccess(user);
  const useMock = process.env.AI_USE_MOCK === "true";

  if (!access.allowed) {
    return (
      <AppShell
        bottomNav={studioGlobalBottomNav("ai")}
        contextTitle="KI"
        topBar={<TopBarBrand appName="UWE Studio" subtitle="KI" href="/today" />}
        sidebar={
          <SidebarSection title="UWE Admin">
            <SidebarNav items={adminSidebarNav("/ai")} />
          </SidebarSection>
        }
        main={
          <>
            <PageHeader title="KI" summary={access.message} />
            <p className="uwe-dashboard-muted">
              Master-Admin: Cookbook → KI &amp; RTX Fallback → User-Freigaben →{" "}
              <code>AI_CHAT_USE</code> vergeben.
            </p>
          </>
        }
      />
    );
  }

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
