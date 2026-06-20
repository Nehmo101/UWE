import Link from "next/link";
import {
  AppShell,
  Breadcrumb,
  PageHeader,
  SidebarNav,
  SidebarSection,
  TopBarBrand,
} from "@uwe/shared-ui";
import { AiGatewayWizard } from "@/components/AiGatewayWizard";
import { requireOwner } from "@/src/lib/auth";
import { studioGlobalBottomNav } from "@/src/lib/mobile-nav";

export default async function AiGatewayAdminPage() {
  await requireOwner();

  return (
    <AppShell
      bottomNav={studioGlobalBottomNav("more")}
      topBar={<TopBarBrand appName="UWE Studio" subtitle="KI & RTX Fallback" href="/studio" />}
      sidebar={
        <SidebarSection title="Admin Setup">
          <SidebarNav
            items={[
              { label: "← Dashboard", href: "/studio" },
              { label: "Cookbook", href: "/admin/cookbook" },
              { label: "KI & RTX Fallback", href: "/admin/ai-gateway", active: true },
              { label: "Systemstatus", href: "/admin/status" },
              { label: "Einstellungen", href: "/settings" },
            ]}
          />
        </SidebarSection>
      }
      main={
        <>
          <Breadcrumb
            items={[
              { label: "Dashboard", href: "/studio" },
              { label: "Cookbook", href: "/admin/cookbook" },
              { label: "KI & RTX Fallback" },
            ]}
          />

          <PageHeader
            title="KI & RTX Fallback"
            summary="Master-Admin-Wizard: RTX bevorzugen, Cloud-Fallback optional, Privacy-Regeln, Budgets und User-Freigaben."
            actions={
              <Link href="/admin/cookbook" className="uwe-button-secondary">
                Cookbook
              </Link>
            }
          />

          <AiGatewayWizard />
        </>
      }
    />
  );
}
