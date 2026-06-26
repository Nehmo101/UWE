import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectCapabilities,
  resolveCapabilityEnv,
  type CapabilityEnv,
} from "./local-capabilities";
import type { LocalLlmSummary } from "./llm-discovery";

const emptyLlms: LocalLlmSummary = {
  providers: [],
  models: [],
  hasChat: false,
  hasEmbeddings: false,
  hasVision: false,
};

function env(overrides: Partial<CapabilityEnv> = {}): CapabilityEnv {
  return {
    audioEnabled: false,
    audioCommandConfigured: false,
    spotifyEnabled: false,
    spotifyBackendConfigured: false,
    imageEnabled: false,
    imageExecutorConfigured: false,
    systemInfoEnabled: true,
    fileCacheEnabled: false,
    ...overrides,
  };
}

function summary(provider: string, capabilities: string[]): LocalLlmSummary {
  return {
    providers: [{ provider, status: "ready", models: [] }],
    models: [
      {
        provider,
        name: `${provider}-model`,
        status: "ready",
        capabilities,
      },
    ],
    hasChat: capabilities.includes("chat"),
    hasEmbeddings: capabilities.includes("embeddings"),
    hasVision: capabilities.includes("vision"),
  };
}

describe("detectCapabilities", () => {
  it("does not advertise audio_local without a configured audio command", () => {
    assert.equal(resolveCapabilityEnv({ UWE_CONNECTOR_AUDIO: "true" }).audioEnabled, false);
    assert.equal(
      resolveCapabilityEnv({ UWE_CONNECTOR_AUDIO_CMD: "mpv --no-video" }).audioEnabled,
      true,
    );

    const detected = detectCapabilities(emptyLlms, env({ audioEnabled: false }));
    assert.deepEqual(detected.capabilities, ["system_info"]);
  });

  it("advertises audio_local when an executable audio backend is configured", () => {
    const detected = detectCapabilities(
      emptyLlms,
      env({ audioEnabled: true, audioCommandConfigured: true }),
    );
    assert.deepEqual(detected.capabilities, ["audio_local", "system_info"]);
  });

  it("only treats Ollama models as executable local LLM capabilities", () => {
    const lmStudio = detectCapabilities(summary("lmstudio", ["chat", "embeddings"]), env());
    assert.deepEqual(lmStudio.capabilities, ["system_info"]);

    const ollamaChat = detectCapabilities(summary("ollama", ["chat"]), env());
    assert.deepEqual(ollamaChat.capabilities, ["llm_local", "system_info"]);

    const ollamaEmbeddings = detectCapabilities(summary("ollama", ["embeddings"]), env());
    assert.deepEqual(ollamaEmbeddings.capabilities, ["embedding_local", "system_info"]);
  });

  it("advertises spotify_connect only with token and device id", () => {
    assert.equal(resolveCapabilityEnv({ SPOTIFY_DEVICE_ID: "device" }).spotifyEnabled, false);
    assert.equal(
      resolveCapabilityEnv({ SPOTIFY_DEVICE_ID: "device", SPOTIFY_ACCESS_TOKEN: "token" }).spotifyEnabled,
      true,
    );

    const detected = detectCapabilities(
      emptyLlms,
      env({ spotifyEnabled: true, spotifyBackendConfigured: true }),
    );
    assert.deepEqual(detected.capabilities, ["spotify_connect", "system_info"]);
  });

  it("advertises image_generation only with a configured image command", () => {
    assert.equal(resolveCapabilityEnv({ UWE_CONNECTOR_IMAGE: "true" }).imageEnabled, false);
    assert.equal(resolveCapabilityEnv({ UWE_CONNECTOR_IMAGE_CMD: "node image-worker.js" }).imageEnabled, true);

    const detected = detectCapabilities(
      emptyLlms,
      env({ imageEnabled: true, imageExecutorConfigured: true }),
    );
    assert.deepEqual(detected.capabilities, ["image_generation", "system_info"]);
  });

  it("does not let forced capabilities advertise missing backends", () => {
    const detected = detectCapabilities(emptyLlms, env(), [
      "image_generation",
      "spotify_connect",
      "system_info",
    ]);
    assert.deepEqual(detected.capabilities, ["system_info"]);
  });
});
