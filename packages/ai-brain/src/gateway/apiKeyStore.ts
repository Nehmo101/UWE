import type { ApiKeyStore } from "../types";
import type { AiGatewayService } from "@uwe/database/server";
import { createEmptyApiKeyStore } from "../settings";

/**
 * Key store for the gateway.
 *
 * This used to merge API keys for the configured cloud providers, with the
 * database taking precedence over the environment. Cloud providers were removed
 * — the Maschinenraum host is the only backend, and it authenticates over the connector
 * rather than with an API key — so there is nothing left to look up. The
 * function stays so the gateway keeps one provider-construction path.
 */
export async function createGatewayApiKeyStore(
  _gatewayService?: AiGatewayService,
): Promise<ApiKeyStore> {
  return createEmptyApiKeyStore();
}
