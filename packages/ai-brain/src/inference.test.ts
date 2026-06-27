import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { getInferenceStatus, runInferenceTestPrompt } from "./inference";
import { resolveInferenceConfig } from "./inference-config";
import {
  assertInferenceUrlAllowed,
  classifyInferenceUrl,
  InferenceUrlBlockedError,
  isInferenceUrlAllowed,
} from "./inference-url-guard";
import { evaluateRtxWorkerUrl } from "./rtx-worker-config";
import { checkRtxHealth } from "./router/health/rtxHealthcheck";
import { createProvider, MockAiProvider } from "./providers/registry";
import { InMemoryApiKeyStore } from "./settings";
import { AiProviderError } from "./types";

const ENV_KEYS = [
  "AI_INFERENCE_ENABLED",
  "AI_INFERENCE_PROVIDER",
  "AI_INFERENCE_BASE_URL",
  "AI_INFERENCE_DEFAULT_MODEL",
  "AI_INFERENCE_TIMEOUT_SECONDS",
  "AI_INFERENCE_ALLOW_PUBLIC_URL",
  "AI_INFERENCE_API_KEY",
  "AI_BRAIN_ENABLED",
  "OLLAMA_BASE_URL",
  "OPENAI_COMPATIBLE_BASE_URL",
  "AI_DEFAULT_PROVIDER",
  "RTX_AGENT_URL",
] as const;

const originalEnv: Record<string, string | undefined> = {};

function snapshotEnv() {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
}

describe("Inference URL guard", () => {
  it("allows loopback and private home-network addresses", () => {
    assert.equal(classifyInferenceUrl("http://localhost:11434"), "loopback");
    assert.equal(classifyInferenceUrl("http://127.0.0.1:11434"), "loopback");
    assert.equal(classifyInferenceUrl("http://192.168.178.50:11434"), "private");
    assert.equal(classifyInferenceUrl("http://10.0.0.5:1234/v1"), "private");

    assert.ok(isInferenceUrlAllowed("http://192.168.178.50:11434", false));
    assert.doesNotThrow(() =>
      assertInferenceUrlAllowed("http://192.168.178.50:11434", false),
    );
  });

  it("blocks public endpoints when AI_INFERENCE_ALLOW_PUBLIC_URL is false", () => {
    assert.equal(classifyInferenceUrl("https://ollama.example.com"), "public");
    assert.equal(isInferenceUrlAllowed("https://ollama.example.com", false), false);

    assert.throws(
      () => assertInferenceUrlAllowed("https://ollama.example.com", false),
      InferenceUrlBlockedError,
    );
  });

  it("allows public endpoints only when explicitly enabled", () => {
    assert.ok(isInferenceUrlAllowed("https://ollama.example.com", true));
    assert.doesNotThrow(() => assertInferenceUrlAllowed("https://ollama.example.com", true));
  });
});

describe("Inference config", () => {
  beforeEach(() => snapshotEnv());
  afterEach(() => restoreEnv());

  it("resolves AI_INFERENCE_* values with sane defaults", () => {
    process.env.AI_INFERENCE_ENABLED = "true";
    process.env.AI_INFERENCE_PROVIDER = "openai-compatible";
    process.env.AI_INFERENCE_BASE_URL = "http://192.168.178.50:1234/v1";
    process.env.AI_INFERENCE_DEFAULT_MODEL = "qwen2.5-coder:7b";
    process.env.AI_INFERENCE_TIMEOUT_SECONDS = "90";

    const config = resolveInferenceConfig();

    assert.equal(config.enabled, true);
    assert.equal(config.provider, "openai_compatible");
    assert.equal(config.baseUrl, "http://192.168.178.50:1234/v1");
    assert.equal(config.defaultModel, "qwen2.5-coder:7b");
    assert.equal(config.timeoutSeconds, 90);
    assert.equal(config.urlAllowed, true);
    assert.equal(config.endpointLabel, "http://192.168.178.50:1234");
  });

  it("marks public URLs as blocked in config", () => {
    process.env.AI_INFERENCE_BASE_URL = "https://ollama.public.example:11434";
    process.env.AI_INFERENCE_ALLOW_PUBLIC_URL = "false";

    const config = resolveInferenceConfig();

    assert.equal(config.urlAllowed, false);
    assert.ok(config.urlBlockReason?.includes("blockiert"));
  });

  it("falls back to legacy OLLAMA_BASE_URL when unified base URL is unset", () => {
    delete process.env.AI_INFERENCE_BASE_URL;
    process.env.AI_INFERENCE_PROVIDER = "ollama";
    process.env.OLLAMA_BASE_URL = "http://192.168.1.10:11434";

    const config = resolveInferenceConfig();

    assert.equal(config.baseUrl, "http://192.168.1.10:11434");
  });
});

describe("Inference status and test prompt", () => {
  beforeEach(() => snapshotEnv());
  afterEach(() => restoreEnv());

  it("reports online with mock provider without contacting RTX", async () => {
    process.env.AI_INFERENCE_ENABLED = "true";
    process.env.AI_INFERENCE_BASE_URL = "http://192.168.178.50:11434";

    const status = await getInferenceStatus({ useMock: true });

    assert.equal(status.enabled, true);
    assert.equal(status.online, true);
    assert.equal(status.configured, true);
    assert.match(status.message, /bereit|erreichbar/i);
  });

  it("returns controlled offline status for blocked public URL", async () => {
    process.env.AI_INFERENCE_ENABLED = "true";
    process.env.AI_INFERENCE_BASE_URL = "https://ollama.public.example:11434";

    const status = await getInferenceStatus();

    assert.equal(status.online, false);
    assert.equal(status.urlAllowed, false);
    assert.ok(status.offlineReason);
  });

  it("runs mock test prompt without throwing when RTX is offline", async () => {
    process.env.AI_INFERENCE_ENABLED = "true";
    process.env.AI_INFERENCE_BASE_URL = "http://192.168.178.50:11434";

    const result = await runInferenceTestPrompt({ useMock: true });

    assert.equal(result.ok, true);
    assert.ok(result.text.length > 0);
    assert.equal(result.provider, "ollama");
  });

  it("returns controlled failure for blocked URL test prompt", async () => {
    process.env.AI_INFERENCE_ENABLED = "true";
    process.env.AI_INFERENCE_BASE_URL = "https://ollama.public.example:11434";

    const result = await runInferenceTestPrompt();

    assert.equal(result.ok, false);
    assert.equal(result.text, "");
    assert.ok(result.message.includes("öffentlich") || result.message.includes("blockiert"));
  });

  it("never exposes API keys in status JSON", async () => {
    process.env.AI_INFERENCE_ENABLED = "true";
    process.env.AI_INFERENCE_BASE_URL = "http://192.168.178.50:11434";
    process.env.AI_INFERENCE_API_KEY = "super-secret-rtx-key";

    const status = await getInferenceStatus({ useMock: true });
    const json = JSON.stringify(status);

    assert.ok(!json.includes("super-secret-rtx-key"));
    assert.ok(!json.includes("apiKey"));
  });
});

describe("MockAiProvider", () => {
  it("returns deterministic responses for known prompts", async () => {
    const provider = new MockAiProvider("ollama", true, {
      ping: "pong",
    });

    const health = await provider.healthCheck();
    assert.equal(health.ok, true);

    const models = await provider.listModels();
    assert.equal(models[0]?.id, "mock-model");

    const result = await provider.generateText({
      model: "mock-model",
      prompt: "ping",
    });
    assert.equal(result.text, "pong");
    assert.equal(result.provider, "ollama");
  });

  it("createProvider useMock bypasses RTX network", () => {
    const provider = createProvider("ollama", new InMemoryApiKeyStore(), { useMock: true });
    assert.equal(provider.id, "ollama");
    assert.ok(provider instanceof MockAiProvider);
  });
});

describe("Ollama provider offline and timeout", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("healthCheck reports offline without throwing", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };

    const { OllamaProvider } = await import("./providers/openai-family");
    const provider = new OllamaProvider("http://192.168.178.50:11434", undefined, 5_000);
    const health = await provider.healthCheck();

    assert.equal(health.ok, false);
    assert.match(health.message, /nicht erreichbar|offline|fetch/i);
  });

  it("generateText throws controlled AiProviderError when offline", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };

    const { OllamaProvider } = await import("./providers/openai-family");
    const provider = new OllamaProvider("http://192.168.178.50:11434", undefined, 5_000);

    await assert.rejects(
      () => provider.generateText({ model: "llama3.2", prompt: "ping" }),
      (error: unknown) => {
        assert.ok(error instanceof AiProviderError);
        assert.match(error.message, /nicht erreichbar/i);
        return true;
      },
    );
  });

  it("generateText times out with clear message", async () => {
    globalThis.fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted", "AbortError"));
        });
      });

    const { OllamaProvider } = await import("./providers/openai-family");
    const provider = new OllamaProvider("http://192.168.178.50:11434", undefined, 50);

    await assert.rejects(
      () => provider.generateText({ model: "llama3.2", prompt: "ping" }),
      (error: unknown) => {
        assert.ok(error instanceof AiProviderError);
        assert.match(error.message, /abgebrochen|timeout|TIMEOUT/i);
        return true;
      },
    );
  });

  it("getInferenceStatus stays non-fatal when RTX is offline", async () => {
    snapshotEnv();
    process.env.AI_INFERENCE_ENABLED = "true";
    process.env.AI_INFERENCE_BASE_URL = "http://192.168.178.50:11434";

    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };

    const status = await getInferenceStatus();

    assert.equal(status.enabled, true);
    assert.equal(status.online, false);
    assert.ok(status.offlineReason);
    restoreEnv();
  });
});

describe("createProvider URL guard", () => {
  it("blocks public base URLs when allowPublicUrl is false", () => {
    assert.throws(
      () =>
        createProvider("ollama", new InMemoryApiKeyStore(), {
          baseUrl: "https://ollama.public.example:11434",
          allowPublicUrl: false,
        }),
      InferenceUrlBlockedError,
    );
  });
});

describe("RTX agent URL evaluation", () => {
  beforeEach(() => snapshotEnv());
  afterEach(() => restoreEnv());

  it("allows private RTX agent URLs", () => {
    process.env.RTX_AGENT_URL = "http://192.168.1.50:8787";

    const evaluation = evaluateRtxWorkerUrl(process.env);

    assert.equal(evaluation.configured, true);
    assert.equal(evaluation.urlAllowed, true);
    assert.equal(evaluation.urlKind, "private");
  });

  it("blocks public RTX agent URLs without throwing", () => {
    process.env.RTX_AGENT_URL = "https://rtx.public.example:8787";

    const evaluation = evaluateRtxWorkerUrl(process.env);

    assert.equal(evaluation.configured, true);
    assert.equal(evaluation.urlAllowed, false);
    assert.equal(evaluation.urlKind, "public");
    assert.ok(evaluation.blockReason?.includes("öffentlich"));
  });

  it("reports public exposure in RTX health status", async () => {
    process.env.RTX_AGENT_URL = "https://rtx.public.example:8787";

    const health = await checkRtxHealth({ env: process.env });

    assert.equal(health.urlAllowed, false);
    assert.equal(health.ready, false);
    assert.ok(health.publicExposureWarning);
  });
});
