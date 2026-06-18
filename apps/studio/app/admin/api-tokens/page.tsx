import { AdminModuleShell } from "@/components/AdminModuleShell";
import { ApiTokenWorkspace } from "@/components/ApiTokenWorkspace";

export default function ApiTokensPage() {
  return (
    <AdminModuleShell
      activePath="/admin/api-tokens"
      title="API Tokens"
      summary="Persönliche API-Tokens mit engen Scopes — nur gehasht gespeichert, Prefix zur Identifikation."
    >
      <ApiTokenWorkspace />
    </AdminModuleShell>
  );
}
