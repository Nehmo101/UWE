import { requireOwner } from "@/src/lib/auth";
import { SystemShell } from "@/src/components/shell/SystemShell";
import { NavigationOverview } from "@/src/components/system/NavigationOverview";
import { auditStudioNavigation } from "@/src/navigation/inspect-navigation";
import { studioNavItems } from "@/src/navigation/studio-nav";
import { worldNavItems } from "@/src/navigation/world-nav";

export const dynamic = "force-dynamic";

export default async function SystemNavigationPage() {
  await requireOwner();

  // Global Studio IA (Start/Welten/Knowledge/AI/Werkzeuge/Organisation/System)
  // plus a representative world cockpit (routes are matched against [worldSlug]).
  const items = [...studioNavItems(), ...worldNavItems(":worldSlug")];
  const audit = auditStudioNavigation(items);

  return (
    <SystemShell breadcrumb={<span>System / Navigation</span>}>
      <NavigationOverview items={items} audit={audit} />
    </SystemShell>
  );
}
