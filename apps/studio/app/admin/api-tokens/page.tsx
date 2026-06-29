import { ApiTokenWorkspace } from "@/components/ApiTokenWorkspace";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";

export default function ApiTokensPage() {
  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Admin", href: "/admin" }, { label: "API Tokens" }]}
        />
      }
    >
      <PageHeader
        title="API Tokens"
        summary="Persönliche API-Tokens mit engen Scopes — nur gehasht gespeichert, Prefix zur Identifikation."
      />
      <ApiTokenWorkspace />
    </SystemShell>
  );
}
