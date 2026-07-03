import Link from "next/link";
import { STUDIO_SESSION_ENTRY_PATH } from "@uwe/auth";
import { AiGatewayWizard } from "@/components/AiGatewayWizard";
import { requireOwner } from "@/src/lib/auth";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";

export default async function AiGatewayAdminPage() {
  await requireOwner();

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Dashboard", href: STUDIO_SESSION_ENTRY_PATH },
            { label: "RTX Connector", href: "/system/rtx-connector" },
            { label: "KI & RTX Fallback" },
          ]}
        />
      }
    >
      <PageHeader
        title="KI & RTX Fallback"
        summary="Master-Admin-Wizard: RTX bevorzugen, Cloud-Fallback optional, Privacy-Regeln, Budgets und User-Freigaben."
        actions={
          <Link href="/system/rtx-connector" className="uwe-v2-btn uwe-v2-btn-ghost">
            RTX Connector
          </Link>
        }
      />
      <AiGatewayWizard />
    </SystemShell>
  );
}
