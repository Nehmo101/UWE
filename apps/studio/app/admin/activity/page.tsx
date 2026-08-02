import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";
import { UnifiedActivityWorkspace } from "@/components/UnifiedActivityWorkspace";

export default function AdminActivityPage() {
  return (
    <>
      <ShellBreadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Verlauf" },
        ]}
      />
      <PageHeader
        title="Einheitlicher Verlauf"
        summary="ActivityLog, AuditLog und KI-Nutzung in einer chronologischen Ansicht."
      />
      <UnifiedActivityWorkspace />
    </>
  );
}
