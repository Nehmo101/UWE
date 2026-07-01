import type { UweAppSurface } from "./route-policy";

export const MAINTENANCE_EVALUATE_API_PATH = "/api/maintenance/evaluate";

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
