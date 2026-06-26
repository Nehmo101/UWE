import type {
  AiHealthCheckResult,
  AiModel,
  AiProvider,
  GenerateTextOptions,
  GenerateTextResult,
} from "../types";
import { chatViaRtxAgent, fetchRtxAgentHealth, fetchRtxAgentModels } from "../rtx-agent-client";
import { resolveRtxAgentConfig, type RtxAgentConfig } from "../rtx-agent-config";

/**
 * Local provider that forwards requests to the UWE RTX Agent (token-protected proxy).
 */
export class RtxAgentProvider implements AiProvider {
  readonly id = "ollama" as const;
  readonly isLocal = true;

  constructor(private readonly config: RtxAgentConfig) {}

  async listModels(): Promise<AiModel[]> {
    const [modelNames, health] = await Promise.all([
      fetchRtxAgentModels(this.config),
      fetchRtxAgentHealth(this.config),
    ]);

    if (modelNames.length > 0) {
      return modelNames.map((name) => ({ id: name, name, provider: this.id }));
    }

    // Fallback: RTX agent is older and does not expose /api/models
    const fallback = health.model ?? this.config.preferredModel ?? "llama3.2";
    return [{ id: fallback, name: fallback, provider: this.id }];
  }

  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    return chatViaRtxAgent(options, this.config);
  }

  async healthCheck(): Promise<AiHealthCheckResult> {
    const started = Date.now();
    const health = await fetchRtxAgentHealth(this.config);
    const latencyMs = Date.now() - started;

    if (health.status === "ready") {
      return {
        ok: true,
        provider: this.id,
        message: health.message || "RTX-Agent bereit",
        latencyMs,
      };
    }

    return {
      ok: false,
      provider: this.id,
      message: health.message || `RTX-Agent Status: ${health.status}`,
      latencyMs,
    };
  }
}

export function createRtxAgentProvider(config?: RtxAgentConfig | null): RtxAgentProvider | null {
  const resolved = config ?? resolveRtxAgentConfig();
  if (!resolved) {
    return null;
  }
  return new RtxAgentProvider(resolved);
}
