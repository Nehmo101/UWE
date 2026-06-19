import { AdminModuleShell } from "@/components/AdminModuleShell";
import { TagAdminWorkspace } from "@/components/TagAdminWorkspace";

export default function AdminTagsPage() {
  return (
    <AdminModuleShell
      activePath="/admin/tags"
      title="Tag-Aufräumer"
      summary="Tags normalisieren, ähnliche Schreibweisen erkennen und über alle Entitäten zusammenführen."
    >
      <TagAdminWorkspace />
    </AdminModuleShell>
  );
}
