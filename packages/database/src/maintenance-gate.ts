export type MaintenanceAppSurface = "studio" | "portal";

export interface MaintenanceGateSettings {
  maintenance: {
    maintenanceMode: boolean;
    lockPortal: boolean;
    lockStudio: boolean;
    message: string;
  };
}

export interface MaintenanceGateContext {
  userRole: "owner" | "admin" | "dm" | "player" | "readonly" | "guest" | null;
  isOwner: boolean;
}

export interface MaintenanceGateInput {
  settings: MaintenanceGateSettings;
  surface: MaintenanceAppSurface;
  pathname: string;
  context: MaintenanceGateContext;
}

export interface MaintenanceGateDecision {
  blocked: boolean;
  redirectPath?: "/maintenance";
  message: string;
  reason?: "maintenance_mode" | "lock_portal" | "lock_studio";
}

const BYPASS_PATH_PREFIXES = [
  "/maintenance",
  "/login",
  "/logout",
  "/forgot-password",
  "/reset-password",
  "/setup",
  "/api/health",
  "/api/auth",
];

function isBypassPath(pathname: string): boolean {
  return BYPASS_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isMaintenanceModeActive(settings: MaintenanceGateSettings): boolean {
  return settings.maintenance.maintenanceMode;
}

function isPortalLocked(settings: MaintenanceGateSettings): boolean {
  return settings.maintenance.maintenanceMode || settings.maintenance.lockPortal;
}

function isStudioLocked(settings: MaintenanceGateSettings): boolean {
  return settings.maintenance.maintenanceMode || settings.maintenance.lockStudio;
}

export function resolveMaintenanceGateContext(input: {
  userRole?: MaintenanceGateContext["userRole"];
} = {}): MaintenanceGateContext {
  const userRole = input.userRole ?? null;
  return {
    userRole,
    isOwner: userRole === "owner",
  };
}

export function evaluateMaintenanceGate(input: MaintenanceGateInput): MaintenanceGateDecision {
  const { settings, surface, pathname, context } = input;
  const message =
    settings.maintenance.message?.trim() ||
    "UWE ist vorübergehend im Wartungsmodus. Bitte später erneut versuchen.";

  if (context.isOwner || isBypassPath(pathname)) {
    return { blocked: false, message };
  }

  const locked = surface === "portal" ? isPortalLocked(settings) : isStudioLocked(settings);
  if (!locked) {
    return { blocked: false, message };
  }

  const reason = isMaintenanceModeActive(settings)
    ? "maintenance_mode"
    : surface === "portal"
      ? "lock_portal"
      : "lock_studio";

  return {
    blocked: true,
    redirectPath: "/maintenance",
    message,
    reason,
  };
}
