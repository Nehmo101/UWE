import { getSystemSettings, resolveDecryptedProviderKeys } from "@uwe/database/server";
import { createApiKeyStoreFromEnv, InMemoryApiKeyStore } from "@uwe/ai-brain";
import type { AiProviderId } from "@uwe/ai-brain";

/**
 * Creates an API key store that merges environment variables (priority) with
 * database-stored encrypted keys as fallback.
 */
export async function createApiKeyStore(): Promise<InMemoryApiKeyStore> {
  const store = createApiKeyStoreFromEnv();
  try {
    const settings = await getSystemSettings();
    const dbKeys = resolveDecryptedProviderKeys(settings);
    for (const [providerId, key] of Object.entries(dbKeys)) {
      if (!store.has(providerId as AiProviderId)) {
        store.set(providerId as AiProviderId, key);
      }
    }
  } catch (error) {
    // Fall back to env-only if settings cannot be loaded
    console.warn(
      "[uwe/ai-key-store] failed to load AI keys from settings, falling back to env",
      error,
    );
  }
  return store;
}
