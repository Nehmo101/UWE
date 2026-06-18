import { AdminModuleShell } from "@/components/AdminModuleShell";
import { UserManagementWorkspace } from "@/components/UserManagementWorkspace";

export default function AdminUsersPage() {
  return (
    <AdminModuleShell
      activePath="/admin/users"
      title="Benutzer"
      summary="Benutzer anlegen, Rollen und Welt-Mitgliedschaften verwalten. Nur hier angelegte aktive Benutzer können sich einloggen."
    >
      <UserManagementWorkspace />
    </AdminModuleShell>
  );
}
