import type { AiGatewayConfigRecord, AiGatewayService } from "@uwe/database/server";
import { createAiGatewayService, prisma as sharedPrisma } from "@uwe/database/server";
import { checkRtxReadiness } from "../router/health/rtxReadiness";
import type { AiGatewayDeps, AiGatewayUserContext } from "./aiGateway";

/** Sanitized gateway status for client (no secrets). */
export async function getAiGatewayStatusForClient(
  gatewayService?: AiGatewayService,
): Promise<{
  config: Omit<AiGatewayConfigRecord, "updatedAt"> & { updatedAt: string };
  rtxHealth: Awaited<ReturnType<typeof checkRtxReadiness>>;
}> {
  const gateway = gatewayService ?? createAiGatewayService();
  const [config, rtxHealth] = await Promise.all([
    gateway.getConfig(),
    checkRtxReadiness({ prisma: sharedPrisma }),
  ]);

  return {
    config: {
      ...config,
      updatedAt: config.updatedAt.toISOString(),
    },
    rtxHealth,
  };
}

/**
 * Reachability check for the one backend UWE has left. There is no fallback to
 * test against any more — cloud providers were removed, so "is the RTX host up?"
 * is the whole question.
 */
export async function runAiGatewayFallbackTest(
  deps: AiGatewayDeps,
  _user: AiGatewayUserContext,
): Promise<{ localOk: boolean; message: string }> {
  const rtxHealth = await checkRtxReadiness({ prisma: deps.prisma ?? sharedPrisma });

  return {
    localOk: rtxHealth.ready,
    message: rtxHealth.ready
      ? "RTX-Host erreichbar."
      : rtxHealth.message || "RTX-Host nicht erreichbar.",
  };
}
