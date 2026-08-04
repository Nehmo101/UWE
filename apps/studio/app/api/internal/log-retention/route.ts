import { NextResponse } from "next/server";
import { runLogRetentionSweep } from "@uwe/database/log-retention";
import { requirePrivateHealthAuth } from "@/src/lib/private-health-auth";

/**
 * Interner Trigger für den Log-Retention-Sweep — dasselbe Muster wie
 * `/api/internal/briefing`: `STUDIO_API_TOKEN` per Bearer, gedacht für einen
 * Timer (Command Center / systemd), nicht für Browser.
 *
 * Der Sweep hing früher an der öffentlichen `/api/maintenance/evaluate`-Route
 * und lief damit bei jedem unauthentifizierten Poll — eine DB-Löschung gehört
 * nicht an eine öffentliche Gate-Abfrage. Der Dienst selbst bleibt opt-in
 * (`UWE_LOG_RETENTION_ENABLED === "true"`) und drosselt sich selbst.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const authError = requirePrivateHealthAuth(request);
  if (authError) return authError;

  const retention = await runLogRetentionSweep();
  return NextResponse.json({
    mode: retention.mode,
    deleted: retention.totalDeleted,
  });
}
