import { AdminModuleShell } from "@/components/AdminModuleShell";
import { ReviewWorkspace } from "@/components/ReviewWorkspace";

export default function ReviewsPage() {
  return (
    <AdminModuleShell
      activePath="/admin/reviews"
      title="Reviews"
      summary="Offene Änderungsvorschläge — KI, Co-DM, Spielernotizen und Portal-Freischaltungen."
    >
      <ReviewWorkspace />
    </AdminModuleShell>
  );
}
