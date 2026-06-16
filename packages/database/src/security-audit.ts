import type { PrismaClient } from "./client";
import { createActivityLogService } from "./activity-log-service";

export type SecurityAuditEvent =
  | "studio_access_denied"
  | "upload_rejected"
  | "env_validation_failed"
  | "public_leak_scan"
  | "backup_restore_attempt";

export interface LogSecurityEventInput {
  event: SecurityAuditEvent;
  summary: string;
  details?: Record<string, unknown>;
  worldSlug?: string | null;
  worldId?: string | null;
}

/**
 * Writes security-relevant events to the activity log (audit trail).
 * Uses the existing warning action — no schema migration required.
 */
export async function logSecurityEvent(
  db: PrismaClient,
  input: LogSecurityEventInput,
): Promise<void> {
  const activity = createActivityLogService(db);
  await activity.log({
    worldId: input.worldId,
    worldSlug: input.worldSlug,
    action: "warning",
    targetType: "system",
    targetLabel: input.event,
    summary: input.summary,
    details: {
      category: "security",
      event: input.event,
      ...input.details,
    },
  });
}
