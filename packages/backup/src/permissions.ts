import type { AuthUser } from "@uwe/auth";

/**
 * Backups follow the access model: creating and downloading is a Studio act,
 * restoring is owner-only. The role enum is gone (Notiz Lasse, 2026-07-26), so
 * these read the checkbox and the owner flag instead.
 */
type BackupActor = Pick<AuthUser, "isOwner" | "access"> | null;

function hasStudio(actor: BackupActor): boolean {
  return actor?.access.studio === true;
}

function isOwner(actor: BackupActor): boolean {
  return actor?.isOwner === true;
}

export function canCreateBackup(actor: BackupActor): boolean {
  return hasStudio(actor);
}

export function canDownloadBackup(actor: BackupActor): boolean {
  return hasStudio(actor);
}

export function canListBackups(actor: BackupActor): boolean {
  return hasStudio(actor);
}

export function canPreviewRestore(actor: BackupActor): boolean {
  return isOwner(actor);
}

export function canRestoreBackup(actor: BackupActor): boolean {
  return isOwner(actor);
}
