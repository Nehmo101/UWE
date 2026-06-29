import { ReviewWorkspace } from "@/components/ReviewWorkspace";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";

export default function ReviewsPage() {
  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Admin", href: "/admin" }, { label: "Reviews" }]}
        />
      }
    >
      <PageHeader
        title="Reviews"
        summary="Offene Änderungsvorschläge — KI, Co-DM, Spielernotizen und Portal-Freischaltungen."
      />
      <ReviewWorkspace />
    </SystemShell>
  );
}
