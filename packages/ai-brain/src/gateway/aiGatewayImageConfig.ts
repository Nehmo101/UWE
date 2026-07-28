import { prisma as sharedPrisma } from "@uwe/database/server";
import {
  isConnectorImageAvailable,
  runConnectorImageGenerate,
} from "../router/providers/connectorQueueProvider";
import { resolveImageProviderConfig, type ImageStudioProviderConfig } from "@uwe/image-studio";

/**
 * Bild-Konfiguration des Gateways.
 *
 * Früher wählte sie zwischen lokalem Backend und einem Cloud-Anbieter — mit
 * Routing-Modus, Cloud-Fallback und API-Key-Store. Seit N.3 gibt es nur noch
 * den RTX-Host über die Connector-Queue, also bleibt genau eine Entscheidung:
 * ist der Connector da oder nicht.
 */
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
