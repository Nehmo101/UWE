import { redirect } from "next/navigation";
import {
  evaluateMaintenanceGate,
  getSystemSettingsSnapshot,
  resolveMaintenanceGateContext,
} from "@uwe/database/server";
import { getCurrentUser } from "./auth";

export async function enforcePortalMaintenance(pathname: string): Promise<void> {
  if (pathname === "/maintenance" || pathname.startsWith("/maintenance/")) {
    return;
  }

  const [{ settings }, user] = await Promise.all([
    getSystemSettingsSnapshot(),
    getCurrentUser(),
  ]);

  const decision = evaluateMaintenanceGate({
    settings,
    surface: "portal",
    pathname,
    context: resolveMaintenanceGateContext({ userRole: user?.role ?? null }),
  });

  if (decision.blocked) {
    redirect("/maintenance");
  }
}
