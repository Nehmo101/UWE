import type { AuthUser, UweRole, WorldMemberRole, WorldMembership } from "./types";

/**
 * Fine-grained capabilities for UWE roles.
 * Global roles (User.role) and world membership roles are evaluated together.
 */
export type RoleCapability =
  | "system_admin"
  | "user_management"
  | "security_settings"
  | "backup_restore"
  | "calendar_admin"
  | "api_tokens"
  | "studio_access"
  | "world_read"
  | "world_edit"
  | "canon_edit"
  | "session_manage"
  | "handout_manage"
  | "player_manage"
  | "ai_use"
  | "ai_review"
  | "review_approve"
  | "proposal_submit"
  | "player_note_edit_own"
  | "player_note_moderate"
  | "portal_unlock_grant";

const GLOBAL_CAPABILITIES: Record<UweRole, ReadonlySet<RoleCapability>> = {
  owner: new Set([
    "system_admin",
    "user_management",
    "security_settings",
    "backup_restore",
    "calendar_admin",
    "api_tokens",
    "studio_access",
    "world_read",
    "world_edit",
    "canon_edit",
    "session_manage",
    "handout_manage",
    "player_manage",
    "ai_use",
    "ai_review",
    "review_approve",
    "proposal_submit",
    "player_note_moderate",
    "portal_unlock_grant",
  ]),
  admin: new Set([
    "system_admin",
    "user_management",
    "backup_restore",
    "calendar_admin",
    "api_tokens",
    "studio_access",
    "world_read",
    "ai_review",
    "review_approve",
    // Admin manages system/users/backups but does not auto-edit DnD canon.
  ]),
  dm: new Set([
    "studio_access",
    "world_read",
    "world_edit",
    "canon_edit",
    "session_manage",
    "handout_manage",
    "player_manage",
    "ai_use",
    "ai_review",
    "review_approve",
    "proposal_submit",
    "player_note_moderate",
    "portal_unlock_grant",
  ]),
  player: new Set(["player_note_edit_own"]),
  readonly: new Set(["world_read"]),
  guest: new Set(),
};

const WORLD_CAPABILITIES: Record<WorldMemberRole, ReadonlySet<RoleCapability>> = {
  owner: new Set([
    "world_read",
    "world_edit",
    "canon_edit",
    "session_manage",
    "handout_manage",
    "player_manage",
    "ai_use",
    "ai_review",
    "review_approve",
    "proposal_submit",
    "player_note_moderate",
    "portal_unlock_grant",
  ]),
  dm: new Set([
    "world_read",
    "world_edit",
    "canon_edit",
    "session_manage",
    "handout_manage",
    "player_manage",
    "ai_use",
    "ai_review",
    "review_approve",
    "proposal_submit",
    "player_note_moderate",
    "portal_unlock_grant",
  ]),
  co_dm: new Set([
    "world_read",
    "proposal_submit",
    "ai_use",
    "player_note_edit_own",
  ]),
  player: new Set(["player_note_edit_own"]),
};

export const ROLE_CAPABILITY_LABELS: Record<RoleCapability, string> = {
  system_admin: "System-Administration",
  user_management: "Benutzerverwaltung",
  security_settings: "Sicherheitseinstellungen",
  backup_restore: "Backup & Wiederherstellung",
  calendar_admin: "Kalender-Administration",
  api_tokens: "API-Tokens",
  studio_access: "Studio-Zugriff",
  world_read: "Welt lesen",
  world_edit: "Welt bearbeiten",
  canon_edit: "Kanon direkt bearbeiten",
  session_manage: "Sessions verwalten",
  handout_manage: "Handouts verwalten",
  player_manage: "Spieler verwalten",
  ai_use: "KI nutzen",
  ai_review: "KI-Vorschläge prüfen",
  review_approve: "Reviews freigeben",
  proposal_submit: "Änderungsvorschläge einreichen",
  player_note_edit_own: "Eigene Spielernotizen",
  player_note_moderate: "Spielernotizen moderieren",
  portal_unlock_grant: "Portal-Freischaltungen",
};

export const WORLD_MEMBER_ROLE_LABELS: Record<WorldMemberRole, string> = {
  owner: "Welt-Owner",
  dm: "DM",
  co_dm: "Co-DM",
  player: "Spieler",
};

export interface CapabilityContext {
  user: AuthUser | null;
  worldMembership?: WorldMembership | null;
  studioTrusted?: boolean;
}

function collectCapabilities(ctx: CapabilityContext): Set<RoleCapability> {
  const caps = new Set<RoleCapability>();

  if (ctx.studioTrusted && ctx.user) {
    for (const cap of GLOBAL_CAPABILITIES.dm) {
      caps.add(cap);
    }
    return caps;
  }

  if (ctx.user) {
    for (const cap of GLOBAL_CAPABILITIES[ctx.user.role]) {
      caps.add(cap);
    }
  }

  if (ctx.worldMembership) {
    for (const cap of WORLD_CAPABILITIES[ctx.worldMembership.role]) {
      caps.add(cap);
    }
  }

  return caps;
}

export function hasCapability(
  ctx: CapabilityContext,
  capability: RoleCapability,
): boolean {
  return collectCapabilities(ctx).has(capability);
}

export function listCapabilities(ctx: CapabilityContext): RoleCapability[] {
  return [...collectCapabilities(ctx)];
}

/** Direct content/canon edits require world_edit + canon_edit (or studio trust). */
export function canDirectlyEditCanon(ctx: CapabilityContext): boolean {
  if (ctx.studioTrusted) {
    return true;
  }
  return hasCapability(ctx, "world_edit") && hasCapability(ctx, "canon_edit");
}

/** Co-DM and similar roles must submit proposals instead of direct edits. */
export function mustSubmitProposal(ctx: CapabilityContext): boolean {
  if (ctx.studioTrusted) {
    return false;
  }
  if (canDirectlyEditCanon(ctx)) {
    return false;
  }
  return hasCapability(ctx, "proposal_submit");
}

export function canApproveReviews(ctx: CapabilityContext): boolean {
  return hasCapability(ctx, "review_approve");
}

export function canModeratePlayerNotes(ctx: CapabilityContext): boolean {
  return hasCapability(ctx, "player_note_moderate");
}

export function canEditOwnPlayerNotes(ctx: CapabilityContext): boolean {
  return hasCapability(ctx, "player_note_edit_own");
}

export function canGrantPortalUnlocks(ctx: CapabilityContext): boolean {
  return hasCapability(ctx, "portal_unlock_grant");
}

export function canAccessSystemAdmin(ctx: CapabilityContext): boolean {
  return hasCapability(ctx, "system_admin");
}

export function canManageUsers(ctx: CapabilityContext): boolean {
  return hasCapability(ctx, "user_management");
}

export function canManageSecurity(ctx: CapabilityContext): boolean {
  return hasCapability(ctx, "security_settings");
}

export function canManageBackups(ctx: CapabilityContext): boolean {
  return hasCapability(ctx, "backup_restore");
}

export function canManageApiTokens(ctx: CapabilityContext): boolean {
  return hasCapability(ctx, "api_tokens");
}
