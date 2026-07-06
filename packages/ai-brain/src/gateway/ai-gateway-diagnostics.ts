import type { AiGatewayConfigRecord, AiGatewayService } from "@uwe/database/server";
import { createAiGatewayService, prisma as sharedPrisma } from "@uwe/database/server";
import { checkRtxReadiness } from "../router/health/rtxReadiness";
import {
  executeAiGatewayRequest,
  type AiGatewayDeps,
  type AiGatewayUserContext,
} from "./aiGateway";

/** Sanitized gateway status for client (no secrets). */
export async function getAiGatewayStatusForClient(
  gatewayService?: AiGatewayService,
): Promise<{
  config: Omit<AiGatewayConfigRecord, "updatedAt"> & { updatedAt: string };
  providers: Awaited<ReturnType<AiGatewayService["listCloudProviders"]>>;
  budget: Awaited<ReturnType<AiGatewayService["getBudgetStatus"]>>;
  rtxHealth: Awaited<ReturnType<typeof checkRtxReadiness>>;
}> {
  const gateway = gatewayService ?? createAiGatewayService();
  const [config, providers, budget, rtxHealth] = await Promise.all([
    gateway.getConfig(),
    gateway.listCloudProviders(),
    gateway.getBudgetStatus(),
    checkRtxReadiness({ prisma: sharedPrisma }),
  ]);

  return {
    config: {
      ...config,
      updatedAt: config.updatedAt.toISOString(),
    },
    providers,
    budget,
    rtxHealth,
  };
}

export async function runAiGatewayFallbackTest(
  deps: AiGatewayDeps,
  user: AiGatewayUserContext,
): Promise<{ localOk: boolean; cloudOk: boolean; message: string }> {
  const rtxHealth = await checkRtxReadiness({ prisma: deps.prisma ?? sharedPrisma });
  let cloudOk = false;

  try {
    await executeAiGatewayRequest(deps, {
      user,
      providerMode: "cloud",
      contextMode: "general_chat",
      taskType: "improve_lore_text",
      userPrompt: "Antworte nur mit: OK",
      useMock: process.env.AI_USE_MOCK === "true",
      feature: "admin_diagnostics",
    });
    cloudOk = true;
  } catch {
    cloudOk = false;
  }

  return {
    localOk: rtxHealth.ready,
    cloudOk,
    message: [
      rtxHealth.ready ? "RTX erreichbar." : "RTX nicht erreichbar.",
      cloudOk ? "Cloud-Fallback-Test erfolgreich." : "Cloud-Fallback-Test fehlgeschlagen oder nicht konfiguriert.",
    ].join(" "),
  };
}
