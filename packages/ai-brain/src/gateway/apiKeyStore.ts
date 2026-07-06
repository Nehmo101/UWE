import type { AiProviderId, ApiKeyStore } from "../types";
import { createAiGatewayService, type AiGatewayService } from "@uwe/database/server";
import { createApiKeyStoreFromEnv } from "../settings";

/** Build API key store: DB cloud providers take precedence over ENV. */
export async function createGatewayApiKeyStore(
  gatewayService?: AiGatewayService,
): Promise<ApiKeyStore> {
  const store = createApiKeyStoreFromEnv();
  const service = gatewayService ?? createAiGatewayService();
  const providers = await service.listCloudProviders();

  for (const provider of providers) {
    if (!provider.isEnabled || !provider.hasApiKey) {
      continue;
    }
    const key = await service.resolveCloudProviderApiKey(provider.providerId);
    if (key) {
      store.set(provider.providerId as AiProviderId, key);
    }
  }

  return store;
}
