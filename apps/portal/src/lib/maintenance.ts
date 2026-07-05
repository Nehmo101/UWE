import { redirect } from "next/navigation";
import {
  evaluateMaintenanceGate,
  resolveMaintenanceGateContext,
} from "@uwe/database/maintenance-gate";
import { getSystemSettingsSnapshotSafe } from "@uwe/database/settings-service";
import { getCurrentUser } from "./auth";

export async function enforcePortalMaintenance(pathname: string): Promise<void> {
  if (pathname === "/maintenance" || pathname.startsWith("/maintenance/")) {
    return;
  }

  let settingsSnapshot: Awaited<ReturnType<typeof getSystemSettingsSnapshotSafe>>;
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;

  try {
    [settingsSnapshot, user] = await Promise.all([
      getSystemSettingsSnapshotSafe(),
      getCurrentUser(),
    ]);
  } catch {
    return;
  }

  const decision = evaluateMaintenanceGate({
    settings: settingsSnapshot.settings,
    surface: "portal",
    pathname,
    context: resolveMaintenanceGateContext({ userRole: user?.role ?? null }),
  });

  if (decision.blocked) {
    redirect("/maintenance");
  }
}
