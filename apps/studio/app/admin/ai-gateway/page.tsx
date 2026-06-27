import Link from "next/link";
import { AiGatewayWizard } from "@/components/AiGatewayWizard";
import { requireOwner } from "@/src/lib/auth";
import { AdminModuleShell } from "@/components/AdminModuleShell";

export default async function AiGatewayAdminPage() {
  await requireOwner();

  return (
    <AdminModuleShell
      activePath="/admin/ai-gateway"
      bottomNav="more"
      title="KI & RTX Fallback"
      summary="Master-Admin-Wizard: RTX bevorzugen, Cloud-Fallback optional, Privacy-Regeln, Budgets und User-Freigaben."
      breadcrumbs={[
        { label: "Dashboard", href: "/studio" },
        { label: "RTX Connector", href: "/system/rtx-connector" },
        { label: "KI & RTX Fallback" },
      ]}
      actions={
        <Link href="/system/rtx-connector" className="uwe-v2-btn uwe-v2-btn-ghost">
          RTX Connector
        </Link>
      }
    >
      <AiGatewayWizard />
    </AdminModuleShell>
  );
}
