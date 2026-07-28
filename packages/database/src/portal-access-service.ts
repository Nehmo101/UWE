import { canAccessPortal, canAccessStudio, type SafeUser } from "@uwe/auth";
import type { PrismaClient } from "./client";
import { createAuthService } from "./auth";
import { isPortalGloballyEnabled, SettingsService } from "./settings-service";
import { USER_SAFE_SELECT } from "./user-service";

export type PortalAccessCheckId =
  | "portal_enabled"
  | "user_active"
  | "password_configured"
  | "email_configured"
  | "portal_access"
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

function summarizeChecks(checks: PortalAccessCheck[]): PortalAccessSummary {
  const required = checks.filter((check) =>
    ["portal_enabled", "user_active", "password_configured", "email_configured", "portal_access"].includes(
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
        include: { world: { select: { id: true, name: true, slug: true } } },
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
      id: "portal_access",
      label: "Häkchen „Portal“ gesetzt",
      pass: canAccessPortal(authUser),
      detail: canAccessPortal(authUser)
        ? undefined
        : "Ohne das Portal-Häkchen im Command Center kommt niemand ins Portal.",
    },
  ];

  const hasGlobalWorldAccess = canAccessStudio(authUser);
  const membershipCount = user.worldMemberships.length;
  checks.push({
    id: "world_membership",
    label: "Welt-Zuordnung oder Studio-Häkchen",
    pass: hasGlobalWorldAccess || membershipCount > 0,
    detail:
      hasGlobalWorldAccess || membershipCount > 0
        ? hasGlobalWorldAccess
          ? "Studio-Zugang sieht alle Welten."
          : `${membershipCount} Zuordnung(en).`
        : "Keine Welt zugeordnet — ohne Zuordnung sieht man im Portal nichts.",
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
      ["portal_enabled", "user_active", "password_configured", "email_configured", "portal_access"].includes(
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
  user: Pick<SafeUser, "status" | "access" | "hasPassword"> & {
    email?: string | null;
    worldMemberships?: Array<{ worldId: string }>;
  },
  options: { portalEnabled?: boolean } = {},
): { label: string; tone: "success" | "warning" | "danger" | "muted" } {
  if (options.portalEnabled === false) return { label: "Portal aus", tone: "muted" };
  if (user.status !== "active") return { label: "Inaktiv", tone: "danger" };
  if (!user.hasPassword || !user.email?.trim()) return { label: "Login unvollständig", tone: "warning" };
  if (!canAccessPortal(user)) return { label: "Kein Portal-Häkchen", tone: "warning" };
  if (!canAccessStudio(user) && (user.worldMemberships?.length ?? 0) === 0) {
    return { label: "Keine Welten", tone: "warning" };
  }
  return { label: "Portal bereit", tone: "success" };
}
