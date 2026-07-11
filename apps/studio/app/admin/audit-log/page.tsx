import Link from "next/link";
import { AuditLogWorkspace } from "@/components/AuditLogWorkspace";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";

export default function AuditLogPage() {
  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Admin", href: "/admin" }, { label: "Audit Log" }]}
        />
      }
    >
      <PageHeader
        title="Audit Log"
        summary="Sicherheitsrelevante Aktionen — ohne Secrets, mit gehashten IP/User-Agent-Werten."
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Tipp: Der{" "}
        <Link href="/admin/activity?source=audit">einheitliche Verlauf</Link> bündelt Audit,
        Aktivität und KI-Nutzung chronologisch.
      </p>
      <AuditLogWorkspace />
    </SystemShell>
  );
}
