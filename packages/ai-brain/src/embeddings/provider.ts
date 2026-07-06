import { prisma as sharedPrisma, type PrismaClient } from "@uwe/database/server";
import { OllamaProvider } from "../providers/openai-family";
import {
  isConnectorEmbeddingAvailable,
  runConnectorEmbeddingGenerate,
} from "../router/providers/connectorQueueProvider";
import { resolveBrainEmbeddingSettings } from "./settings";
import type {
  BrainEmbeddingSettings,
  EmbeddingHealthCheckResult,
  EmbeddingProvider,
} from "./types";
import { BrainEmbeddingError } from "./types";

export function createEmbeddingProvider(
  options?: Partial<BrainEmbeddingSettings> & { useMock?: boolean; prisma?: PrismaClient },
): EmbeddingProvider {
  const settings = resolveBrainEmbeddingSettings(options);

  if (options?.useMock || settings.provider === "mock") {
    return new MockEmbeddingProvider(settings.model);
  }

  if (!settings.enabled || settings.provider === "disabled") {
    return new DisabledEmbeddingProvider();
  }

  let direct: EmbeddingProvider;
  switch (settings.provider) {
    case "ollama":
      direct = new OllamaEmbeddingProvider(settings);
      break;
    case "openai_compatible":
      direct = new OpenAiCompatibleEmbeddingProvider(settings);
      break;
    default:
      throw new BrainEmbeddingError(`Unbekannter Embedding-Provider: ${settings.provider satisfies never}`);
  }

  return new ConnectorPreferredEmbeddingProvider(
    direct,
    options?.prisma ?? sharedPrisma,
    settings.model,
  );
}

class ConnectorPreferredEmbeddingProvider implements EmbeddingProvider {
  readonly id: EmbeddingProvider["id"];
  readonly isLocal = true;
  readonly model: string;

  constructor(
    private readonly direct: EmbeddingProvider,
    private readonly db: PrismaClient,
    model: string,
  ) {
    this.id = direct.id;
    this.model = model;
  }

  async embedText(text: string): Promise<number[]> {
    if (await isConnectorEmbeddingAvailable(this.db)) {
      const result = await runConnectorEmbeddingGenerate(this.db, {
        input: text,
        model: this.model,
      });
      if (result.embedding.length > 0) {
        return result.embedding;
      }
    }
    return this.direct.embedText(text);
  }

  async healthCheck(): Promise<EmbeddingHealthCheckResult> {
    if (await isConnectorEmbeddingAvailable(this.db)) {
      return {
        ok: true,
        provider: this.id,
        message: "RTX Host Connector (embedding_local) bereit",
        latencyMs: 1,
      };
    }
    return this.direct.healthCheck();
  }
}

class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly id = "ollama" as const;
  readonly isLocal = true;
  readonly model: string;
  private readonly provider: OllamaProvider;

  constructor(settings: BrainEmbeddingSettings) {
    this.model = settings.model;
    this.provider = new OllamaProvider(settings.baseUrl);
  }

  async embedText(text: string): Promise<number[]> {
    const vector = await this.provider.embedText!(text, this.model);
    if (vector.length === 0) {
      throw new BrainEmbeddingError("Ollama lieferte keinen Embedding-Vektor");
    }
    return vector;
  }

  async healthCheck(): Promise<EmbeddingHealthCheckResult> {
    return this.provider.healthCheck().then((health) => ({
      ok: health.ok,
      provider: this.id,
      message: health.message,
      latencyMs: health.latencyMs,
    }));
  }
}

class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider {
  readonly id = "openai_compatible" as const;
  readonly isLocal = true;
  readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(settings: BrainEmbeddingSettings) {
    this.model = settings.model;
    this.baseUrl = settings.baseUrl.replace(/\/$/, "");
    this.timeoutMs = settings.timeoutSeconds * 1000;
  }

  async embedText(text: string): Promise<number[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, input: text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new BrainEmbeddingError(
          `OpenAI-kompatibler Embedding-Request fehlgeschlagen (${response.status}): ${body.slice(0, 200)}`,
        );
      }

      const data = (await response.json()) as {
        data?: Array<{ embedding?: number[] }>;
      };
      const vector = data.data?.[0]?.embedding ?? [];
      if (vector.length === 0) {
        throw new BrainEmbeddingError("OpenAI-kompatibler Endpoint lieferte keinen Vektor");
      }
      return vector;
    } catch (error) {
      if (error instanceof BrainEmbeddingError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new BrainEmbeddingError("Embedding-Request Timeout");
      }
      throw new BrainEmbeddingError(
        error instanceof Error ? error.message : "Embedding-Request fehlgeschlagen",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthCheck(): Promise<EmbeddingHealthCheckResult> {
    const started = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/models`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return {
        ok: true,
        provider: this.id,
        message: "Embedding-Provider erreichbar",
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.id,
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
        latencyMs: Date.now() - started,
      };
    }
  }
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly id = "mock" as const;
  readonly isLocal = true;
  readonly model: string;

  constructor(model = "mock-embed") {
    this.model = model;
  }

  async embedText(text: string): Promise<number[]> {
    return deterministicMockVector(text, 16);
  }

  async healthCheck(): Promise<EmbeddingHealthCheckResult> {
    return {
      ok: true,
      provider: this.id,
      message: "Mock-Embedding bereit",
      latencyMs: 1,
    };
  }
}

class DisabledEmbeddingProvider implements EmbeddingProvider {
  readonly id = "disabled" as const;
  readonly isLocal = true;
  readonly model = "disabled";

  async embedText(): Promise<number[]> {
    throw new BrainEmbeddingError("Embeddings sind deaktiviert");
  }

  async healthCheck(): Promise<EmbeddingHealthCheckResult> {
    return {
      ok: false,
      provider: this.id,
      message: "Embeddings deaktiviert",
    };
  }
}

export function deterministicMockVector(text: string, dimensions: number): number[] {
  const normalized = text.trim().toLowerCase();
  const vector = Array.from({ length: dimensions }, (_, index) => {
    let hash = index + 1;
    for (let charIndex = 0; charIndex < normalized.length; charIndex += 1) {
      hash = (hash * 31 + normalized.charCodeAt(charIndex)) % 1000;
    }
    return (hash % 200 - 100) / 100;
  });

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm > 0 ? vector.map((value) => value / norm) : vector;
}
