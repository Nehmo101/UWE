import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { UserManagementWorkspace } from "@/components/UserManagementWorkspace";

export default function AdminUsersPage() {
  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Admin", href: "/admin" }, { label: "Benutzer" }]}
        />
      }
    >
      <PageHeader
        title="Benutzer"
        summary="Benutzer anlegen, Rollen und Welt-Mitgliedschaften verwalten. Nur hier angelegte aktive Benutzer können sich einloggen."
      />
      <UserManagementWorkspace />
    </SystemShell>
  );
}
