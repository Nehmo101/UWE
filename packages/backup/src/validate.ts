import type { BackupBundle, BackupManifest } from "./types";
import { findSecretIssuesInJson } from "./sanitize";

const SUPPORTED_MANIFEST_VERSIONS = new Set(["1.0"]);

const REQUIRED_DATA_KEYS = [
  "worlds",
  "campaigns",
  "pages",
  "contentBlocks",
  "assets",
] as const;

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupValidationError";
  }
}

export function validateBackupManifest(manifest: unknown): asserts manifest is BackupManifest {
  if (!manifest || typeof manifest !== "object") {
    throw new BackupValidationError("Backup-Manifest fehlt oder ist ungültig.");
  }

  const record = manifest as Record<string, unknown>;

  if (typeof record.version !== "string" || !SUPPORTED_MANIFEST_VERSIONS.has(record.version)) {
    throw new BackupValidationError(
      `Nicht unterstützte Backup-Version: ${String(record.version)}.`,
    );
  }

  if (typeof record.type !== "string" || !["full", "world", "campaign"].includes(record.type)) {
    throw new BackupValidationError("Backup-Typ im Manifest ist ungültig.");
  }

  if (typeof record.createdAt !== "string" || Number.isNaN(Date.parse(record.createdAt))) {
    throw new BackupValidationError("Backup-Zeitstempel im Manifest ist ungültig.");
  }

  if (!record.stats || typeof record.stats !== "object") {
    throw new BackupValidationError("Backup-Statistiken im Manifest fehlen.");
  }
}

export function validateBackupData(data: unknown): asserts data is BackupBundle["data"] {
  if (!data || typeof data !== "object") {
    throw new BackupValidationError("Backup-Daten fehlen oder sind ungültig.");
  }

  const record = data as Record<string, unknown>;

  for (const key of REQUIRED_DATA_KEYS) {
    if (!Array.isArray(record[key])) {
      throw new BackupValidationError(`Backup-Datenfeld fehlt oder ist ungültig: ${key}.`);
    }
  }
}

export function validateBackupBundle(bundle: unknown): asserts bundle is BackupBundle {
  if (!bundle || typeof bundle !== "object") {
    throw new BackupValidationError("Backup-Format ist ungültig.");
  }

  const record = bundle as Record<string, unknown>;
  validateBackupManifest(record.manifest);
  validateBackupData(record.data);

  const secretIssues = findSecretIssuesInJson(JSON.stringify(record.data));
  if (secretIssues.length > 0) {
    throw new BackupValidationError(
      `Backup enthält sensible Daten und wurde abgelehnt: ${secretIssues.join(", ")}.`,
    );
  }
}

export function validateBackupBundleOrThrow(bundle: BackupBundle): BackupBundle {
  validateBackupBundle(bundle);
  return bundle;
}
