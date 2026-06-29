import {
  ADMIN_ACCESS_ROLES,
  STUDIO_ACCESS_ROLES,
  hasAnyRole,
  type SafeUser,
  type UweRole,
} from "@uwe/auth";
import type { PrismaClient } from "./client";
import { createAuthService } from "./auth";
import { isPortalGloballyEnabled, SettingsService } from "./settings-service";
import { USER_SAFE_SELECT } from "./user-service";

export type PortalAccessCheckId =
  | "portal_enabled"
  | "user_active"
  | "password_configured"
  | "email_configured"
  | "role_allowed"
  | "world_membership"
  | "accessible_world";

export interface PortalAccessCheck {
  id: PortalAccessCheckId;
  label: string;
  pass: boolean;
  detail?: string;
}

export interface PortalAccessibleWorldSummary {
  id: string;
  name: string;
  slug: string;
  viaMembership: boolean;
}

export type PortalAccessSummary = "granted" | "partial" | "denied";

export interface PortalAccessEvaluation {
  userId: string;
  allowed: boolean;
  summary: PortalAccessSummary;
  checks: PortalAccessCheck[];
  accessibleWorlds: PortalAccessibleWorldSummary[];
  blockers: string[];
}

const PORTAL_LOGIN_ROLES: readonly UweRole[] = [
  "owner",
  "admin",
  "dm",
  "player",
  "readonly",
  "guest",
];

function summarizeChecks(checks: PortalAccessCheck[]): PortalAccessSummary {
  const required = checks.filter((check) =>
    ["portal_enabled", "user_active", "password_configured", "email_configured", "role_allowed"].includes(
      check.id,
    ),
  );
  const worldChecks = checks.filter((check) =>
    ["world_membership", "accessible_world"].includes(check.id),
  );
  if (required.every((check) => check.pass) && worldChecks.every((check) => check.pass)) return "granted";
  if (required.every((check) => check.pass) && worldChecks.some((check) => check.pass)) return "partial";
  return "denied";
}

export async function evaluatePortalAccessForUser(
  db: PrismaClient,
  userId: string,
): Promise<PortalAccessEvaluation | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      ...USER_SAFE_SELECT,
      worldMemberships: {
        include: { world: { select: { id: true, name: true, slug: true, guestModeEnabled: true } } },
        orderBy: [{ world: { name: "asc" } }],
      },
    },
  });
  if (!user) return null;

  const settings = await new SettingsService(db).getSettings();
  const auth = createAuthService(db);
  const authUser = auth.toAuthUser(user);

  const checks: PortalAccessCheck[] = [
    {
      id: "portal_enabled",
      label: "Portal global aktiv",
      pass: isPortalGloballyEnabled(settings),
      detail: isPortalGloballyEnabled(settings) ? undefined : "Portal ist in den Einstellungen deaktiviert.",
    },
    {
      id: "user_active",
      label: "Benutzer aktiv",
      pass: user.status === "active",
      detail:
        user.status === "active"
          ? undefined
          : `Kontostatus: ${user.status ?? "unbekannt"} — nur aktive Benutzer können sich anmelden.`,
    },
    {
      id: "password_configured",
      label: "Passwort gesetzt",
      pass: Boolean(user.passwordHash),
      detail: user.passwordHash ? undefined : "Kein Passwort hinterlegt — Login nicht möglich.",
    },
    {
      id: "email_configured",
      label: "E-Mail hinterlegt",
      pass: Boolean(user.email?.trim()),
      detail: user.email ? undefined : "E-Mail fehlt — Portal-Login benötigt eine E-Mail-Adresse.",
    },
    {
      id: "role_allowed",
      label: "Rolle erlaubt Portal-Login",
      pass: PORTAL_LOGIN_ROLES.includes(user.role),
      detail: PORTAL_LOGIN_ROLES.includes(user.role)
        ? undefined
        : `Rolle „${user.role}“ ist für Portal-Login nicht vorgesehen.`,
    },
  ];

  const hasGlobalWorldAccess = hasAnyRole(authUser, [...ADMIN_ACCESS_ROLES, ...STUDIO_ACCESS_ROLES]);
  const membershipCount = user.worldMemberships.length;
  checks.push({
    id: "world_membership",
    label: "Welt-Mitgliedschaft oder DM/Admin-Rolle",
    pass: hasGlobalWorldAccess || membershipCount > 0,
    detail:
      hasGlobalWorldAccess || membershipCount > 0
        ? hasGlobalWorldAccess
          ? "Globale Studio-Rolle sieht alle Welten."
          : `${membershipCount} Mitgliedschaft(en).`
        : "Keine Welt zugeordnet — Spieler sehen keine Welten im Portal.",
  });

  const accessibleWorldsRaw = await auth.listAccessibleWorldsForUser(userId);
  const membershipWorldIds = new Set(user.worldMemberships.map((entry) => entry.worldId));
  const accessibleWorlds = accessibleWorldsRaw.map((world) => ({
    id: world.id,
    name: world.name,
    slug: world.slug,
    viaMembership: membershipWorldIds.has(world.id),
  }));

  checks.push({
    id: "accessible_world",
    label: "Mindestens eine sichtbare Welt",
    pass: accessibleWorlds.length > 0,
    detail:
      accessibleWorlds.length > 0
        ? `${accessibleWorlds.length} Welt(en) im Portal erreichbar.`
        : "Keine Welt ist für diesen Benutzer lesbar.",
  });

  const loginReady = checks
    .filter((check) =>
      ["portal_enabled", "user_active", "password_configured", "email_configured", "role_allowed"].includes(
        check.id,
      ),
    )
    .every((check) => check.pass);

  return {
    userId,
    allowed: loginReady && accessibleWorlds.length > 0,
    summary: summarizeChecks(checks),
    checks,
    accessibleWorlds,
    blockers: checks.filter((check) => !check.pass).map((check) => check.detail ?? check.label),
  };
}

export function portalAccessBadgeFromUser(
  user: Pick<SafeUser, "status" | "role" | "hasPassword"> & {
    email?: string | null;
    worldMemberships?: Array<{ worldId: string }>;
  },
  options: { portalEnabled?: boolean } = {},
): { label: string; tone: "success" | "warning" | "danger" | "muted" } {
  if (options.portalEnabled === false) return { label: "Portal aus", tone: "muted" };
  if (user.status !== "active") return { label: "Inaktiv", tone: "danger" };
  if (!user.hasPassword || !user.email?.trim()) return { label: "Login unvollständig", tone: "warning" };
  if (!hasAnyRole(user, [...ADMIN_ACCESS_ROLES, ...STUDIO_ACCESS_ROLES]) && (user.worldMemberships?.length ?? 0) === 0) {
    return { label: "Keine Welten", tone: "warning" };
  }
  return { label: "Portal bereit", tone: "success" };
}
