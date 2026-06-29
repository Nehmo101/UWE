import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { TagAdminWorkspace } from "@/components/TagAdminWorkspace";

export default function AdminTagsPage() {
  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Admin", href: "/admin" }, { label: "Tag-Aufräumer" }]}
        />
      }
    >
      <PageHeader
        title="Tag-Aufräumer"
        summary="Tags normalisieren, ähnliche Schreibweisen erkennen und über alle Entitäten zusammenführen."
      />
      <TagAdminWorkspace />
    </SystemShell>
  );
}
