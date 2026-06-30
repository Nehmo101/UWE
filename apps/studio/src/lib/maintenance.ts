import { redirect } from "next/navigation";
import {
  evaluateMaintenanceGate,
  getSystemSettingsSnapshot,
  resolveMaintenanceGateContext,
} from "@uwe/database/server";
import { getCurrentAuthUser } from "./auth";

export async function enforceStudioMaintenance(pathname: string): Promise<void> {
  if (pathname === "/maintenance" || pathname.startsWith("/maintenance/")) {
    return;
  }

  const [{ settings }, user] = await Promise.all([
    getSystemSettingsSnapshot(),
    getCurrentAuthUser(),
  ]);

  const decision = evaluateMaintenanceGate({
    settings,
    surface: "studio",
    pathname,
    context: resolveMaintenanceGateContext({ userRole: user?.role ?? null }),
  });

  if (decision.blocked) {
    redirect("/maintenance");
  }
}
