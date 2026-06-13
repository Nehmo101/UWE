import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadConfig, setAgentEnabled } from "./config.js";

describe("config", () => {
  it("requires AGENT_TOKEN", () => {
    assert.throws(() => loadConfig({}), /AGENT_TOKEN is required/);
  });

  it("loads defaults when token is set", () => {
    const config = loadConfig({ AGENT_TOKEN: "test-token" });
    assert.equal(config.host, "127.0.0.1");
    assert.equal(config.port, 8787);
    assert.equal(config.enabled, true);
    assert.equal(config.ollamaBaseUrl, "http://127.0.0.1:11434");
    assert.equal(config.defaultModel, "llama3.2");
    assert.equal(config.logPrompts, false);
    assert.equal(config.requestTimeoutMs, 120_000);
  });

  it("parses env overrides", () => {
    const config = loadConfig({
      AGENT_TOKEN: "secret",
      AGENT_HOST: "192.168.1.50",
      AGENT_PORT: "9001",
      AGENT_ENABLED: "false",
      OLLAMA_BASE_URL: "http://127.0.0.1:11435",
      DEFAULT_MODEL: "mistral",
      LOG_PROMPTS: "true",
      REQUEST_TIMEOUT_SECONDS: "30",
      ALLOWED_ORIGINS: "http://example.test",
    });

    assert.equal(config.host, "192.168.1.50");
    assert.equal(config.port, 9001);
    assert.equal(config.enabled, false);
    assert.equal(config.ollamaBaseUrl, "http://127.0.0.1:11435");
    assert.equal(config.defaultModel, "mistral");
    assert.equal(config.logPrompts, true);
    assert.equal(config.requestTimeoutMs, 30_000);
    assert.deepEqual(config.allowedOrigins, ["http://example.test"]);
  });

  it("supports runtime enable toggle", () => {
    const config = loadConfig({ AGENT_TOKEN: "secret", AGENT_ENABLED: "true" });
    setAgentEnabled(config, false);
    assert.equal(config.enabled, false);
  });
});
