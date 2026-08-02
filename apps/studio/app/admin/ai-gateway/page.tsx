import { STUDIO_SESSION_ENTRY_PATH } from "@uwe/auth";
import { AiGatewayWizard } from "@/components/AiGatewayWizard";
import type { GatewayDashboard } from "@/components/ai-gateway/types";
import { requireOwner } from "@/src/lib/auth";
import { loadAiGatewayDashboard } from "@/src/lib/ai-gateway-handlers";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";

export default async function AiGatewayAdminPage() {
  await requireOwner();

  // Render the dashboard from the session that already authenticated this page,
  // so the wizard never has to prove who it is just to show its first paint.
  const initialData: GatewayDashboard = await loadAiGatewayDashboard();

  return (
    <>
      <ShellBreadcrumb
        items={[
          { label: "Dashboard", href: STUDIO_SESSION_ENTRY_PATH },
          { label: "KI & RTX Fallback" },
        ]}
      />
      <PageHeader
        title="KI & RTX Fallback"
        summary="Master-Admin-Wizard: RTX bevorzugen, Cloud-Fallback optional, Privacy-Regeln, Budgets und User-Freigaben."
      />
      <AiGatewayWizard initialData={initialData} />
    </>
  );
}
