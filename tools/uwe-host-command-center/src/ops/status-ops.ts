import { brainPrisma } from "@uwe/database/brain-client";
import {
  createActivityLogService,
  getMigrationStatus,
  getSecretsStatusSnapshot,
  getSecurityDashboardStatus,
  type PrismaClient,
} from "@uwe/database/server";

/**
 * Read-only operations views for the Command Center: security, secrets,
 * migrations and the audit log. These replace the Studio pages `/admin/security`,
 * `/admin/secrets`, `/admin/migrations` and `/admin/audit-log` (Abschnitt D) —
 * Konfiguration und Betriebsansicht gehören nicht mehr ins Studio.
 *
 * Every function returns plain JSON for stdout. None of them returns a
 * plaintext secret: the secrets view is metadata only, by construction of
 * `getSecretsStatusSnapshot`.
 */

export async function securityStatus(db: PrismaClient): Promise<unknown> {
  return getSecurityDashboardStatus(db);
}

export async function secretsStatus(db: PrismaClient): Promise<unknown> {
  return getSecretsStatusSnapshot(db, brainPrisma);
}

export async function migrationStatus(db: PrismaClient): Promise<unknown> {
  return getMigrationStatus(db);
}

export interface AuditLogQuery {
  limit?: number;
  actions?: string[];
}

export async function auditLog(db: PrismaClient, query: AuditLogQuery): Promise<unknown> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 500);
  const activity = createActivityLogService(db);
  const entries = await activity.list({
    limit,
    ...(query.actions?.length ? { actions: query.actions as never } : {}),
  });
  return { limit, count: entries.length, entries };
}
