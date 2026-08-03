import type { AiGatewayConfigRecord, AiGatewayService } from "@uwe/database/server";
import { createAiGatewayService, prisma as sharedPrisma } from "@uwe/database/server";
import { checkEngineReadiness } from "../router/health/engineReadiness";
import type { AiGatewayDeps, AiGatewayUserContext } from "./aiGateway";

/** Sanitized gateway status for client (no secrets). */
export async function getAiGatewayStatusForClient(
  gatewayService?: AiGatewayService,
): Promise<{
  config: Omit<AiGatewayConfigRecord, "updatedAt"> & { updatedAt: string };
  engineHealth: Awaited<ReturnType<typeof checkEngineReadiness>>;
}> {
  const gateway = gatewayService ?? createAiGatewayService();
  const [config, engineHealth] = await Promise.all([
    gateway.getConfig(),
    checkEngineReadiness({ prisma: sharedPrisma }),
  ]);

  return {
    config: {
      ...config,
      updatedAt: config.updatedAt.toISOString(),
    },
    engineHealth,
  };
}

/**
 * Reachability check for the one backend UWE has left. There is no fallback to
 * test against any more — cloud providers were removed, so "is the Maschinenraum host up?"
 * is the whole question.
 */
export async function runAiGatewayFallbackTest(
  deps: AiGatewayDeps,
  _user: AiGatewayUserContext,
): Promise<{ localOk: boolean; message: string }> {
  const engineHealth = await checkEngineReadiness({ prisma: deps.prisma ?? sharedPrisma });

  return {
    localOk: engineHealth.ready,
    message: engineHealth.ready
      ? "Maschinenraum-Host erreichbar."
      : engineHealth.message || "Maschinenraum-Host nicht erreichbar.",
  };
}
