import { NlCommandWorkspace } from "@/components/NlCommandWorkspace";
import { requireAdminAccess } from "@/src/lib/auth";
import { PageHeader, ShellBreadcrumb } from "@/src/components/shell";

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  await requireAdminAccess();

  const params = await searchParams;
  const initialText = typeof params.q === "string" ? params.q : undefined;

  return (
    <>
      <ShellBreadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Command Center" },
        ]}
      />
      <PageHeader
        title="NL Admin Command Center"
        summary="Whitelist-Befehle mit Intent-Vorschau und Klartext-Bestätigung vor Mutationen — Ausführung über bestehende Services mit Audit-Log."
      />
      <NlCommandWorkspace initialText={initialText} />
    </>
  );
}
