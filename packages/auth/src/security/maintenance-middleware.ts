import type { UweAppSurface } from "./route-policy";

export const MAINTENANCE_EVALUATE_API_PATH = "/api/maintenance/evaluate";

// Blockierender Server-zu-Server-Fetch pro Request (inkl. RSC-Navigation und
// Hover-Prefetch). Ohne Timeout kann ein hängender Evaluate-Call die
// clientseitige Navigation still sterben lassen — Full-Page-Loads zeigen
// wenigstens die Browser-Ladeanzeige. Bei Timeout fail-open wie bei Fehlern.
const MAINTENANCE_EVALUATE_TIMEOUT_MS = 1500;

export interface MaintenanceMiddlewareDecision {
  blocked: boolean;
  message: string;
  redirectPath?: string;
}

export async function fetchMaintenanceMiddlewareDecision(
  baseUrl: string,
  pathname: string,
  surface: UweAppSurface,
  cookieHeader: string | null,
): Promise<MaintenanceMiddlewareDecision | null> {
  const url = new URL(MAINTENANCE_EVALUATE_API_PATH, baseUrl);
  url.searchParams.set("pathname", pathname);
  url.searchParams.set("surface", surface);

  try {
    const response = await fetch(url, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(MAINTENANCE_EVALUATE_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      blocked?: boolean;
      message?: string;
      redirectPath?: string | null;
    };

    if (!payload.blocked) {
      return null;
    }

    return {
      blocked: true,
      message:
        payload.message?.trim() ||
        "UWE ist vorübergehend im Wartungsmodus. Bitte später erneut versuchen.",
      redirectPath: payload.redirectPath ?? "/maintenance",
    };
  } catch {
    return null;
  }
}
