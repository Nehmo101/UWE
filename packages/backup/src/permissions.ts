import type { UweRole } from "@uwe/auth";

/** Roles allowed to create or download backups (OWNER / ADMIN). */
const BACKUP_OPERATOR_ROLES = new Set<UweRole>(["owner", "dm"]);

/** Roles allowed to preview or execute restores (OWNER only). */
const BACKUP_RESTORE_ROLES = new Set<UweRole>(["owner"]);

export function canCreateBackup(role: UweRole): boolean {
  return BACKUP_OPERATOR_ROLES.has(role);
}

export function canDownloadBackup(role: UweRole): boolean {
  return BACKUP_OPERATOR_ROLES.has(role);
}

export function canListBackups(role: UweRole): boolean {
  return BACKUP_OPERATOR_ROLES.has(role);
}

export function canPreviewRestore(role: UweRole): boolean {
  return BACKUP_RESTORE_ROLES.has(role);
}

export function canRestoreBackup(role: UweRole): boolean {
  return BACKUP_RESTORE_ROLES.has(role);
}
