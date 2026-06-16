import { AdminModuleShell } from "@/components/AdminModuleShell";
import { AuditLogWorkspace } from "@/components/AuditLogWorkspace";

export default function AuditLogPage() {
  return (
    <AdminModuleShell
      activePath="/admin/audit-log"
      title="Audit Log"
      summary="Sicherheitsrelevante Aktionen — ohne Secrets, mit gehashten IP/User-Agent-Werten."
    >
      <AuditLogWorkspace />
    </AdminModuleShell>
  );
}
