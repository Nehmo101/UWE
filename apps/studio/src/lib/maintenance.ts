import { redirect } from "next/navigation";
import {
  evaluateMaintenanceGate,
  resolveMaintenanceGateContext,
} from "@uwe/database/maintenance-gate";
import { getSystemSettingsSnapshotSafe } from "@uwe/database/settings-service";
import { getCurrentAuthUser } from "./auth";

export async function enforceStudioMaintenance(pathname: string): Promise<void> {
  if (pathname === "/maintenance" || pathname.startsWith("/maintenance/")) {
    return;
  }

  let settingsSnapshot: Awaited<ReturnType<typeof getSystemSettingsSnapshotSafe>>;
  let user: Awaited<ReturnType<typeof getCurrentAuthUser>> = null;

  try {
    [settingsSnapshot, user] = await Promise.all([
      getSystemSettingsSnapshotSafe(),
      getCurrentAuthUser(),
    ]);
  } catch {
    return;
  }

  const decision = evaluateMaintenanceGate({
    settings: settingsSnapshot.settings,
    surface: "studio",
    pathname,
    context: resolveMaintenanceGateContext({ userRole: user?.role ?? null }),
  });

  if (decision.blocked) {
    redirect("/maintenance");
  }
}
