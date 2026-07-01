import { NlCommandWorkspace } from "@/components/NlCommandWorkspace";
import { requireAdminAccess } from "@/src/lib/auth";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";

export default async function CommandCenterPage() {
  await requireAdminAccess();

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Command Center" },
          ]}
        />
      }
    >
      <PageHeader
        title="NL Admin Command Center"
        summary="Whitelist-Befehle mit Intent-Vorschau und Klartext-Bestätigung vor Mutationen — Ausführung über bestehende Services mit Audit-Log."
      />
      <NlCommandWorkspace />
    </SystemShell>
  );
}
