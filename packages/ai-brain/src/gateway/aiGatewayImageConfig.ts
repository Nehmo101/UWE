import type {
  AiGatewayConfigRecord,
  AiGatewayService,
  AiPrivacyLevel,
} from "@uwe/database/server";
import {
  prisma as sharedPrisma,
  resolveFeatureModelOverride,
} from "@uwe/database/server";
import {
  isConnectorImageAvailable,
  runConnectorImageGenerate,
} from "../router/providers/connectorQueueProvider";
import { resolveImageProviderConfig, type ImageStudioProviderConfig } from "@uwe/image-studio";
import { createGatewayApiKeyStore } from "./apiKeyStore";

export async function resolveConnectorAwareImageProviderConfig(options?: {
  prisma?: typeof sharedPrisma;
  env?: NodeJS.ProcessEnv;
}): Promise<ImageStudioProviderConfig> {
  const prisma = options?.prisma ?? sharedPrisma;
  const envConfig = resolveImageProviderConfig(options?.env);
  const connectorImageAvailable = await isConnectorImageAvailable(prisma);
  const useConnectorImage = envConfig.useConnectorImage || connectorImageAvailable;

  return {
    ...envConfig,
    useConnectorImage,
    connectorImageGenerate: useConnectorImage
      ? (request) => runConnectorImageGenerate(prisma, request)
      : undefined,
  };
}

export async function buildGatewayImageProviderConfig(
  gateway: AiGatewayService,
  cloudFallbackAllowed: boolean,
  privacyLevel: AiPrivacyLevel,
  config: AiGatewayConfigRecord,
  prisma: typeof sharedPrisma = sharedPrisma,
): Promise<ImageStudioProviderConfig> {
  const base = await resolveConnectorAwareImageProviderConfig({ prisma });
  const apiKeyStore = await createGatewayApiKeyStore(gateway);
  const cloudApiKey = apiKeyStore.get("openai") ?? base.cloudApiKey ?? undefined;
  const allowCloud =
    config.routingMode !== "LOCAL_ONLY" &&
    config.routingMode !== "DISABLED" &&
    config.cloudFallbackEnabled &&
    cloudFallbackAllowed &&
    privacyLevel === "CLOUD_ALLOWED";

  return {
    ...base,
    allowCloud: allowCloud && Boolean(cloudApiKey),
    cloudApiKey,
    cloudModel: resolveFeatureModelOverride(config, "image_generation")?.model ?? base.cloudModel,
  };
}
