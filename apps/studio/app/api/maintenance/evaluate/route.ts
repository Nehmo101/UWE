import { evaluateMaintenanceForRequest } from "@uwe/database/server";

/**
 * Reine Gate-Abfrage für die Middleware: Ist dieser Pfad gerade im
 * Wartungsmodus? Öffentlich, unauthentifiziert — und genau deshalb tut sie
 * nichts weiter. Der Log-Retention-Sweep, der hier einmal mitlief, liegt
 * jetzt hinter Token-Auth unter `/api/internal/log-retention`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const pathname = url.searchParams.get("pathname")?.trim() || "/";
  const surface = url.searchParams.get("surface") === "portal" ? "portal" : "studio";

  const decision = await evaluateMaintenanceForRequest({
    surface,
    pathname,
    cookieHeader: request.headers.get("cookie"),
  });

  return Response.json({
    blocked: decision.blocked,
    message: decision.message,
    reason: decision.reason ?? null,
    redirectPath: decision.redirectPath ?? null,
  });
}
