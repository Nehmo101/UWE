import { getAppRepository } from "./app-repository";

export interface HealthCheckResult {
  status: "ok" | "degraded" | "error";
  message: string;
}

export async function databaseHealthCheck(): Promise<HealthCheckResult> {
  try {
    const repo = getAppRepository();
    const stats = await repo.getDashboardStats();

    return {
      status: "ok",
      message: `Database healthy (${stats.worldCount} worlds, ${stats.pageCount} pages)`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";

    return {
      status: "error",
      message,
    };
  }
}
