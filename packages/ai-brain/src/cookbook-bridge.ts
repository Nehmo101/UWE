import type { CookbookRuntimeProbeInput } from "@uwe/cookbook";
import { prisma } from "@uwe/database/server";
import { getInferenceStatus } from "./inference";
import { checkEngineReadiness } from "./router/health/engineReadiness";
import { isEngineWorkerConfigured } from "./engine-worker-config";

export async function buildCookbookRuntimeProbe(options?: {
  useMock?: boolean;
  env?: NodeJS.ProcessEnv;
}): Promise<CookbookRuntimeProbeInput> {
  const [inference, engine] = await Promise.all([
    getInferenceStatus({ useMock: options?.useMock }),
    checkEngineReadiness({ useMock: options?.useMock, env: options?.env, prisma }),
  ]);

  return {
    inference: {
      enabled: inference.enabled,
      providerId: inference.providerId,
      endpoint: inference.endpoint,
      defaultModel: inference.defaultModel,
      online: inference.online,
      message: inference.message,
      urlAllowed: inference.urlAllowed,
      modelCount: inference.modelCount,
    },
    engineHost: {
      ready: engine.ready,
      online: engine.online,
      endpoint: engine.endpoint,
      defaultModel: engine.defaultModel,
      message: engine.message,
      urlAllowed: engine.urlAllowed,
      modelCount: engine.modelCount,
      agentConfigured: isEngineWorkerConfigured(options?.env),
    },
    skipDocker: options?.useMock,
  };
}
