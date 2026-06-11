/**
 * UWE AI Brain — placeholder for future phases.
 * Planned: local Ollama integration, optional cloud API keys, campaign context.
 */

export const AI_BRAIN_VERSION = "0.1.0";

export interface AiBrainConfig {
  provider: "local" | "openai" | "anthropic";
  enabled: boolean;
}

export const defaultAiBrainConfig: AiBrainConfig = {
  provider: "local",
  enabled: false,
};
