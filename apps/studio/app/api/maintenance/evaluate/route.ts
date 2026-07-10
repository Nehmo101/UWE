import { evaluateMaintenanceForRequest } from "@uwe/database/server";
import { runLogRetentionSweep } from "@uwe/database/log-retention";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pathname = url.searchParams.get("pathname")?.trim() || "/";
  const surface = url.searchParams.get("surface") === "portal" ? "portal" : "studio";

  const decision = await evaluateMaintenanceForRequest({
    surface,
    pathname,
    cookieHeader: request.headers.get("cookie"),
  });

  // Opt-in log retention (OFF by default): a no-op unless UWE_LOG_RETENTION_ENABLED
  // === "true". The service self-throttles and manages its own connection, so this
  // polled route stays cheap; a sweep failure must never break the gate response.
  const retention = await runLogRetentionSweep().catch(() => null);

  return Response.json({
    blocked: decision.blocked,
    message: decision.message,
    reason: decision.reason ?? null,
    redirectPath: decision.redirectPath ?? null,
    retention: retention ? { mode: retention.mode, deleted: retention.totalDeleted } : null,
  });
}
