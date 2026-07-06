import type { CookbookRuntimeProbeInput } from "@uwe/cookbook";
import { prisma } from "@uwe/database/server";
import { getInferenceStatus } from "./inference";
import { checkRtxReadiness } from "./router/health/rtxReadiness";
import { isRtxWorkerConfigured } from "./rtx-worker-config";

export async function buildCookbookRuntimeProbe(options?: {
  useMock?: boolean;
  env?: NodeJS.ProcessEnv;
}): Promise<CookbookRuntimeProbeInput> {
  const [inference, rtx] = await Promise.all([
    getInferenceStatus({ useMock: options?.useMock }),
    checkRtxReadiness({ useMock: options?.useMock, env: options?.env, prisma }),
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
    rtx: {
      ready: rtx.ready,
      online: rtx.online,
      endpoint: rtx.endpoint,
      defaultModel: rtx.defaultModel,
      message: rtx.message,
      urlAllowed: rtx.urlAllowed,
      modelCount: rtx.modelCount,
      agentConfigured: isRtxWorkerConfigured(options?.env),
    },
    skipDocker: options?.useMock,
  };
}
