import { createPrismaClient } from "./client";
import { getWikiStore } from "./store";

export interface HealthCheckResult {
  status: "ok" | "degraded" | "error";
  message: string;
}

export async function databaseHealthCheck(databaseUrl?: string): Promise<HealthCheckResult> {
  const store = getWikiStore();
  const wikiMessage = `Wiki store active (${store.worlds.size} worlds, ${store.pages.size} pages)`;

  try {
    const db = createPrismaClient(databaseUrl);
    await db.$queryRaw`SELECT 1`;

    return {
      status: "ok",
      message: `Database connection healthy; ${wikiMessage}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";

    return {
      status: "error",
      message: `${message}; ${wikiMessage}`,
    };
  }
}
