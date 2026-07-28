import { createApiKeyStoreFromEnv, InMemoryApiKeyStore } from "@uwe/ai-brain";

/**
 * API-Key-Store für die Inferenz.
 *
 * Früher hat er Umgebungs- und DB-Schlüssel der Cloud-Anbieter zusammengeführt.
 * Die gibt es seit N.3 nicht mehr; was bleibt, ist ein optionaler Schlüssel für
 * ein OpenAI-kompatibles lokales Backend, und der steht in
 * `AI_INFERENCE_API_KEY`.
 */
export async function createApiKeyStore(): Promise<InMemoryApiKeyStore> {
  return createApiKeyStoreFromEnv();
}
