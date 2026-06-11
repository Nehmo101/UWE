import type { AccessContext } from "./types";
import { isDmOrOwner } from "./permissions";

export type PlayerNoteStatus =
  | "draft"
  | "visible_to_dm"
  | "accepted"
  | "hidden"
  | "deleted";

export type PlayerNoteVisibility = "private" | "dm_only" | "party";

export interface PlayerNoteAccessInfo {
  id: string;
  userId: string;
  status: PlayerNoteStatus;
  visibility: PlayerNoteVisibility;
}

export function canCreatePlayerNote(
  ctx: AccessContext,
  guestCommentsEnabled: boolean,
): boolean {
  if (ctx.previewAsUserId) {
    return false;
  }

  if (ctx.effectiveRole === "player") {
    return ctx.worldMembership !== null;
  }

  if (ctx.effectiveRole === "guest") {
    return guestCommentsEnabled && ctx.guestModeEnabled && ctx.user !== null;
  }

  return false;
}

export function canViewPlayerNote(
  ctx: AccessContext,
  note: PlayerNoteAccessInfo,
): boolean {
  if (note.status === "deleted") {
    return false;
  }

  if (isDmOrOwner(ctx)) {
    return true;
  }

  if (ctx.user?.id === note.userId) {
    return true;
  }

  if (note.status === "hidden") {
    return false;
  }

  if (
    ctx.effectiveRole === "player" &&
    note.status === "accepted" &&
    note.visibility === "party"
  ) {
    return true;
  }

  return false;
}

export function canEditPlayerNote(
  ctx: AccessContext,
  note: PlayerNoteAccessInfo,
): boolean {
  if (ctx.previewAsUserId) {
    return false;
  }

  if (ctx.user?.id !== note.userId) {
    return false;
  }

  return note.status === "draft" || note.status === "visible_to_dm";
}

export function canModeratePlayerNote(ctx: AccessContext): boolean {
  return isDmOrOwner(ctx) && !ctx.previewAsUserId;
}

export function filterPlayerNotesForViewer<T extends PlayerNoteAccessInfo>(
  ctx: AccessContext,
  notes: T[],
): T[] {
  return notes.filter((note) => canViewPlayerNote(ctx, note));
}
