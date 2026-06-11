/**
 * UWE Core database layer — placeholder for Phase 2.
 * Planned: Prisma + SQLite (local) / PostgreSQL (self-hosted).
 */

export const DATABASE_PACKAGE_VERSION = "0.1.0";

export interface HealthCheckResult {
  status: "ok" | "degraded" | "error";
  message: string;
}

export function databaseHealthCheck(): HealthCheckResult {
  return {
    status: "ok",
    message: "Database layer not yet initialized (Phase 2)",
  };
}
