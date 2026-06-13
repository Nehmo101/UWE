import type {
  AiHealthCheckResult,
  AiModel,
  AiProvider,
  GenerateTextOptions,
  GenerateTextResult,
} from "../types";
import { chatViaRtxAgent, fetchRtxAgentHealth } from "../rtx-agent-client";
import { resolveRtxAgentConfig, type RtxAgentConfig } from "../rtx-agent-config";

/**
 * Local provider that forwards requests to the UWE RTX Agent (token-protected proxy).
 */
export class RtxAgentProvider implements AiProvider {
  readonly id = "ollama" as const;
  readonly isLocal = true;

  constructor(private readonly config: RtxAgentConfig) {}

  async listModels(): Promise<AiModel[]> {
    const health = await fetchRtxAgentHealth(this.config);
    const model = health.model ?? this.config.preferredModel ?? "llama3.2";
    return [{ id: model, name: model, provider: this.id }];
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
