import type { AccessContext } from "./types";
import { isDm } from "./permissions";

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

/** Anyone assigned to the world may write notes in it. */
export function canCreatePlayerNote(ctx: AccessContext): boolean {
  if (ctx.previewAsUserId) {
    return false;
  }
  return ctx.user !== null && ctx.worldMembership !== null;
}

export function canViewPlayerNote(
  ctx: AccessContext,
  note: PlayerNoteAccessInfo,
): boolean {
  if (note.status === "deleted") {
    return false;
  }

  if (isDm(ctx)) {
    return true;
  }

  if (ctx.user?.id === note.userId) {
    return true;
  }

  if (note.status === "hidden") {
    return false;
  }

  // A note's own visibility survives the visibility purge: it protects the
  // author, not the world. Party notes are the only ones others get to read.
  return (
    ctx.worldMembership !== null &&
    note.status === "accepted" &&
    note.visibility === "party"
  );
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
  return isDm(ctx);
}

export function filterPlayerNotesForViewer<T extends PlayerNoteAccessInfo>(
  ctx: AccessContext,
  notes: T[],
): T[] {
  return notes.filter((note) => canViewPlayerNote(ctx, note));
}
